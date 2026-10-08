import { describe, expect, it } from "vitest";
import { deriveSingleVehicleAutoRevenues } from "./vehicle-revenue-allocation";

const base = {
  claims: [{ id: 6, contractId: 4 }],
  contracts: [{ id: 4, clientId: 8, client: "عميل ألف", ref: "CN-4" }, { id: 5, clientId: 9, client: "عميل باء", ref: "CN-5" }],
  contractItems: [{ contractId: 4, vehicleId: 12 }, { contractId: 5, vehicleId: 12 }, { contractId: 5, vehicleId: 13 }],
  vehicles: [
    { id: 12, contractId: null, projectId: 30, project: "مشروع ألف", clientId: 8, client: "عميل ألف", plate: "1234" },
    { id: 13, contractId: null, projectId: 30, project: "مشروع ألف", clientId: 9, client: "عميل باء", plate: "5678" },
  ],
  projects: [{ id: 30, contractId: 4, name: "مشروع العقد" }],
  clients: [{ id: 8, name: "عميل ألف" }, { id: 9, name: "عميل باء" }],
  allocations: [],
};

describe("single vehicle contract receipt allocation", () => {
  it("attributes a contract or claim receipt to the contract's only vehicle", () => {
    const result = deriveSingleVehicleAutoRevenues({
      ...base,
      payments: [
        { id: 1, amount: 500, contractId: 4, claimId: null, clientId: 8, paidAt: "2026-10-04" },
        { id: 2, amount: 300, contractId: null, claimId: 6, clientId: 8 },
      ],
    });
    expect(result.map(row => [row.vehicleId, row.amount])).toEqual([[12, 500], [12, 300]]);
    expect(result[0]).toMatchObject({ projectId: 30, projectName: "مشروع العقد", clientId: 8, contractRef: "CN-4", autoLinked: true });
  });

  it("subtracts active allocations and leaves multi-vehicle contract receipts unassigned", () => {
    const result = deriveSingleVehicleAutoRevenues({
      ...base,
      payments: [
        { id: 1, amount: 500, contractId: 4, claimId: null, clientId: 8 },
        { id: 2, amount: 300, contractId: 5, claimId: null, clientId: 9 },
      ],
      allocations: [{ paymentId: 1, amount: 175 }],
    });
    expect(result.map(row => [row.paymentId, row.vehicleId, row.amount])).toEqual([[1, 12, 325]]);
  });

  it("supports legacy contracts linked directly on the vehicle", () => {
    const result = deriveSingleVehicleAutoRevenues({
      ...base,
      contractItems: [],
      contracts: [{ id: 7, clientId: null, client: "عميل قديم", ref: "CN-7" }],
      vehicles: [{ id: 20, contractId: 7, projectId: 31, project: "مشروع قديم", clientId: null, client: "عميل قديم" }],
      payments: [{ id: 3, amount: 120, contractId: 7, claimId: null, clientId: null }],
    });
    expect(result[0]).toMatchObject({ vehicleId: 20, amount: 120, projectId: 31, clientName: "عميل قديم" });
  });
});
