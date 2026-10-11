import { describe, expect, it } from "vitest";
import { calculateMaintenanceAdvanceSettlement } from "./maintenance-advance-settlement";

describe("maintenance advance settlement", () => {
  it("records the approved invoice total and the amount remaining from an advance", () => {
    expect(calculateMaintenanceAdvanceSettlement(500, [
      { amount: 320, status: "معتمدة" },
      { amount: 80, status: "مدفوعة جزئيًا" },
    ])).toEqual({ invoiceTotal: 400, variance: 100 });
  });

  it("records additional funding needed when approved invoices exceed the advance", () => {
    expect(calculateMaintenanceAdvanceSettlement(300, [
      { amount: 420, status: "معتمدة" },
    ])).toEqual({ invoiceTotal: 420, variance: -120 });
  });

  it("requires all live invoices to be decided before reconciling the advance", () => {
    expect(() => calculateMaintenanceAdvanceSettlement(500, [
      { amount: 300, status: "معتمدة" },
      { amount: 100, status: "جديدة" },
    ])).toThrow("اعتمد أو ألغِ جميع فواتير");
  });

  it("requires at least one approved invoice and a valid advance amount", () => {
    expect(() => calculateMaintenanceAdvanceSettlement(500, [{ amount: 100, status: "ملغاة" }])).toThrow("لا توجد فاتورة معتمدة");
    expect(() => calculateMaintenanceAdvanceSettlement(0, [{ amount: 100, status: "معتمدة" }])).toThrow("مبلغ العهدة غير صالح");
  });
});
