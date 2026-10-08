import { describe, expect, it } from "vitest";
import { groupIncomingPaymentsForReport, incomingPaymentRowsForReport } from "./report-ledger";

describe("incoming report ledger links", () => {
  it("attributes legacy claim-only payments to their claim's contract", () => {
    const result = groupIncomingPaymentsForReport([
      { id: 1, amount: 300, contractId: null, claimId: 7 },
      { id: 2, amount: 200, contractId: 4, claimId: null },
      { id: 3, amount: 50, contractId: null, claimId: 8 },
    ], [
      { id: 7, contractId: 4 },
      { id: 8, contractId: null },
    ]);
    expect(Object.fromEntries(result.byClaim)).toEqual({ 7: 300, 8: 50 });
    expect(Object.fromEntries(result.byContract)).toEqual({ 4: 500 });
  });

  it("resolves direct and legacy payment links into report-ready client, contract, and claim details", () => {
    const rows = incomingPaymentRowsForReport([
      { id: 1, amount: 300, paidAt: "2026-10-03", method: "تحويل بنكي", reference: "TX-1", contractId: null, claimId: 7, clientId: null },
      { id: 2, amount: 200, paidAt: "2026-10-04", method: "نقدًا", reference: "TX-2", contractId: 4, claimId: null, clientId: 9 },
    ], [
      { id: 7, ref: "CL-7", client: "عميل أ", clientId: 9, contract: "CN-4", contractId: 4 },
    ], [
      { id: 4, ref: "CN-4", client: "عميل أ", clientId: 9 },
    ], [
      { id: 9, name: "شركة أ" },
    ]);
    expect(rows).toEqual([
      { id: 1, paidAt: "2026-10-03", clientId: 9, client: "شركة أ", contract: "CN-4", claim: "CL-7", amount: 300, method: "تحويل بنكي", reference: "TX-1" },
      { id: 2, paidAt: "2026-10-04", clientId: 9, client: "شركة أ", contract: "CN-4", claim: "—", amount: 200, method: "نقدًا", reference: "TX-2" },
    ]);
  });
});
