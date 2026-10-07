import { describe, expect, it } from "vitest";
import { vehicleRecordForViewer } from "./vehicle-access";

const vehicle = {
  id: 1, plate: "1234", purchasePrice: 50000, purchaseDate: "2026-01-01", inServiceDate: "2026-01-02",
  projectId: 2, project: "مشروع خاص", employeeId: 3, employee: "موظف خاص", driverId: 4, driver: "سائق خاص",
  clientId: 5, client: "عميل خاص", contractId: 6, contract: "عقد خاص", expenseTotal: 700,
};

describe("vehicle record access", () => {
  it("hides linked records and financial values without their module permissions", () => {
    const result = vehicleRecordForViewer(vehicle, module => module === "vehicles");
    expect(result).toMatchObject({
      id: 1, plate: "1234", projectId: null, project: "—", employeeId: null, employee: "—",
      driverId: null, driver: "—", clientId: null, client: "—", contractId: null, contract: "—",
    });
    expect(result).not.toHaveProperty("purchasePrice");
    expect(result).not.toHaveProperty("expenseTotal");
  });

  it("preserves only the relations granted to the viewer", () => {
    const result = vehicleRecordForViewer(vehicle, module => ["vehicles", "drivers", "clients", "finance"].includes(module));
    expect(result.driver).toBe("سائق خاص");
    expect(result.client).toBe("عميل خاص");
    expect(result.project).toBe("—");
    expect(result.employee).toBe("—");
    expect(result.contract).toBe("عقد خاص");
    expect(result.purchasePrice).toBe(50000);
  });
});
