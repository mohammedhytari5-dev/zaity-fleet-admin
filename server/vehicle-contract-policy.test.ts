import { describe, expect, it } from "vitest";
import { canAssignVehicleToContract, vehicleStatusAfterContractAssignment, vehicleStatusAfterContractRemoval } from "../shared/vehicle-contract-policy";

describe("vehicle contract status policy", () => {
  it("allows only available vehicles to be newly assigned", () => {
    expect(canAssignVehicleToContract({ status: "متاحة", currentContractId: null, targetContractId: 5 })).toBe(true);
    expect(canAssignVehicleToContract({ status: "متاحة", currentContractId: 8 })).toBe(false);
    expect(canAssignVehicleToContract({ status: "متاحة", currentContractId: 8, targetContractId: 5 })).toBe(false);
    expect(canAssignVehicleToContract({ status: "في الصيانة", currentContractId: null, targetContractId: 5 })).toBe(false);
    expect(canAssignVehicleToContract({ status: "متوقفة", currentContractId: null, targetContractId: 5 })).toBe(false);
  });

  it("keeps same-contract vehicles eligible without overriding their operational state", () => {
    expect(canAssignVehicleToContract({ status: "في الصيانة", currentContractId: 5, targetContractId: 5 })).toBe(true);
    expect(vehicleStatusAfterContractAssignment("مركبة وسائق", "في الصيانة")).toBe("في الصيانة");
    expect(vehicleStatusAfterContractAssignment("مركبة وسائق", "متاحة")).toBe("مؤجرة");
  });

  it("returns a vehicle to available only when its prior status was leased", () => {
    expect(vehicleStatusAfterContractRemoval("مؤجرة")).toBe("متاحة");
    expect(vehicleStatusAfterContractRemoval("في الصيانة")).toBe("في الصيانة");
    expect(vehicleStatusAfterContractRemoval("متوقفة")).toBe("متوقفة");
  });
});
