export function isPayableExpensePosted(status: string): boolean {
  return status === "معتمدة" || status === "مدفوعة جزئيًا" || status === "مدفوعة";
}
