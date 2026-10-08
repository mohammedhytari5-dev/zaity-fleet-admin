export type PayableBalanceInput = { amount: number; paid: number; status: string; dueDate?: string | null };

export function summarizePayableBalances(payables: PayableBalanceInput[], today: string) {
  const active = payables.filter(payable => payable.status !== "ملغاة");
  const recognized = active.filter(payable => ["معتمدة", "مدفوعة جزئيًا", "مدفوعة"].includes(payable.status));
  const pendingApproval = active.filter(payable => payable.status === "جديدة");
  const outstandingOf = (payable: PayableBalanceInput) => Math.max(0, Number(payable.amount || 0) - Number(payable.paid || 0));
  return {
    recognizedOutstanding: recognized.reduce((sum, payable) => sum + outstandingOf(payable), 0),
    overdueRecognizedCount: recognized.filter(payable => Boolean(payable.dueDate && payable.dueDate < today) && outstandingOf(payable) > 0).length,
    pendingApprovalCount: pendingApproval.length,
    pendingApprovalAmount: pendingApproval.reduce((sum, payable) => sum + Math.max(0, Number(payable.amount || 0)), 0),
  };
}
