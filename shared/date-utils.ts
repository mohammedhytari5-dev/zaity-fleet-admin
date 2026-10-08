function parseLocalCalendarDate(value: string | null | undefined): Date | null {
  const digits: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  const dateOnly = String(value ?? "").trim().replace(/[٠-٩]/g, digit => digits[digit]).slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(dateOnly);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : local ? [Number(local[3]), Number(local[2]), Number(local[1])] : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const target = new Date(year, month - 1, day);
  return target.getFullYear() === year && target.getMonth() === month - 1 && target.getDate() === day ? target : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPANY_TIME_ZONE = "Asia/Aden";

/** Format an instant as a YYYY-MM-DD calendar date in the company's time zone. */
export function formatCompanyDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function calendarDayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function companyTodayDayNumber(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return calendarDayNumber(part("year"), part("month"), part("day"));
}

/** Whether a date-only value is earlier than today's calendar date in the company time zone. */
export function isCompanyDateBeforeToday(value: string | null | undefined, now = new Date()): boolean {
  const target = parseLocalCalendarDate(value);
  return target !== null && dateDayNumber(target) < companyTodayDayNumber(now);
}

/** Calendar-day offset from the company's current date; negative values are overdue. */
export function companyDateOffsetFromToday(value: string | null | undefined, now = new Date()): number | null {
  const target = parseLocalCalendarDate(value);
  return target === null ? null : dateDayNumber(target) - companyTodayDayNumber(now);
}

function dateDayNumber(date: Date): number {
  return calendarDayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Resolve stored document status from its expiry date, keeping manually set states without a date. */
export type DocumentExpiryStatus = "ساري" | "قريبًا" | "متأخر" | "منتهي";

export function resolveDocumentStatus(expiry: string | null | undefined, storedStatus: string | null | undefined, now = new Date()): DocumentExpiryStatus {
  const target = parseLocalCalendarDate(expiry);
  if (!target) return (["ساري", "قريبًا", "متأخر", "منتهي"] as const).find(status => status === storedStatus) ?? "ساري";

  const today = companyTodayDayNumber(now);
  const targetDay = dateDayNumber(target);
  if (targetDay < today) return "منتهي";
  return isWithinUpcomingDays(expiry, 60, now) ? "قريبًا" : "ساري";
}

/** Return whether an ISO calendar date falls between today and `days` days ahead. */
export function isWithinUpcomingDays(value: string | null | undefined, days: number, now = new Date()): boolean {
  const target = parseLocalCalendarDate(value);
  if (!target || !Number.isFinite(days) || days < 0) return false;

  const today = companyTodayDayNumber(now);
  const targetDay = dateDayNumber(target);
  return targetDay >= today && targetDay <= today + Math.floor(days);
}

/** Return whether a renewal/expiry date is overdue or falls within the upcoming window. */
export function isExpiredOrWithinUpcomingDays(value: string | null | undefined, days: number, now = new Date()): boolean {
  const target = parseLocalCalendarDate(value);
  if (!target || !Number.isFinite(days) || days < 0) return false;

  const today = companyTodayDayNumber(now);
  return dateDayNumber(target) <= today + Math.floor(days);
}

/** Classify a renewal date for operational follow-up. */
export function resolveRenewalStatus(value: string | null | undefined, now = new Date()): "منتهية" | "قريبة" | "سارية" | "غير محددة" {
  if (!parseLocalCalendarDate(value)) return "غير محددة";
  if (isCompanyDateBeforeToday(value, now)) return "منتهية";
  return isWithinUpcomingDays(value, 60, now) ? "قريبة" : "سارية";
}
