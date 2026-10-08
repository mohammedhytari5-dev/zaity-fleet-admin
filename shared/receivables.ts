import { companyDateOffsetFromToday } from "./date-utils";

export type ClaimBalance = { status: string; amount: number; paid: number };
export type ReceivableAgeBucket = "غير محدد" | "غير مستحق" | "1–30 يوم" | "31–60 يوم" | "أكثر من 60 يوم";

export function receivableAging(dueDate: string | null | undefined, now = new Date()): { daysOverdue: number | null; agingBucket: ReceivableAgeBucket } {
  const dayOffset = companyDateOffsetFromToday(dueDate, now);
  if (dayOffset === null) return { daysOverdue: null, agingBucket: "غير محدد" };
  if (dayOffset >= 0) return { daysOverdue: 0, agingBucket: "غير مستحق" };
  const daysOverdue = -dayOffset;
  const agingBucket = daysOverdue <= 30 ? "1–30 يوم" : daysOverdue <= 60 ? "31–60 يوم" : "أكثر من 60 يوم";
  return { daysOverdue, agingBucket };
}

const excludedReceivableStatuses = new Set(["غير مرفوعة", "تم صرفها", "مرفوضة", "ملغاة"]);

export function isReceivableClaimStatus(status: string): boolean {
  return !excludedReceivableStatuses.has(status);
}

export function outstandingClaimAmount(claim: ClaimBalance): number {
  if (!isReceivableClaimStatus(claim.status)) return 0;
  return Math.max(0, Number(claim.amount || 0) - Number(claim.paid || 0));
}

export function totalOutstandingClaims(claims: ClaimBalance[]): number {
  return claims.reduce((total, claim) => total + outstandingClaimAmount(claim), 0);
}

export function countOutstandingClaims(claims: ClaimBalance[]): number {
  return claims.filter(claim => outstandingClaimAmount(claim) > 0).length;
}
