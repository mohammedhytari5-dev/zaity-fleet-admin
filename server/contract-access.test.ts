import { describe, expect, it } from "vitest";
import { claimRecordForViewer, contractRecordForViewer, paymentRecordForViewer } from "./contract-access";

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

describe("claim record access", () => {
  it("hides client identity from finance users without client access", () => {
    expect(claimRecordForViewer({ id: 7, clientId: 2, client: "عميل سري", amount: 100 }, module => module === "finance"))
      .toMatchObject({ clientId: null, client: "—", amount: 100 });
  });

  it("keeps client identity for users with client access", () => {
    const claim = { id: 7, clientId: 2, client: "عميل مسموح" };
    expect(claimRecordForViewer(claim, module => ["finance", "clients"].includes(module))).toEqual(claim);
  });
});

describe("payment record access", () => {
  it("removes the client reference when the viewer lacks client access", () => {
    expect(paymentRecordForViewer({ id: 9, clientId: 2, amount: 50, reference: "تحويل" }, module => module === "finance"))
      .toMatchObject({ clientId: null, amount: 50, reference: "تحويل" });
  });

  it("preserves the client reference for authorized viewers", () => {
    const payment = { id: 9, clientId: 2, amount: 50 };
    expect(paymentRecordForViewer(payment, module => ["finance", "clients"].includes(module))).toEqual(payment);
  });
});
