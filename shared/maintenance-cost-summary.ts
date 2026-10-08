const postedInvoiceStatuses = new Set(["معتمدة", "مدفوعة جزئيًا", "مدفوعة"]);

function amount(value: unknown): number {
  const arabicDigits: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  const normalized = String(value ?? "").replace(/[٠-٩]/g, digit => arabicDigits[digit]).replace(/[٬,]/g, "").replace(/[^0-9.\-]/g, "");
  return Math.max(0, Number(normalized) || 0);
}

export function summarizeMaintenanceCost(input: {
  workshopQuote?: unknown;
  partsQuote?: unknown;
  recordedActual?: unknown;
  invoices: Array<{ amount: unknown; status: string }>;
}) {
  const estimate = amount(input.workshopQuote) + amount(input.partsQuote);
  const postedInvoices = input.invoices.filter(invoice => postedInvoiceStatuses.has(invoice.status));
  const pendingInvoices = input.invoices.filter(invoice => invoice.status !== "ملغاة" && !postedInvoiceStatuses.has(invoice.status));
  const approvedActual = postedInvoices.reduce((sum, invoice) => sum + amount(invoice.amount), 0);
  const pendingTotal = pendingInvoices.reduce((sum, invoice) => sum + amount(invoice.amount), 0);
  const recordedActual = amount(input.recordedActual);
  return {
    estimate,
    approvedActual,
    pendingTotal,
    recordedActual,
    variance: estimate > 0 ? approvedActual - estimate : null,
    invoiceCount: input.invoices.filter(invoice => invoice.status !== "ملغاة").length,
    hasRecordedActualMismatch: postedInvoices.length > 0 && recordedActual !== approvedActual,
  };
}
