export type ReportPeriod = { from: string; to: string };
export type ComparisonTone = "favorable" | "adverse" | "neutral";

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousReportPeriod(period: ReportPeriod): ReportPeriod | null {
  const from = parseDate(period.from);
  const to = parseDate(period.to);
  if (!from || !to || from > to) return null;
  const lengthDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const previousTo = new Date(from.getTime() - 86_400_000);
  const previousFrom = new Date(previousTo.getTime() - (lengthDays - 1) * 86_400_000);
  return { from: formatDate(previousFrom), to: formatDate(previousTo) };
}

export function compareReportMetric(current: number, previous: number, increaseIsFavorable = true): {
  change: number;
  percent: number | null;
  direction: "up" | "down" | "flat" | "new";
  tone: ComparisonTone;
} {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safePrevious = Number.isFinite(previous) ? previous : 0;
  const change = safeCurrent - safePrevious;
  if (change === 0) return { change, percent: 0, direction: "flat", tone: "neutral" };
  if (safePrevious === 0) return { change, percent: null, direction: change > 0 ? "new" : "down", tone: increaseIsFavorable ? (change > 0 ? "favorable" : "adverse") : (change > 0 ? "adverse" : "favorable") };
  return {
    change,
    percent: Math.round(Math.abs(change / safePrevious) * 100),
    direction: change > 0 ? "up" : "down",
    tone: (change > 0) === increaseIsFavorable ? "favorable" : "adverse",
  };
}
