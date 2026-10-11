import { isPayableExpensePosted } from "./payable-expense-policy";
import { maintenanceInvoiceTotal } from "./maintenance-invoice-total";

export function calculateMaintenanceAdvanceSettlement(
  advanceAmount: number | null,
  invoices: Array<{ amount: number; status: string }>,
): { invoiceTotal: number; variance: number } {
  if (!Number.isSafeInteger(advanceAmount) || advanceAmount! <= 0) {
    throw new Error("مبلغ العهدة غير صالح؛ راجع بيانات اعتماد الصيانة");
  }
  if (invoices.some(invoice => invoice.status === "جديدة")) {
    throw new Error("اعتمد أو ألغِ جميع فواتير طلب الصيانة قبل تسوية العهدة");
  }
  const invoiceTotal = maintenanceInvoiceTotal(invoices);
  if (!invoices.some(invoice => isPayableExpensePosted(invoice.status))) {
    throw new Error("لا توجد فاتورة معتمدة لمطابقتها مع العهدة");
  }
  return { invoiceTotal, variance: advanceAmount! - invoiceTotal };
}
