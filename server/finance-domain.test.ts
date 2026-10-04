import { describe, expect, it } from "vitest";
import { canUpdateClaim, validatePaymentLinkConsistency } from "./finance-domain";

describe("financial ledger invariants", () => {
  it("allows only defined claim status transitions", () => {
    expect(canUpdateClaim({ currentStatus: "جديدة", currentAmount: 1000, paid: 0, nextStatus: "تحت الإجراء" })).toBe(true);
    expect(canUpdateClaim({ currentStatus: "جديدة", currentAmount: 1000, paid: 0, nextStatus: "تم صرفها" })).toBe(false);
    expect(canUpdateClaim({ currentStatus: "تم صرفها", currentAmount: 1000, paid: 700, nextAmount: 900 })).toBe(false);
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
});
