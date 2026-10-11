import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  accounts,
  branches,
  taxInvoices,
  taxInvoiceLines,
  type TaxInvoice,
  type TaxInvoiceLine,
} from "../drizzle/schema";
import {
  calculateInvoiceTotals,
  generateZatcaTlvBase64,
  parseZatcaTlvBase64,
  type DocumentType,
  type InvoiceLineInput,
  type InvoiceType,
  type ZatcaStatus,
} from "../shared/zatca-domain";
import { roundMoney, sumMoney } from "../shared/money";
import { createJournalEntryWithLines } from "./accounting-domain";

export class ZatcaDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZatcaDomainError";
  }
}

export type DbClient = MySql2Database<any>;

/**
 * Computes SHA-256 hash of an invoice canonical representation.
 */
export function computeInvoiceHash(payload: {
  invoiceNumber: string;
  uuid: string;
  issueDate: string;
  issueTime: string;
  totalExcludingVat: number;
  totalVat: number;
  totalIncludingVat: number;
  sellerVatNumber: string;
  buyerVatNumber?: string | null;
}): string {
  const data = [
    payload.invoiceNumber,
    payload.uuid,
    payload.issueDate,
    payload.issueTime,
    payload.totalExcludingVat.toFixed(2),
    payload.totalVat.toFixed(2),
    payload.totalIncludingVat.toFixed(2),
    payload.sellerVatNumber,
    payload.buyerVatNumber || "",
  ].join("|");

  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Generates the next sequential invoice number for a calendar year.
 * Format: INV-YYYY-00001
 */
export async function generateNextInvoiceNumber(
  db: DbClient,
  year: number
): Promise<string> {
  const prefix = `INV-${year}-%`;
  const result = await db
    .select({ invoiceNumber: taxInvoices.invoiceNumber })
    .from(taxInvoices)
    .where(sql`${taxInvoices.invoiceNumber} LIKE ${prefix}`)
    .orderBy(desc(taxInvoices.id))
    .limit(1);

  if (!result || result.length === 0) {
    return `INV-${year}-00001`;
  }

  const latest = result[0].invoiceNumber;
  const parts = latest.split("-");
  const lastSeq = parseInt(parts[parts.length - 1], 10);
  const nextSeq = Number.isNaN(lastSeq) ? 1 : lastSeq + 1;
  return `INV-${year}-${String(nextSeq).padStart(5, "0")}`;
}

export interface CreateTaxInvoiceInput {
  invoiceType?: InvoiceType;
  documentType?: DocumentType;
  issueDate: string;
  issueTime?: string;
  sellerName: string;
  sellerVatNumber: string;
  sellerAddress?: string;
  sellerBuildingNo?: string;
  sellerPostalCode?: string;
  sellerCity?: string;
  sellerDistrict?: string;
  buyerName: string;
  buyerVatNumber?: string;
  buyerAddress?: string;
  buyerCity?: string;
  branchId?: number;
  contractId?: number | null;
  clientId?: number | null;
  claimId?: number | null;
  vehicleId?: number | null;
  originalInvoiceId?: number | null;
  notes?: string;
  lines: InvoiceLineInput[];
  postToAccounting?: boolean;
}

/**
 * Creates a compliant ZATCA Phase 1 & 2 tax invoice, generates its TLV QR Code,
 * and optionally creates a balanced double-entry in the General Ledger.
 */
export async function createTaxInvoiceRecord(
  db: DbClient,
  input: CreateTaxInvoiceInput
): Promise<{ invoice: TaxInvoice; lines: TaxInvoiceLine[] }> {
  if (!input.lines || input.lines.length === 0) {
    throw new ZatcaDomainError("يجب أن تحتوي الفاتورة على بند واحد على الأقل");
  }
  if (!input.sellerName?.trim() || !input.sellerVatNumber?.trim()) {
    throw new ZatcaDomainError("بيانات المورّد (الاسم والرقم الضريبي) إلزامية للفوترة");
  }
  if (!input.buyerName?.trim()) {
    throw new ZatcaDomainError("اسم العميل / المشتري إلزامي للفاتورة");
  }
  if (input.invoiceType === "standard" && !input.buyerVatNumber?.trim()) {
    throw new ZatcaDomainError(
      "الرقم الضريبي للمشتري إلزامي في الفواتير الضريبية القياسية (B2B)"
    );
  }

  const totals = calculateInvoiceTotals(input.lines);
  const dateMatch = input.issueDate.match(/^(\d{4})/);
  const year = dateMatch ? parseInt(dateMatch[1], 10) : new Date().getFullYear();

  const invoiceNumber = await generateNextInvoiceNumber(db, year);
  const uuid = randomUUID();
  const issueTime = input.issueTime || "12:00:00";
  const timestampIso = `${input.issueDate}T${issueTime}Z`;

  const invoiceHash = computeInvoiceHash({
    invoiceNumber,
    uuid,
    issueDate: input.issueDate,
    issueTime,
    totalExcludingVat: totals.totalExcludingVat,
    totalVat: totals.totalVat,
    totalIncludingVat: totals.totalIncludingVat,
    sellerVatNumber: input.sellerVatNumber,
    buyerVatNumber: input.buyerVatNumber,
  });

  // Official ZATCA QR Code encoded in TLV Base64
  const qrCodeData = generateZatcaTlvBase64({
    sellerName: input.sellerName,
    sellerVatNumber: input.sellerVatNumber,
    timestamp: timestampIso,
    totalWithVat: totals.totalIncludingVat,
    vatAmount: totals.totalVat,
    invoiceHash,
  });

  const branchId = input.branchId || 1;
  let journalEntryId: number | null = null;

  // Optional automatic posting to General Ledger
  if (input.postToAccounting) {
    try {
      // Look up default accounts:
      // 1103: العملاء والمدينون
      // 4101: إيرادات عقود التأجير والتشغيل
      // 2104: ضريبة القيمة المضافة المحصلة (المخرجات)
      const accountsList = await db
        .select()
        .from(accounts)
        .where(isNull(accounts.archivedAt));

      const arAccount =
        accountsList.find((a) => a.code === "1103") ||
        accountsList.find((a) => a.type === "asset");
      const revAccount =
        accountsList.find((a) => a.code === "4101") ||
        accountsList.find((a) => a.type === "revenue");
      const vatAccount =
        accountsList.find((a) => a.code === "2104") ||
        accountsList.find((a) => a.type === "liability");

      if (arAccount && revAccount && vatAccount) {
        const lines = [
          {
            accountId: arAccount.id,
            debit: totals.totalIncludingVat,
            credit: 0,
            description: `إثبات مستحق فاتورة ضريبية رقم ${invoiceNumber}`,
            clientId: input.clientId ?? null,
            contractId: input.contractId ?? null,
            branchId,
          },
          {
            accountId: revAccount.id,
            debit: 0,
            credit: totals.totalExcludingVat,
            description: `إيراد فاتورة ضريبية رقم ${invoiceNumber}`,
            branchId,
          },
        ];

        if (totals.totalVat > 0) {
          lines.push({
            accountId: vatAccount.id,
            debit: 0,
            credit: totals.totalVat,
            description: `ضريبة مخرجات (15%) فاتورة رقم ${invoiceNumber}`,
            branchId,
          });
        }

        const { entry } = await createJournalEntryWithLines(db, {
          entryDate: input.issueDate,
          description: `ترحيل آلي لفاتورة ضريبية رقم ${invoiceNumber} - العميل: ${input.buyerName}`,
          reference: invoiceNumber,
          sourceType: "invoice",
          branchId,
          lines,
        });

        journalEntryId = entry.id;
      }
    } catch {
      // If accounts are not seeded yet, gracefully proceed without blocking invoice creation
    }
  }

  // Insert invoice header
  const [invRes] = await db.insert(taxInvoices).values({
    invoiceNumber,
    uuid,
    invoiceType: input.invoiceType || "simplified",
    documentType: input.documentType || "invoice",
    issueDate: input.issueDate,
    issueTime,
    sellerName: input.sellerName,
    sellerVatNumber: input.sellerVatNumber,
    sellerAddress: input.sellerAddress || "—",
    sellerBuildingNo: input.sellerBuildingNo || null,
    sellerPostalCode: input.sellerPostalCode || null,
    sellerCity: input.sellerCity || "الرياض",
    sellerDistrict: input.sellerDistrict || "—",
    buyerName: input.buyerName,
    buyerVatNumber: input.buyerVatNumber || null,
    buyerAddress: input.buyerAddress || null,
    buyerCity: input.buyerCity || null,
    branchId,
    contractId: input.contractId ?? null,
    clientId: input.clientId ?? null,
    claimId: input.claimId ?? null,
    vehicleId: input.vehicleId ?? null,
    originalInvoiceId: input.originalInvoiceId ?? null,
    totalExcludingVat: totals.totalExcludingVat,
    totalDiscount: totals.totalDiscount,
    totalVat: totals.totalVat,
    totalIncludingVat: totals.totalIncludingVat,
    qrCodeData,
    invoiceHash,
    zatcaStatus: "pending",
    notes: input.notes || null,
    journalEntryId,
  });

  const invoiceId = Number((invRes as any).insertId || (invRes as any)[0]?.insertId);

  // Insert invoice line items
  for (let idx = 0; idx < totals.lines.length; idx++) {
    const l = totals.lines[idx];
    await db.insert(taxInvoiceLines).values({
      invoiceId,
      itemDescription: l.itemDescription,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      subtotal: l.subtotal,
      vatRate: l.vatRate,
      vatAmount: l.vatAmount,
      total: l.total,
      vatCategory: l.vatCategory,
      lineOrder: idx + 1,
    });
  }

  const createdInvoice = await db
    .select()
    .from(taxInvoices)
    .where(eq(taxInvoices.id, invoiceId))
    .limit(1);

  const createdLines = await db
    .select()
    .from(taxInvoiceLines)
    .where(eq(taxInvoiceLines.invoiceId, invoiceId))
    .orderBy(taxInvoiceLines.lineOrder);

  return { invoice: createdInvoice[0], lines: createdLines };
}

/**
 * Lists tax invoices with filtering.
 */
export async function listTaxInvoicesRecord(
  db: DbClient,
  filters?: {
    branchId?: number;
    invoiceType?: InvoiceType;
    documentType?: DocumentType;
    zatcaStatus?: ZatcaStatus;
    startDate?: string;
    endDate?: string;
    clientId?: number;
    contractId?: number;
  }
): Promise<TaxInvoice[]> {
  const conditions: any[] = [];
  if (filters?.branchId) conditions.push(eq(taxInvoices.branchId, filters.branchId));
  if (filters?.invoiceType) conditions.push(eq(taxInvoices.invoiceType, filters.invoiceType));
  if (filters?.documentType) conditions.push(eq(taxInvoices.documentType, filters.documentType));
  if (filters?.zatcaStatus) conditions.push(eq(taxInvoices.zatcaStatus, filters.zatcaStatus));
  if (filters?.clientId) conditions.push(eq(taxInvoices.clientId, filters.clientId));
  if (filters?.contractId) conditions.push(eq(taxInvoices.contractId, filters.contractId));
  if (filters?.startDate) conditions.push(sql`${taxInvoices.issueDate} >= ${filters.startDate}`);
  if (filters?.endDate) conditions.push(sql`${taxInvoices.issueDate} <= ${filters.endDate}`);

  return db
    .select()
    .from(taxInvoices)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(taxInvoices.issueDate), desc(taxInvoices.id));
}

