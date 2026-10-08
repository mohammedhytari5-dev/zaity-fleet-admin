import { describe, expect, it } from "vitest";
import { linkedVehicleDriverNameUpdate } from "./driver-domain";

describe("driver and vehicle relationship updates", () => {
  it("synchronizes a changed driver name to the assigned vehicle", () => {
    expect(linkedVehicleDriverNameUpdate({ name: "Old name", vehicleId: 12 }, "New name"))
      .toEqual({ vehicleId: 12, name: "New name" });
  });

  it("does not produce a vehicle update when the driver is unassigned or unchanged", () => {
    expect(linkedVehicleDriverNameUpdate({ name: "Same name", vehicleId: 12 }, "Same name")).toBeNull();
    expect(linkedVehicleDriverNameUpdate({ name: "Old name", vehicleId: null }, "New name")).toBeNull();
    expect(linkedVehicleDriverNameUpdate({ name: "Old name", vehicleId: 12 }, undefined)).toBeNull();
  });
});
