import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  generateZatcaTlvBase64,
  parseZatcaTlvBase64,
  type InvoiceLineInput,
} from "../shared/zatca-domain";
import {
  computeInvoiceHash,
  createTaxInvoiceRecord,
  ZatcaDomainError,
} from "./zatca-domain";

describe("ZATCA Domain - Totals & VAT Calculations", () => {
  it("calculates 15% standard VAT for single line accurately", () => {
    const lines: InvoiceLineInput[] = [
      {
        itemDescription: "إيجار سيارة شهري - تويوتا كامري",
        quantity: 1,
        unitPrice: 3000,
      },
    ];

    const result = calculateInvoiceTotals(lines);
    expect(result.totalExcludingVat).toBe(3000);
    expect(result.totalDiscount).toBe(0);
    expect(result.totalVat).toBe(450); // 15% of 3000
    expect(result.totalIncludingVat).toBe(3450);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].vatRate).toBe(15);
    expect(result.lines[0].vatAmount).toBe(450);
  });

  it("calculates discounts and multi-line items with halalas precision", () => {
    const lines: InvoiceLineInput[] = [
      {
        itemDescription: "تغيير زيت وفلتر",
        quantity: 2,
        unitPrice: 150.5,
        discount: 20, // (2 * 150.50) - 20 = 281.00
      },
      {
        itemDescription: "فحص شامل دوري",
        quantity: 1,
        unitPrice: 200,
        discount: 0,
      },
    ];

    const result = calculateInvoiceTotals(lines);
    // Subtotal: 281.00 + 200.00 = 481.00
    expect(result.totalExcludingVat).toBe(481.0);
    expect(result.totalDiscount).toBe(20.0);
    // 15% of 481.00 = 72.15
    expect(result.totalVat).toBe(72.15);
    expect(result.totalIncludingVat).toBe(553.15);
  });

  it("handles zero-rated items (0% VAT category Z)", () => {
    const lines: InvoiceLineInput[] = [
      {
        itemDescription: "خدمة معفاة أو خاضعة للنسبة الصفرية",
        quantity: 1,
        unitPrice: 1000,
        vatRate: 0,
        vatCategory: "Z",
      },
    ];

    const result = calculateInvoiceTotals(lines);
    expect(result.totalExcludingVat).toBe(1000);
    expect(result.totalVat).toBe(0);
    expect(result.totalIncludingVat).toBe(1000);
    expect(result.lines[0].vatCategory).toBe("Z");
  });
});

describe("ZATCA Domain - TLV Base64 QR Code Encoding & Decoding", () => {
  it("encodes and decodes ZATCA TLV tags 1 to 5 with Arabic seller name", () => {
    const qrData = {
      sellerName: "شركة ثقة التوصيل المحدودة",
      sellerVatNumber: "310123456700003",
      timestamp: "2026-10-10T19:30:00Z",
      totalWithVat: "1150.00",
      vatAmount: "150.00",
    };

    const base64 = generateZatcaTlvBase64(qrData);
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(20);

    const decoded = parseZatcaTlvBase64(base64);
    expect(decoded[1]).toBe("شركة ثقة التوصيل المحدودة");
    expect(decoded[2]).toBe("310123456700003");
    expect(decoded[3]).toBe("2026-10-10T19:30:00Z");
    expect(decoded[4]).toBe("1150.00");
    expect(decoded[5]).toBe("150.00");
    expect(decoded[6]).toBeUndefined();
  });

  it("encodes tag 6 (Invoice SHA-256 Hash) when provided", () => {
    const hash = "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890";
    const qrData = {
      sellerName: "Zaity Fleet Co",
      sellerVatNumber: "300000000000003",
      timestamp: "2026-10-10T12:00:00Z",
      totalWithVat: 575.0,
      vatAmount: 75.0,
      invoiceHash: hash,
    };

    const base64 = generateZatcaTlvBase64(qrData);
    const decoded = parseZatcaTlvBase64(base64);
    expect(decoded[1]).toBe("Zaity Fleet Co");
    expect(decoded[2]).toBe("300000000000003");
    expect(decoded[4]).toBe("575.00");
    expect(decoded[5]).toBe("75.00");
    expect(decoded[6]).toBe(hash);
  });
});

describe("ZATCA Domain - SHA-256 Hash Consistency", () => {
  it("produces deterministic 64-character hex hash", () => {
    const payload = {
      invoiceNumber: "INV-2026-00001",
      uuid: "123e4567-e89b-12d3-a456-426614174000",
      issueDate: "2026-10-10",
      issueTime: "14:30:00",
      totalExcludingVat: 1000.0,
      totalVat: 150.0,
      totalIncludingVat: 1150.0,
      sellerVatNumber: "310123456700003",
      buyerVatNumber: "310987654300003",
    };

    const hash1 = computeInvoiceHash(payload);
    const hash2 = computeInvoiceHash(payload);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes when any invoice detail changes", () => {
    const base = {
      invoiceNumber: "INV-2026-00001",
      uuid: "123e4567-e89b-12d3-a456-426614174000",
      issueDate: "2026-10-10",
      issueTime: "14:30:00",
      totalExcludingVat: 1000.0,
      totalVat: 150.0,
      totalIncludingVat: 1150.0,
      sellerVatNumber: "310123456700003",
      buyerVatNumber: "310987654300003",
    };

    const hash1 = computeInvoiceHash(base);
    const hash2 = computeInvoiceHash({ ...base, totalIncludingVat: 1150.01 });

    expect(hash1).not.toBe(hash2);
  });
});

describe("ZATCA Domain - Invoice Input Validation", () => {
  const dummyDb = {} as any;

  it("rejects empty invoice lines", async () => {
    await expect(
      createTaxInvoiceRecord(dummyDb, {
        issueDate: "2026-10-10",
        sellerName: "شركة ثقة التوصيل",
        sellerVatNumber: "310123456700003",
        buyerName: "عميل",
        lines: [],
      })
    ).rejects.toThrow(ZatcaDomainError);
  });

  it("rejects missing seller information", async () => {
    await expect(
      createTaxInvoiceRecord(dummyDb, {
        issueDate: "2026-10-10",
        sellerName: "",
        sellerVatNumber: "",
        buyerName: "عميل",
        lines: [{ itemDescription: "خدمة", quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toThrow("بيانات المورّد");
  });

  it("rejects missing buyer name", async () => {
    await expect(
      createTaxInvoiceRecord(dummyDb, {
        issueDate: "2026-10-10",
        sellerName: "شركة ثقة التوصيل",
        sellerVatNumber: "310123456700003",
        buyerName: "  ",
        lines: [{ itemDescription: "خدمة", quantity: 1, unitPrice: 100 }],
      })
    ).rejects.toThrow("اسم العميل");
  });

  it("rejects standard B2B invoice when buyer VAT number is missing", async () => {
    await expect(
      createTaxInvoiceRecord(dummyDb, {
        invoiceType: "standard",
        issueDate: "2026-10-10",
        sellerName: "شركة ثقة التوصيل",
        sellerVatNumber: "310123456700003",
        buyerName: "شركة العميل التجارية",
        buyerVatNumber: "",
        lines: [{ itemDescription: "خدمة تأجير", quantity: 1, unitPrice: 5000 }],
      })
    ).rejects.toThrow("الرقم الضريبي للمشتري إلزامي");
  });
});
