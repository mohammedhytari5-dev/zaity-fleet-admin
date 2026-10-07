export type ClaimStatus = "غير مرفوعة" | "جديدة" | "تحت الإجراء" | "تم اعتمادها" | "تم صرفها" | "مرفوضة" | "ملغاة";

const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  "غير مرفوعة": ["جديدة", "ملغاة"],
  "جديدة": ["تحت الإجراء", "مرفوضة", "ملغاة"],
  "تحت الإجراء": ["جديدة", "تم اعتمادها", "مرفوضة", "ملغاة"],
  "تم اعتمادها": ["تحت الإجراء", "ملغاة"],
  "تم صرفها": [],
  "مرفوضة": ["جديدة", "ملغاة"],
  "ملغاة": ["جديدة"],
};

export function canUpdateClaim(input: {
  currentStatus: ClaimStatus;
  currentAmount: number;
  paid: number;
  nextStatus?: ClaimStatus;
  nextAmount?: number;
}): boolean {
  const nextStatus = input.nextStatus ?? input.currentStatus;
  const nextAmount = Number(input.nextAmount ?? input.currentAmount);
  if (input.nextStatus && input.nextStatus !== input.currentStatus && !CLAIM_TRANSITIONS[input.currentStatus].includes(input.nextStatus)) return false;
  if (nextStatus === "تم صرفها" && input.currentStatus !== "تم صرفها") return false;
  if (nextAmount < input.paid || (input.currentStatus === "تم صرفها" && nextAmount > input.paid)) return false;
  return true;
}

export function validatePaymentLinkConsistency(input: {
  paymentClientId?: number | null;
  contractClientId?: number | null;
  claimClientId?: number | null;
  paymentContractId?: number | null;
  claimContractId?: number | null;
}): void {
  if (input.paymentClientId && input.contractClientId && input.paymentClientId !== input.contractClientId) throw new Error("العميل المحدد لا يطابق عميل العقد");
  if (input.paymentClientId && input.claimClientId && input.paymentClientId !== input.claimClientId) throw new Error("العميل المحدد لا يطابق عميل المطالبة");
  if (input.paymentContractId && input.claimContractId && input.paymentContractId !== input.claimContractId) throw new Error("المطالبة لا تتبع العقد المحدد");
  if (input.claimClientId && input.contractClientId && input.claimClientId !== input.contractClientId) throw new Error("المطالبة والدفعة لا تتبعان العميل نفسه");
}

export function validateClaimContractLink(input: {
  clientId: number | null;
  clientName: string;
  contractClientId: number | null;
  contractClientName: string;
}): void {
  if (!input.clientId) throw new Error("اختر عميلًا مسجلًا للمطالبة");
  if (input.contractClientId !== null) {
    if (input.contractClientId !== input.clientId) throw new Error("العقد المختار لا يتبع العميل المحدد");
    return;
  }
  if (input.contractClientName.trim() !== input.clientName.trim()) throw new Error("العقد المختار لا يتبع العميل المحدد");
}
