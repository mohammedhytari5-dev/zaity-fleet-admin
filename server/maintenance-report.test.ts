import { describe, expect, it } from "vitest";
import { maintenanceExpenseTotalInPeriod } from "./maintenance-report";

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
});
