const arabicDigits: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function westernizeDigits(value: unknown): string {
  return String(value ?? "").normalize("NFKC").replace(/[٠-٩۰-۹]/g, digit => arabicDigits[digit]);
}

export function normalizeIdentityNumber(value: unknown): string {
  const normalized = westernizeDigits(value).trim();
  return !normalized || normalized === "—" ? "—" : normalized;
}

export function isOptionalFixedLengthIdentity(value: unknown, length: number): boolean {
  const normalized = normalizeIdentityNumber(value);
  return normalized === "—" || new RegExp(`^\\d{${length}}$`).test(normalized);
}

export function normalizeNumericInput(value: unknown, maxLength: number): string {
  return westernizeDigits(value).replace(/\D/g, "").slice(0, maxLength);
}
