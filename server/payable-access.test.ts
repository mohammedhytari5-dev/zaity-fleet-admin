import { describe, expect, it } from "vitest";
import { payableLinkPermissions } from "./payable-access";

describe("payableLinkPermissions", () => {
  it("requires each linked module permission in addition to finance", () => {
    expect(payableLinkPermissions({ vehicleId: 9, maintenanceRequestId: 2 })).toEqual(["vehicles", "finance", "maintenance"]);
    expect(payableLinkPermissions({ vehicleId: 9 })).toEqual(["vehicles", "finance"]);
    expect(payableLinkPermissions({ maintenanceRequestId: 2 })).toEqual(["maintenance", "finance"]);
    expect(payableLinkPermissions({})).toEqual([]);
  });
});
