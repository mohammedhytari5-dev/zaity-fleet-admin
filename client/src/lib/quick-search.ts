export function normalizeQuickSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩۰-۹]/g, digit => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function searchableRecordText(record: unknown): string {
  if (!record || typeof record !== "object" || Array.isArray(record)) return String(record ?? "");
  return Object.entries(record)
    .filter(([key, value]) => !/(?:url|token|secret|password|hash)/i.test(key) && value !== null && typeof value !== "object")
    .map(([, value]) => String(value))
    .join(" ");
}

export function matchesQuickSearch(record: unknown, query: string): boolean {
  const needle = normalizeQuickSearch(query);
  if (!needle) return true;
  const text = normalizeQuickSearch(searchableRecordText(record));
  return text.includes(needle) || text.replace(/\s/g, "").includes(needle.replace(/\s/g, ""));
}

export function filterQuickSearch<T>(
  rows: T[],
  query: string,
  searchableText: (row: T) => string,
  limit = 30,
): T[] {
  const needle = normalizeQuickSearch(query);
  if (!needle) return [];
  return rows
    .filter(row => normalizeQuickSearch(searchableText(row)).includes(needle))
    .slice(0, limit);
}
