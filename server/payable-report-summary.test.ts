import { describe, expect, it } from "vitest";
import { summarizePayableBalances } from "../shared/payable-report-summary";

describe("payable report balances", () => {
  it("keeps invoices awaiting finance approval separate from recognized liabilities", () => {
    expect(summarizePayableBalances([
      { amount: 500, paid: 0, status: "جديدة", dueDate: "2026-01-01" },
      { amount: 800, paid: 200, status: "مدفوعة جزئيًا", dueDate: "2026-01-01" },
      { amount: 100, paid: 0, status: "ملغاة", dueDate: "2026-01-01" },
    ], "2026-10-08")).toEqual({
      recognizedOutstanding: 600,
      overdueRecognizedCount: 1,
      pendingApprovalCount: 1,
      pendingApprovalAmount: 500,
    });
  });

  it("counts fully paid approved bills as recognized with no outstanding balance", () => {
    expect(summarizePayableBalances([
      { amount: 250, paid: 250, status: "مدفوعة", dueDate: "2026-01-01" },
    ], "2026-10-08")).toEqual({
      recognizedOutstanding: 0,
      overdueRecognizedCount: 0,
      pendingApprovalCount: 0,
      pendingApprovalAmount: 0,
    });
  });
});
