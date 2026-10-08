export const accidentStages = ["بلاغ", "تحديد المسؤولية", "تقدير الإصلاح", "مطالبة التأمين", "التسوية", "مغلق", "ملغي"] as const;
export type AccidentStage = typeof accidentStages[number];

export type AccidentStageData = {
  najmReportNo?: string | null;
  faultPercent?: number | null;
  estimatedRepairCost?: number | null;
  insurerName?: string | null;
  insurerClaimRef?: string | null;
  insurerClaimStatus?: string | null;
  settlementAmount?: number | null;
};

export function nextAccidentStage(current: AccidentStage, target: AccidentStage, record: AccidentStageData): AccidentStage {
  const transitions: Record<AccidentStage, AccidentStage[]> = {
    "بلاغ": ["تحديد المسؤولية", "ملغي"],
    "تحديد المسؤولية": ["تقدير الإصلاح", "ملغي"],
    "تقدير الإصلاح": ["مطالبة التأمين", "التسوية", "ملغي"],
    "مطالبة التأمين": ["التسوية", "ملغي"],
    "التسوية": ["مغلق"],
    "مغلق": [],
    "ملغي": [],
  };
  if (!transitions[current].includes(target)) throw new Error("لا يمكن نقل الحادث إلى هذه المرحلة من حالته الحالية");
  if (target === "تقدير الإصلاح") {
    if (!record.najmReportNo?.trim() || record.najmReportNo.trim() === "—") throw new Error("أدخل رقم تقرير نجم قبل تحديد المسؤولية");
    if (record.faultPercent == null || !Number.isInteger(record.faultPercent) || record.faultPercent < 0 || record.faultPercent > 100) throw new Error("حدد نسبة المسؤولية من 0 إلى 100٪");
  }
  if (target === "مطالبة التأمين" || target === "التسوية") {
    if (record.estimatedRepairCost == null || !Number.isInteger(record.estimatedRepairCost) || record.estimatedRepairCost < 0) throw new Error("أدخل تقدير تكلفة الإصلاح أولًا");
  }
  if (target === "مطالبة التأمين" && !record.insurerName?.trim()) throw new Error("أدخل اسم شركة التأمين قبل رفع المطالبة");
  if (target === "التسوية" && current === "مطالبة التأمين" && (!record.insurerClaimRef?.trim() || record.insurerClaimRef.trim() === "—" || record.insurerClaimStatus === "غير مرفوعة")) throw new Error("سجل مرجع المطالبة وحالتها لدى شركة التأمين أولًا");
  if (target === "مغلق" && (record.settlementAmount == null || !Number.isInteger(record.settlementAmount) || record.settlementAmount < 0)) throw new Error("سجل مبلغ التسوية النهائي قبل إغلاق الحادث");
  return target;
}
