import { describe, expect, it } from "vitest";
import { projectRecordForViewer } from "./project-access";

describe("project record access", () => {
  it("hides linked client, contract, manager, and vehicle counts without their permissions", () => {
    const record = { id: 1, name: "Project", clientId: 2, client: "Client", contractId: 3, contract: "CT-3", managerEmployeeId: 4, manager: "Employee", actualVehicles: 5 };
    expect(projectRecordForViewer(record, module => module === "projects")).toMatchObject({
      id: 1, name: "Project", clientId: null, client: "—", contractId: null, contract: "—",
      managerEmployeeId: null, manager: "—", actualVehicles: null,
    });
  });

  it("keeps only the links authorized for the viewer", () => {
    const record = { clientId: 2, client: "Client", contractId: 3, contract: "CT-3", managerEmployeeId: 4, manager: "Employee", actualVehicles: 5 };
    const scoped = projectRecordForViewer(record, module => ["clients", "employees"].includes(module));
    expect(scoped.client).toBe("Client");
    expect(scoped.contract).toBe("—");
    expect(scoped.manager).toBe("Employee");
    expect(scoped.actualVehicles).toBeNull();
  });
});
