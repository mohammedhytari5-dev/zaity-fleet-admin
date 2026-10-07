import { describe, expect, it } from "vitest";
import { payableLinkPermissions, payablesVisibleTo } from "./payable-access";

describe("payableLinkPermissions", () => {
  it("requires each linked module permission in addition to finance", () => {
    expect(payableLinkPermissions({ vehicleId: 9, maintenanceRequestId: 2 })).toEqual(["vehicles", "finance", "maintenance"]);
    expect(payableLinkPermissions({ vehicleId: 9 })).toEqual(["vehicles", "finance"]);
    expect(payableLinkPermissions({ maintenanceRequestId: 2 })).toEqual(["maintenance", "finance"]);
    expect(payableLinkPermissions({})).toEqual([]);
  });

  it("does not expose linked supplier invoices without every linked module permission", () => {
    const records = [
      { id: 1, vehicleId: null, maintenanceRequestId: null },
      { id: 2, vehicleId: 5, maintenanceRequestId: null },
      { id: 3, vehicleId: 5, maintenanceRequestId: 8 },
    ];
    expect(payablesVisibleTo(records, permission => permission === "vehicles" || permission === "finance").map(row => row.id)).toEqual([1, 2]);
    expect(payablesVisibleTo(records, permission => permission === "payables").map(row => row.id)).toEqual([1]);
  });
});
