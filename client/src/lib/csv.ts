function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const formulaPrefix = /^[\u0000-\u0020\u00a0]*[=+\-@]/.test(text);
  // Numeric values are data, not formulas. For text cells, an apostrophe keeps
  // spreadsheet apps from evaluating formula-like user content on open.
  const safeText = formulaPrefix && typeof value !== "number" ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function serializeCsv(headers: unknown[], rows: unknown[][]): string {
  return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}
