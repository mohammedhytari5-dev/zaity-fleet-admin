import { describe, expect, it } from "vitest";
import { contractRecordForViewer } from "./contract-access";

describe("contract record access", () => {
  const contract = { id: 1, clientId: 2, client: "عميل سري", items: [{ vehicleId: 3, vehiclePlate: "1234", driver: "سائق سري" }] };

  it("hides client and vehicle details without their permissions", () => {
    expect(contractRecordForViewer(contract, module => module === "finance")).toMatchObject({
      clientId: null, client: "—", items: [],
    });
  });

  it("hides driver identity independently from authorized vehicle details", () => {
    const result = contractRecordForViewer(contract, module => ["finance", "clients", "vehicles"].includes(module));
    expect(result.client).toBe("عميل سري");
    expect(result.items[0]).toMatchObject({ vehicleId: 3, vehiclePlate: "1234", driver: "—" });
  });
});
