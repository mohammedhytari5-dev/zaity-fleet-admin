import { isPayableExpensePosted } from "./payable-expense-policy";

type VehicleExpenseForSummary = { vehicleId: number; amount: number; category?: string; payableId: number | null };

export type ExpenseAssignment = { projectId: number | null; projectName: string; clientId: number | null; clientName: string };

export function maintenanceExpenseAssignment(input: {
  requestSnapshot?: ExpenseAssignment | null;
  currentVehicle: ExpenseAssignment;
  existingSnapshot?: ExpenseAssignment | null;
  keepExisting?: boolean;
}): ExpenseAssignment {
  if (input.keepExisting && input.existingSnapshot) return input.existingSnapshot;
  return input.requestSnapshot ?? input.currentVehicle;
}

export function postedVehicleExpenses<T extends VehicleExpenseForSummary>(
  expenses: T[],
  payables: Array<{ id: number; status: string }>,
): T[] {
  const postedPayables = new Set(payables.filter(payable => isPayableExpensePosted(payable.status)).map(payable => payable.id));
  return expenses.filter(expense => expense.payableId === null || postedPayables.has(expense.payableId));
}

export function summarizePostedVehicleExpenses(expenses: VehicleExpenseForSummary[]) {
  const categoryTotals: Record<string, number> = {};
  let expenseTotal = 0;
  for (const expense of expenses) {
    const amount = Number(expense.amount || 0);
    expenseTotal += amount;
    if (expense.category) categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + amount;
  }
  return { categoryTotals, expenseTotal };
}
