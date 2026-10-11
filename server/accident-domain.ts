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

/**
 * A Najm report number is assigned after the accident is reported, so "no
 * number yet" is the normal initial state. The storage layer must represent
 * that state as SQL NULL:
 *
 *  - The column carries a UNIQUE index. MySQL treats multiple NULLs as
 *    distinct, so any number of unreported accidents coexist safely, while two
 *    accidents can never claim the same report number.
 *  - A sentinel such as `"—"` or `""` would instead occupy the unique slot and
 *    make the *second* unreported accident fail with ER_DUP_ENTRY.
 *  - `updateAccident`/`createAccident` previously forwarded an explicit `null`
 *    into a `NOT NULL DEFAULT '—'` column, which MySQL rejects with
 *    ER_BAD_NULL_ERROR under STRICT_ALL_TABLES.
 *
 * Normalising every write to NULL-or-a-real-number keeps both failure modes
 * impossible. Blank input and the legacy `"—"` sentinel are treated as absent.
 */
export function normalizeNajmReportNo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return null;
  return trimmed;
}

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
