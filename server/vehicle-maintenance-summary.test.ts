import { describe, expect, it } from "vitest";
import { summarizeMaintenanceItems } from "./vehicle-maintenance-summary";

describe("summarizeMaintenanceItems", () => {
  it("includes only positive expenses linked to a maintenance item and groups them by item", () => {
    expect(summarizeMaintenanceItems([
      { maintenanceItem: "تغيير زيت", amount: 250 },
      { maintenanceItem: "تغيير إطارات", amount: 900 },
      { maintenanceItem: "تغيير زيت", amount: 150 },
      { maintenanceItem: null, amount: 700 },
      { maintenanceItem: "إصلاح المكيف", amount: 0 },
      { maintenanceItem: "   ", amount: 80 },
    ])).toEqual([
      { item: "تغيير إطارات", operations: 1, total: 900 },
      { item: "تغيير زيت", operations: 2, total: 400 },
    ]);
  });

  it("returns no rows when no periodic maintenance item has a recorded cost", () => {
    expect(summarizeMaintenanceItems([
      { maintenanceItem: null, amount: 100 },
      { maintenanceItem: "تغيير زيت", amount: 0 },
    ])).toEqual([]);
  });
});
