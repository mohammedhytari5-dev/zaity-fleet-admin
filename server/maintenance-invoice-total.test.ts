import { describe, expect, it } from "vitest";
import { maintenanceInvoiceTotal } from "./maintenance-invoice-total";

describe("maintenance actual invoice total", () => {
  it("sums approved linked invoices once and excludes pending or cancelled invoices", () => {
    expect(maintenanceInvoiceTotal([
      { amount: 300, status: "معتمدة" },
      { amount: 80, status: "مدفوعة جزئيًا" },
      { amount: 40, status: "مدفوعة" },
      { amount: 500, status: "جديدة" },
      { amount: 100, status: "ملغاة" },
    ])).toBe(420);
  });

  it("returns zero when all linked invoices are pending or cancelled", () => {
    expect(maintenanceInvoiceTotal([{ amount: 300, status: "جديدة" }, { amount: 100, status: "ملغاة" }])).toBe(0);
  });
});
