import { describe, expect, it } from "vitest";
import { isPayableExpensePosted } from "./payable-expense-policy";

describe("accounts payable expense posting", () => {
  it("posts an invoice only after approval and keeps it posted while paid", () => {
    expect(isPayableExpensePosted("جديدة")).toBe(false);
    expect(isPayableExpensePosted("معتمدة")).toBe(true);
    expect(isPayableExpensePosted("مدفوعة جزئيًا")).toBe(true);
    expect(isPayableExpensePosted("مدفوعة")).toBe(true);
    expect(isPayableExpensePosted("ملغاة")).toBe(false);
  });
});
