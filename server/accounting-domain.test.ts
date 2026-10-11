import { describe, expect, it } from "vitest";
import {
  calculateRunningBalance,
  NORMAL_BALANCE_FOR_TYPE,
  STANDARD_CHART_OF_ACCOUNTS,
  validateJournalLines,
  type JournalLineInput,
} from "../shared/accounting-domain";

describe("Accounting Domain - Double-Entry Validation", () => {
  it("accepts a perfectly balanced journal entry", () => {
    const lines: JournalLineInput[] = [
      { accountId: 1, debit: 1500.5, credit: 0, description: "استلام دفعة في البنك" },
      { accountId: 2, debit: 0, credit: 1500.5, description: "سداد حساب عميل" },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(true);
    expect(result.totalDebit).toBe(1500.5);
    expect(result.totalCredit).toBe(1500.5);
  });

  it("accepts a multi-line balanced entry with halalas (cents)", () => {
    const lines: JournalLineInput[] = [
      { accountId: 10, debit: 1000.25, credit: 0 },
      { accountId: 11, debit: 250.75, credit: 0 },
      { accountId: 20, debit: 0, credit: 1251.0 },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(true);
    expect(result.totalDebit).toBe(1251.0);
    expect(result.totalCredit).toBe(1251.0);
  });

  it("rejects an out-of-balance entry even by 1 halala", () => {
    const lines: JournalLineInput[] = [
      { accountId: 1, debit: 100.0, credit: 0 },
      { accountId: 2, debit: 0, credit: 100.01 },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("غير متوازن");
  });

  it("rejects entries with fewer than two lines", () => {
    const singleLine: JournalLineInput[] = [{ accountId: 1, debit: 100, credit: 0 }];
    expect(validateJournalLines(singleLine).valid).toBe(false);
    expect(validateJournalLines([]).valid).toBe(false);
  });

  it("rejects lines having both debit and credit greater than zero", () => {
    const lines: JournalLineInput[] = [
      { accountId: 1, debit: 50, credit: 50 },
      { accountId: 2, debit: 0, credit: 100 },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("لا يمكن أن يكون السطر مديناً ودائناً");
  });

  it("rejects lines with both debit and credit zero", () => {
    const lines: JournalLineInput[] = [
      { accountId: 1, debit: 0, credit: 0 },
      { accountId: 2, debit: 0, credit: 100 },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("أكبر من صفر");
  });

  it("rejects negative amounts", () => {
    const lines: JournalLineInput[] = [
      { accountId: 1, debit: -100, credit: 0 },
      { accountId: 2, debit: 0, credit: -100 },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("سالبة");
  });

  it("rejects lines with invalid accountId", () => {
    const lines: JournalLineInput[] = [
      { accountId: 0, debit: 100, credit: 0 },
      { accountId: 2, debit: 0, credit: 100 },
    ];

    const result = validateJournalLines(lines);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("حساب صحيح");
  });
});

describe("Accounting Domain - Running Balance Calculation", () => {
  it("calculates running balance for debit-normal accounts (Assets, Expenses)", () => {
    // Normal balance: debit
    let balance = 0;
    // Initial deposit: Dr 1,000
    balance = calculateRunningBalance(balance, 1000, 0, "debit");
    expect(balance).toBe(1000);

    // Additional deposit: Dr 500.50
    balance = calculateRunningBalance(balance, 500.5, 0, "debit");
    expect(balance).toBe(1500.5);

    // Withdrawal: Cr 200.25
    balance = calculateRunningBalance(balance, 0, 200.25, "debit");
    expect(balance).toBe(1300.25);
  });

  it("calculates running balance for credit-normal accounts (Liabilities, Revenues, Equity)", () => {
    // Normal balance: credit
    let balance = 0;
    // Invoice issued / liability created: Cr 2,000
    balance = calculateRunningBalance(balance, 0, 2000, "credit");
    expect(balance).toBe(2000);

    // Additional credit: Cr 1,000.75
    balance = calculateRunningBalance(balance, 0, 1000.75, "credit");
    expect(balance).toBe(3000.75);

    // Partial settlement: Dr 1,500
    balance = calculateRunningBalance(balance, 1500, 0, "credit");
    expect(balance).toBe(1500.75);
  });
});

describe("Accounting Domain - Standard Chart of Accounts Integrity", () => {
  it("contains all five standard accounting classes", () => {
    const types = new Set(STANDARD_CHART_OF_ACCOUNTS.map((a) => a.type));
    expect(types.has("asset")).toBe(true);
    expect(types.has("liability")).toBe(true);
    expect(types.has("equity")).toBe(true);
    expect(types.has("revenue")).toBe(true);
    expect(types.has("expense")).toBe(true);
  });

  it("has unique account codes across the entire chart", () => {
    const codes = STANDARD_CHART_OF_ACCOUNTS.map((a) => a.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("ensures every sub-account references a valid parent account code", () => {
    const codeSet = new Set(STANDARD_CHART_OF_ACCOUNTS.map((a) => a.code));
    for (const acc of STANDARD_CHART_OF_ACCOUNTS) {
      if (acc.parentCode) {
        expect(codeSet.has(acc.parentCode)).toBe(true);
      }
    }
  });

  it("correctly maps normal balances to account types", () => {
    expect(NORMAL_BALANCE_FOR_TYPE.asset).toBe("debit");
    expect(NORMAL_BALANCE_FOR_TYPE.expense).toBe("debit");
    expect(NORMAL_BALANCE_FOR_TYPE.liability).toBe("credit");
    expect(NORMAL_BALANCE_FOR_TYPE.equity).toBe("credit");
    expect(NORMAL_BALANCE_FOR_TYPE.revenue).toBe("credit");
  });
});
