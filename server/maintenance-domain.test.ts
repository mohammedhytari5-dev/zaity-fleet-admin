import { describe, expect, it } from "vitest";
import { canAdvanceMaintenance, canCloseMaintenance, canEditMaintenanceQuote, hasMaintenanceQuote, nextMaintenanceStages } from "../shared/maintenance-domain";

describe("maintenance workflow", () => {
  it("lets legacy intake stages move directly to finance after the quote is completed", () => {
    for (const stage of ["بلاغ", "فحص", "تشخيص", "تقدير تكلفة"] as const) {
      expect(nextMaintenanceStages(stage)).toEqual(["اعتماد"]);
      expect(canAdvanceMaintenance({ from: stage, to: "اعتماد", approvalStatus: "غير مطلوب" })).toBe(true);
      expect(canAdvanceMaintenance({ from: stage, to: "تنفيذ", approvalStatus: "غير مطلوب" })).toBe(false);
    }
  });

  it("requires a quote file and a positive workshop or parts quote before finance review", () => {
    expect(hasMaintenanceQuote({ quoteName: "عرض الورشة.pdf", quoteUrl: "/files/quote", estimatedCost: 100, quotedPartsCost: 300 })).toBe(true);
    expect(hasMaintenanceQuote({ quoteName: "عرض الورشة.pdf", quoteUrl: "/files/quote", estimatedCost: 0, quotedPartsCost: 0 })).toBe(false);
    expect(hasMaintenanceQuote({ quoteName: "", quoteUrl: "/files/quote", estimatedCost: 400 })).toBe(false);
  });

  it("does not close finance-approved maintenance before linked invoices are approved", () => {
    expect(canCloseMaintenance({ approvalStatus: "معتمد", actualCost: 400, linkedInvoices: [] })).toBe(false);
    expect(canCloseMaintenance({ approvalStatus: "معتمد", actualCost: 0, linkedInvoices: [{ status: "معتمدة" }] })).toBe(false);
    expect(canCloseMaintenance({ approvalStatus: "معتمد", actualCost: 400, linkedInvoices: [{ status: "بانتظار الاعتماد" }] })).toBe(false);
    expect(canCloseMaintenance({ approvalStatus: "معتمد", actualCost: 400, linkedInvoices: [{ status: "معتمدة" }] })).toBe(true);
    expect(canCloseMaintenance({ approvalStatus: "معتمد", actualCost: 400, linkedInvoices: [{ status: "معتمدة" }, { status: "مسودة" }] })).toBe(false);
  });

  it("allows quote edits only before finance approval", () => {
    expect(canEditMaintenanceQuote({ workflowStage: "بلاغ", approvalStatus: "غير مطلوب" })).toBe(true);
    expect(canEditMaintenanceQuote({ workflowStage: "اعتماد", approvalStatus: "بانتظار الاعتماد" })).toBe(true);
    expect(canEditMaintenanceQuote({ workflowStage: "تنفيذ", approvalStatus: "معتمد" })).toBe(false);
    expect(canEditMaintenanceQuote({ workflowStage: "مرفوض", approvalStatus: "مرفوض" })).toBe(false);
  });

  it("offers optional post-repair inspection after execution", () => {
    expect(nextMaintenanceStages("تنفيذ")).toEqual(["فحص بعد الإصلاح", "مغلق"]);
    expect(canAdvanceMaintenance({ from: "تنفيذ", to: "فحص بعد الإصلاح", approvalStatus: "معتمد" })).toBe(true);
    expect(canAdvanceMaintenance({ from: "تنفيذ", to: "مغلق", approvalStatus: "معتمد" })).toBe(true);
  });

  it("requires approval before closing an approved workflow", () => {
    expect(canAdvanceMaintenance({ from: "تنفيذ", to: "مغلق", approvalStatus: "بانتظار الاعتماد" })).toBe(false);
  });
});
