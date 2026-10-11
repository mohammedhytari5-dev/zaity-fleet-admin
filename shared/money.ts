/**
 * Monetary arithmetic helpers.
 *
 * Money is stored as `decimal(15,2)` in MySQL and exposed as a JavaScript
 * number, so values are exact to two decimals in the database. JavaScript
 * floating-point addition is not exact, however, so totals computed in the
 * application must be rounded back to the stored scale before they are compared
 * or written - otherwise a sum of many values drifts (e.g. 0.1 + 0.2).
 */

/** Number of decimal places money supports (halalas for SAR). */
export const MONEY_SCALE = 2;

const MONEY_FACTOR = 10 ** MONEY_SCALE;

/** Rounds a monetary value to the stored scale. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * MONEY_FACTOR) / MONEY_FACTOR;
}

/** Sums monetary values and rounds the result to the stored scale. */
export function sumMoney(values: Array<number | null | undefined>): number {
  let total = 0;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return roundMoney(total);
}

/** Multiplies a unit price by a quantity and rounds to the stored scale. */
export function multiplyMoney(unitPrice: number, quantity: number): number {
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) return 0;
  return roundMoney(unitPrice * quantity);
}

/**
 * True when a value is a finite, non-negative amount with no more than
 * `MONEY_SCALE` decimals. Used to keep API input consistent with what the
 * database can actually store, so a value is never silently rounded on insert.
 */
export function isValidMoneyAmount(value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  // Scaling by 100 must land on an integer; the epsilon absorbs the binary
  // representation error of values such as 0.07.
  const scaled = value * MONEY_FACTOR;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * Parses a monetary value out of free text, tolerating Arabic-Indic digits,
 * thousands separators and a trailing currency word. Returns `null` when the
 * text holds no recognisable amount - callers must decide how to treat that
 * rather than silently defaulting to zero.
 */
export function parseMoneyText(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? roundMoney(value) : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٬,\s]/g, "")
    .replace(/ر\.س|ريال|SAR/gi, "");

  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return roundMoney(Number(normalized));
}
