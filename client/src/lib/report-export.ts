export type ReportExportTotal = { key: string; value: number };

export function appendReportSummary<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: string[],
  totals: ReportExportTotal[],
): Row[] {
  if (!rows.length || !columns.length) return rows;
  const summary = Object.fromEntries(columns.map(column => [column, ""])) as Row;
  summary[columns[0] as keyof Row] = `${totals.length ? "الإجمالي" : "عدد السجلات"} (${rows.length})` as Row[keyof Row];
  for (const total of totals) {
    if (columns.includes(total.key)) summary[total.key as keyof Row] = total.value as Row[keyof Row];
  }
  return [...rows, summary];
}
