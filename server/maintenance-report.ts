import { isPayableExpensePosted } from "./payable-expense-policy";

export function maintenanceExpenseTotalInPeriod(
  expenses: Array<{ category: string; amount: number }>,
): number {
  return expenses.reduce(
    (total, expense) => total + (expense.category === "صيانة" ? Number(expense.amount) || 0 : 0),
    0,
  );
}

export function postedMaintenanceExpenseTotalInPeriod(
  expenses: Array<{ category: string; amount: number; payableId: number | null }>,
  payables: Array<{ id: number; status: string }>,
): number {
  const postedPayableIds = new Set(payables.filter(payable => isPayableExpensePosted(payable.status)).map(payable => payable.id));
  return maintenanceExpenseTotalInPeriod(expenses.filter(expense => expense.payableId === null || postedPayableIds.has(expense.payableId)));
}
