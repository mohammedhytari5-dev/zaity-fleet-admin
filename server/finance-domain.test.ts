import { describe, expect, it } from "vitest";
import { canAcceptContractPayment, canArchiveClaim, canChangeClaimReferences, canSetContractCollection, canUpdateClaim, validateClaimContractLink, validatePaymentLinkConsistency } from "./finance-domain";

describe("financial ledger invariants", () => {
  it("does not allow collections above the contract total", () => {
    expect(canAcceptContractPayment({ total: 1000, collected: 700, amount: 300 })).toBe(true);
    expect(canAcceptContractPayment({ total: 1000, collected: 700, amount: 301 })).toBe(false);
    expect(canAcceptContractPayment({ total: 1000, collected: 1000, amount: 1 })).toBe(false);
    expect(canSetContractCollection({ total: 1000, targetCollected: 1100, ledgerCollected: 700 })).toBe(false);
    expect(canSetContractCollection({ total: 1000, targetCollected: 700, ledgerCollected: 700 })).toBe(true);
  });

  it("allows only defined claim status transitions", () => {
    expect(canUpdateClaim({ currentStatus: "جديدة", currentAmount: 1000, paid: 0, nextStatus: "تحت الإجراء" })).toBe(true);
    expect(canUpdateClaim({ currentStatus: "جديدة", currentAmount: 1000, paid: 0, nextStatus: "تم صرفها" })).toBe(false);
    expect(canUpdateClaim({ currentStatus: "تم صرفها", currentAmount: 1000, paid: 700, nextAmount: 900 })).toBe(false);
  });

  it("keeps customer and contract references stable while active payments exist", () => {
    expect(canChangeClaimReferences({ hasActivePayments: true, clientChanged: true, contractChanged: false })).toBe(false);
    expect(canChangeClaimReferences({ hasActivePayments: true, clientChanged: false, contractChanged: true })).toBe(false);
    expect(canChangeClaimReferences({ hasActivePayments: true, clientChanged: false, contractChanged: false })).toBe(true);
    expect(canChangeClaimReferences({ hasActivePayments: false, clientChanged: true, contractChanged: true })).toBe(true);
  });

  it("keeps claims with active financial receipts in the ledger", () => {
    expect(canArchiveClaim(true)).toBe(false);
    expect(canArchiveClaim(false)).toBe(true);
  });

  it("prevents a payment, claim, and contract from crossing client relationships", () => {
    expect(() => validatePaymentLinkConsistency({
      paymentClientId: 8,
      contractClientId: 8,
      claimClientId: 9,
      paymentContractId: 12,
      claimContractId: 12,
    })).toThrow("العميل المحدد لا يطابق عميل المطالبة");
    expect(() => validatePaymentLinkConsistency({
      contractClientId: 8,
      claimClientId: 8,
      paymentContractId: 12,
      claimContractId: 13,
    })).toThrow("المطالبة لا تتبع العقد المحدد");
    expect(() => validatePaymentLinkConsistency({
      paymentClientId: 8,
      contractClientId: 8,
      claimClientId: 8,
      paymentContractId: 12,
      claimContractId: 12,
    })).not.toThrow();
  });

  it("requires every new claim to reference the selected client's contract", () => {
    expect(() => validateClaimContractLink({ clientId: 7, clientName: "شركة ألف", contractClientId: 7, contractClientName: "شركة ألف" })).not.toThrow();
    expect(() => validateClaimContractLink({ clientId: 7, clientName: "شركة ألف", contractClientId: 8, contractClientName: "شركة باء" })).toThrow("العقد المختار لا يتبع العميل المحدد");
    expect(() => validateClaimContractLink({ clientId: 7, clientName: "شركة ألف", contractClientId: null, contractClientName: "شركة ألف" })).not.toThrow();
    expect(() => validateClaimContractLink({ clientId: 7, clientName: "شركة ألف", contractClientId: null, contractClientName: "شركة باء" })).toThrow("العقد المختار لا يتبع العميل المحدد");
    expect(() => validateClaimContractLink({ clientId: null, clientName: "شركة ألف", contractClientId: null, contractClientName: "شركة ألف" })).toThrow("اختر عميلًا مسجلًا للمطالبة");
  });
});
