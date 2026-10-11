import { roundMoney, sumMoney, multiplyMoney } from "./money";

export type InvoiceType = "standard" | "simplified";
export type DocumentType = "invoice" | "credit_note" | "debit_note";
export type ZatcaStatus = "pending" | "reported" | "cleared" | "rejected";

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  standard: "فاتورة ضريبية (B2B)",
  simplified: "فاتورة ضريبية مبسطة (B2C)",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: "فاتورة",
  credit_note: "إشعار دائن",
  debit_note: "إشعار مدين",
};

export interface InvoiceLineInput {
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  vatRate?: number; // e.g. 15 for 15%
  vatCategory?: "S" | "Z" | "E";
}

export interface ComputedInvoiceLine {
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  vatCategory: string;
}

export interface ComputedInvoiceTotals {
  lines: ComputedInvoiceLine[];
  totalExcludingVat: number;
  totalDiscount: number;
  totalVat: number;
  totalIncludingVat: number;
}

/**
 * Calculates line-by-line VAT and totals for a tax invoice in halalas.
 */
export function calculateInvoiceTotals(lines: InvoiceLineInput[]): ComputedInvoiceTotals {
  let totalExcludingVat = 0;
  let totalDiscount = 0;
  let totalVat = 0;

  const computedLines: ComputedInvoiceLine[] = lines.map((line) => {
    const qty = roundMoney(line.quantity || 1);
    const unitPrice = roundMoney(line.unitPrice || 0);
    const discount = roundMoney(line.discount || 0);
    const rawSubtotal = multiplyMoney(unitPrice, qty) - discount;
    const subtotal = roundMoney(Math.max(0, rawSubtotal));

    const vatRate = line.vatRate !== undefined ? line.vatRate : 15;
    const vatCategory = line.vatCategory || (vatRate > 0 ? "S" : "Z");
    const vatAmount = vatRate > 0 ? roundMoney((subtotal * vatRate) / 100) : 0;
    const total = roundMoney(subtotal + vatAmount);

    totalExcludingVat = sumMoney([totalExcludingVat, subtotal]);
    totalDiscount = sumMoney([totalDiscount, discount]);
    totalVat = sumMoney([totalVat, vatAmount]);

    return {
      itemDescription: line.itemDescription,
      quantity: qty,
      unitPrice,
      discount,
      subtotal,
      vatRate,
      vatAmount,
      total,
      vatCategory,
    };
  });

  const totalIncludingVat = roundMoney(totalExcludingVat + totalVat);

  return {
    lines: computedLines,
    totalExcludingVat: roundMoney(totalExcludingVat),
    totalDiscount: roundMoney(totalDiscount),
    totalVat: roundMoney(totalVat),
    totalIncludingVat,
  };
}

/**
 * Encodes a string or byte array into a ZATCA TLV tag.
 * Tag structure: [Tag (1 byte), Length (1 byte), Value (UTF-8 bytes)]
 */
function encodeTlvTag(tagNumber: number, value: string | Uint8Array): Uint8Array {
  let valueBytes: Uint8Array;
  if (typeof value === "string") {
    // UTF-8 encoding supporting Arabic characters
    valueBytes = new TextEncoder().encode(value);
  } else {
    valueBytes = value;
  }

  const length = valueBytes.length;
  const result = new Uint8Array(2 + length);
  result[0] = tagNumber;
  result[1] = length;
  result.set(valueBytes, 2);
  return result;
}

export interface ZatcaQrFields {
  sellerName: string;
  sellerVatNumber: string;
  timestamp: string; // ISO 8601 (e.g. 2026-10-10T19:30:00Z)
  totalWithVat: number | string;
  vatAmount: number | string;
  invoiceHash?: string;
  digitalSignature?: string;
  publicKey?: string;
}

/**
 * Generates the official ZATCA QR Code encoded in TLV (Tag-Length-Value) Base64 string.
 * Tags:
 *   1: Seller's Name
 *   2: Seller's VAT Registration Number (15 digits)
 *   3: Invoice Timestamp (ISO 8601)
 *   4: Invoice Total (with VAT)
 *   5: Total VAT Amount
 *   6: Invoice SHA-256 Hash (optional Phase 2)
 */
export function generateZatcaTlvBase64(fields: ZatcaQrFields): string {
  const totalStr =
    typeof fields.totalWithVat === "number"
      ? fields.totalWithVat.toFixed(2)
      : fields.totalWithVat;

  const vatStr =
    typeof fields.vatAmount === "number"
      ? fields.vatAmount.toFixed(2)
      : fields.vatAmount;

  const tags: Uint8Array[] = [
    encodeTlvTag(1, fields.sellerName.trim()),
    encodeTlvTag(2, fields.sellerVatNumber.trim()),
    encodeTlvTag(3, fields.timestamp.trim()),
    encodeTlvTag(4, totalStr.trim()),
    encodeTlvTag(5, vatStr.trim()),
  ];

  if (fields.invoiceHash) {
    tags.push(encodeTlvTag(6, fields.invoiceHash.trim()));
  }

  const totalLength = tags.reduce((sum, tag) => sum + tag.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const tag of tags) {
    combined.set(tag, offset);
    offset += tag.length;
  }

  // Convert to Base64 in cross-platform way (Browser & Node.js)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(combined).toString("base64");
  } else {
    let binary = "";
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  }
}

/**
 * Decodes a ZATCA Base64 TLV payload back into structured tags.
 * Useful for QR verification and inspection.
 */
export function parseZatcaTlvBase64(base64: string): Record<number, string> {
  let bytes: Uint8Array;
  if (typeof Buffer !== "undefined") {
    bytes = new Uint8Array(Buffer.from(base64, "base64"));
  } else {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }

  const result: Record<number, string> = {};
  let i = 0;
  const decoder = new TextDecoder("utf-8");

  while (i < bytes.length) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    if (i + 2 + len > bytes.length) break;
    const valBytes = bytes.slice(i + 2, i + 2 + len);
    result[tag] = decoder.decode(valBytes);
    i += 2 + len;
  }

  return result;
}
