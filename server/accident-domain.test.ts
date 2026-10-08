import { describe, expect, it } from "vitest";
import { nextAccidentStage } from "./accident-domain";

describe("accident workflow", () => {
  it("requires a Najm reference and fault percentage before estimating repairs", () => {
    expect(() => nextAccidentStage("تحديد المسؤولية", "تقدير الإصلاح", {})).toThrow("أدخل رقم تقرير نجم قبل تحديد المسؤولية");
    expect(() => nextAccidentStage("تحديد المسؤولية", "تقدير الإصلاح", { najmReportNo: "NJ-123" })).toThrow("حدد نسبة المسؤولية من 0 إلى 100٪");
    expect(nextAccidentStage("تحديد المسؤولية", "تقدير الإصلاح", { najmReportNo: "NJ-123", faultPercent: 0 })).toBe("تقدير الإصلاح");
  });

  it("requires repair estimate and insurer details before filing", () => {
    expect(() => nextAccidentStage("تقدير الإصلاح", "مطالبة التأمين", {})).toThrow("أدخل تقدير تكلفة الإصلاح أولًا");
    expect(() => nextAccidentStage("تقدير الإصلاح", "مطالبة التأمين", { estimatedRepairCost: 600 })).toThrow("أدخل اسم شركة التأمين قبل رفع المطالبة");
    expect(nextAccidentStage("تقدير الإصلاح", "مطالبة التأمين", { estimatedRepairCost: 600, insurerName: "التأمين" })).toBe("مطالبة التأمين");
  });

  it("requires insurer claim data and a final settlement before closing", () => {
    expect(() => nextAccidentStage("مطالبة التأمين", "التسوية", { estimatedRepairCost: 600, insurerClaimStatus: "غير مرفوعة" })).toThrow("سجل مرجع المطالبة وحالتها لدى شركة التأمين أولًا");
    expect(nextAccidentStage("مطالبة التأمين", "التسوية", { estimatedRepairCost: 600, insurerClaimRef: "IC-55", insurerClaimStatus: "مقبولة" })).toBe("التسوية");
    expect(() => nextAccidentStage("التسوية", "مغلق", {})).toThrow("سجل مبلغ التسوية النهائي قبل إغلاق الحادث");
    expect(nextAccidentStage("التسوية", "مغلق", { settlementAmount: 0 })).toBe("مغلق");
  });

  it("prevents skipping stages or reopening a closed accident", () => {
    expect(() => nextAccidentStage("بلاغ", "مطالبة التأمين", {})).toThrow("لا يمكن نقل الحادث إلى هذه المرحلة من حالته الحالية");
    expect(() => nextAccidentStage("مغلق", "بلاغ", {})).toThrow("لا يمكن نقل الحادث إلى هذه المرحلة من حالته الحالية");
  });
});
