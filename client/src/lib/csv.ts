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

export function serializeExcelCsv(headers: unknown[], rows: unknown[][]): string {
  return "\ufeff" + serializeCsv(headers, rows);
}

export function parseCsvText(text: string): Record<string, string>[] {
  let cleanText = text.replace(/^\ufeff/, "");
  let lines = cleanText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length > 0 && lines[0].toLowerCase().startsWith("sep=")) {
    lines = lines.slice(1);
  }
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.replace(/^["']|["']$/g, "").trim());
  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.replace(/^["']|["']$/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}
