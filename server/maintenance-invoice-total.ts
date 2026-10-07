import { isPayableExpensePosted } from "./payable-expense-policy";

export function maintenanceInvoiceTotal(invoices: Array<{ amount: number; status: string }>): number {
  return invoices.reduce((total, invoice) => total + (isPayableExpensePosted(invoice.status) ? Math.max(0, Number(invoice.amount) || 0) : 0), 0);
}
