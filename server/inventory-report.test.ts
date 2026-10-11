import { describe, expect, it } from "vitest";
import { summarizeInventoryReport } from "./inventory-report";

describe("inventory report summaries", () => {
  it("counts low and empty items and movements without adding unlike units", () => {
    expect(summarizeInventoryReport(
      [
        { onHand: 0, reorderLevel: 4 },
        { onHand: 2, reorderLevel: 2 },
        { onHand: 8, reorderLevel: 2 },
      ],
      [
        { direction: "استلام" },
        { direction: "استلام" },
        { direction: "صرف" },
      ],
    )).toEqual({ itemCount: 3, lowStockCount: 1, emptyStockCount: 1, receivedMovements: 2, issuedMovements: 1 });
  });
});
