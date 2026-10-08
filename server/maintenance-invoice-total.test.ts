import { describe, expect, it } from "vitest";
import { hasPostedMaintenanceInvoices, maintenanceInvoiceTotal, shouldClearMaintenanceActualCost } from "./maintenance-invoice-total";

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

  it("does not treat a draft invoice as an authoritative actual-cost source", () => {
    expect(hasPostedMaintenanceInvoices([{ status: "جديدة" }])).toBe(false);
    expect(hasPostedMaintenanceInvoices([{ status: "جديدة" }, { status: "ملغاة" }])).toBe(false);
    expect(hasPostedMaintenanceInvoices([{ status: "جديدة" }, { status: "معتمدة" }])).toBe(true);
  });

  it("clears the invoice-derived cost only when the last posted invoice is cancelled", () => {
    expect(shouldClearMaintenanceActualCost({ cancelledInvoiceWasPosted: false, hasOtherPostedInvoices: false })).toBe(false);
    expect(shouldClearMaintenanceActualCost({ cancelledInvoiceWasPosted: true, hasOtherPostedInvoices: true })).toBe(false);
    expect(shouldClearMaintenanceActualCost({ cancelledInvoiceWasPosted: true, hasOtherPostedInvoices: false })).toBe(true);
  });
});
