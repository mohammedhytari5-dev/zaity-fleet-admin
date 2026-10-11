import { describe, expect, it } from "vitest";
import { maintenanceExpenseTotalInPeriod, postedMaintenanceExpenseTotalInPeriod } from "./maintenance-report";

describe("maintenance spending report", () => {
  it("totals only maintenance expenses dated inside the selected period", () => {
    const expenses = [
      { category: "صيانة", amount: 300 },
      { category: "صيانة", amount: 125 },
      { category: "إطارات", amount: 900 },
    ];
    expect(maintenanceExpenseTotalInPeriod(expenses)).toBe(425);
  });

  it("returns zero when no maintenance expenses were posted", () => {
    expect(maintenanceExpenseTotalInPeriod([{ category: "تأمين", amount: 700 }])).toBe(0);
  });

  it("uses the same approval policy as financial reports", () => {
    expect(postedMaintenanceExpenseTotalInPeriod([
      { category: "صيانة", amount: 300, payableId: 10 },
      { category: "صيانة", amount: 200, payableId: 11 },
      { category: "صيانة", amount: 80, payableId: null },
      { category: "إطارات", amount: 90, payableId: null },
    ], [
      { id: 10, status: "معتمدة" },
      { id: 11, status: "جديدة" },
    ])).toBe(380);
  });
});
