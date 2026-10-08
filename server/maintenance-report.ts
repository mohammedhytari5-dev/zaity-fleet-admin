export function maintenanceExpenseTotalInPeriod(
  expenses: Array<{ category: string; amount: number }>,
): number {
  return expenses.reduce(
    (total, expense) => total + (expense.category === "صيانة" ? Number(expense.amount) || 0 : 0),
    0,
  );
}