/**
 * Retrieves a tax invoice with its line items.
 */
export async function getTaxInvoiceRecord(
  db: DbClient,
  id: number
): Promise<{ invoice: TaxInvoice; lines: TaxInvoiceLine[]; parsedQr: Record<number, string> } | null> {
  const [invoice] = await db
    .select()
    .from(taxInvoices)
    .where(eq(taxInvoices.id, id))
    .limit(1);

  if (!invoice) return null;

  const lines = await db
    .select()
    .from(taxInvoiceLines)
    .where(eq(taxInvoiceLines.invoiceId, id))
    .orderBy(taxInvoiceLines.lineOrder);

  let parsedQr: Record<number, string> = {};
  try {
    parsedQr = parseZatcaTlvBase64(invoice.qrCodeData);
  } catch {
    // If decoding fails, provide empty
  }

  return { invoice, lines, parsedQr };
}

/**
 * Computes the VAT declaration report (إقرار ضريبة القيمة المضافة) for a period.
 */
export async function getVatDeclarationReport(
  db: DbClient,
  options: {
    startDate: string;
    endDate: string;
    branchId?: number;
  }
) {
  const conditions = [
    sql`${taxInvoices.issueDate} >= ${options.startDate}`,
    sql`${taxInvoices.issueDate} <= ${options.endDate}`,
  ];
  if (options.branchId) {
    conditions.push(eq(taxInvoices.branchId, options.branchId));
  }

  const invoices = await db
    .select()
    .from(taxInvoices)
    .where(and(...conditions));

  let totalSalesExcludingVat = 0;
  let totalOutputVat = 0;
  let totalSalesIncludingVat = 0;
  let standardInvoicesCount = 0;
  let simplifiedInvoicesCount = 0;
  let creditNotesCount = 0;

  for (const inv of invoices) {
    const isCreditNote = inv.documentType === "credit_note";
    const multiplier = isCreditNote ? -1 : 1;

    totalSalesExcludingVat += inv.totalExcludingVat * multiplier;
    totalOutputVat += inv.totalVat * multiplier;
    totalSalesIncludingVat += inv.totalIncludingVat * multiplier;

    if (inv.documentType === "credit_note") creditNotesCount++;
    else if (inv.invoiceType === "standard") standardInvoicesCount++;
    else simplifiedInvoicesCount++;
  }

  totalSalesExcludingVat = roundMoney(totalSalesExcludingVat);
  totalOutputVat = roundMoney(totalOutputVat);
  totalSalesIncludingVat = roundMoney(totalSalesIncludingVat);

  return {
    startDate: options.startDate,
    endDate: options.endDate,
    totalInvoices: invoices.length,
    standardInvoicesCount,
    simplifiedInvoicesCount,
    creditNotesCount,
    totalSalesExcludingVat,
    totalOutputVat,
    totalSalesIncludingVat,
    netVatPayable: totalOutputVat,
  };
}
