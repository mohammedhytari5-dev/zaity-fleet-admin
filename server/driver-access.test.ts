import { describe, expect, it } from "vitest";
import { driverRecordForViewer } from "./driver-access";

describe("driver record access", () => {
  it("hides the assigned vehicle without vehicle permission", () => {
    expect(driverRecordForViewer({ id: 1, name: "سائق", vehicleId: 12, vehicle: "1234" }, false)).toMatchObject({
      id: 1, name: "سائق", vehicleId: null, vehicle: "—",
    });
  });

  it("retains the vehicle assignment when authorized", () => {
    expect(driverRecordForViewer({ id: 1, vehicleId: 12, vehicle: "1234" }, true).vehicle).toBe("1234");
  });
});
