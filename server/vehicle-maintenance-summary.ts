export type MaintenanceExpenseSummary = {
  item: string;
  operations: number;
  total: number;
};

export function summarizeMaintenanceItems(
  expenses: Array<{ maintenanceItem?: string | null; amount: number }>,
): MaintenanceExpenseSummary[] {
  const totals = new Map<string, MaintenanceExpenseSummary>();

  for (const expense of expenses) {
    const item = expense.maintenanceItem?.trim();
    const amount = Number(expense.amount || 0);
    if (!item || amount <= 0) continue;

    const current = totals.get(item) ?? { item, operations: 0, total: 0 };
    current.operations += 1;
    current.total += amount;
    totals.set(item, current);
  }

  return Array.from(totals.values()).sort(
    (a, b) => b.total - a.total || a.item.localeCompare(b.item, "ar"),
  );
}
