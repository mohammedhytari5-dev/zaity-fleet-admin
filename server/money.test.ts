import { describe, expect, it } from "vitest";
import {
  MONEY_SCALE,
  isValidMoneyAmount,
  multiplyMoney,
  parseMoneyText,
  roundMoney,
  sumMoney,
} from "../shared/money";

describe("money rounding", () => {
  it("rounds to two decimals", () => {
    expect(roundMoney(1250.755)).toBe(1250.76);
    expect(roundMoney(0.005)).toBe(0.01);
    expect(roundMoney(100)).toBe(100);
  });

  it("keeps the scale constant at two decimals", () => {
    expect(MONEY_SCALE).toBe(2);
  });

  it("treats non-finite input as zero rather than propagating NaN", () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("money summation", () => {
  it("avoids binary floating-point drift", () => {
    // Naive addition gives 0.30000000000000004.
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([1000.55, 2000.45, 0.01])).toBe(3001.01);
  });

  it("ignores null and undefined entries", () => {
    expect(sumMoney([10, null, undefined, 5.5])).toBe(15.5);
  });

  it("returns zero for an empty list", () => {
    expect(sumMoney([])).toBe(0);
  });
});

describe("money multiplication", () => {
  it("rounds a unit price times quantity to the stored scale", () => {
    // 3 x 33.333 = 99.999 -> 100.00
    expect(multiplyMoney(33.333, 3)).toBe(100);
    expect(multiplyMoney(12.5, 4)).toBe(50);
  });

  it("returns zero for non-finite operands", () => {
    expect(multiplyMoney(Number.NaN, 2)).toBe(0);
  });
});

describe("money validation", () => {
  it("accepts amounts with at most two decimals", () => {
    expect(isValidMoneyAmount(0)).toBe(true);
    expect(isValidMoneyAmount(1250.75)).toBe(true);
    expect(isValidMoneyAmount(0.01)).toBe(true);
    expect(isValidMoneyAmount(0.07)).toBe(true);
  });

  it("rejects sub-halala precision so values are never silently rounded", () => {
    expect(isValidMoneyAmount(0.001)).toBe(false);
    expect(isValidMoneyAmount(1250.755)).toBe(false);
  });

  it("rejects negatives and non-finite values", () => {
    expect(isValidMoneyAmount(-1)).toBe(false);
    expect(isValidMoneyAmount(Number.NaN)).toBe(false);
    expect(isValidMoneyAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("parsing money out of free text", () => {
  it("reads the legacy formats found in the database", () => {
    expect(parseMoneyText("0 ر.س")).toBe(0);
    expect(parseMoneyText("1 SAR")).toBe(1);
    expect(parseMoneyText("300 SAR")).toBe(300);
    expect(parseMoneyText("1,250 SAR")).toBe(1250);
    expect(parseMoneyText("1٬250.75 ر.س")).toBe(1250.75);
  });

  it("reads Arabic-Indic digits", () => {
    expect(parseMoneyText("٣٠٠ SAR")).toBe(300);
  });

  it("returns null instead of silently defaulting to zero", () => {
    // The previous string surgery produced 0 for these, hiding bad data.
    expect(parseMoneyText("غير محدد")).toBeNull();
    expect(parseMoneyText("")).toBeNull();
    expect(parseMoneyText("ألف")).toBeNull();
    expect(parseMoneyText(undefined)).toBeNull();
    expect(parseMoneyText(null)).toBeNull();
  });

  it("passes numbers through rounded", () => {
    expect(parseMoneyText(12.345)).toBe(12.35);
  });
});
