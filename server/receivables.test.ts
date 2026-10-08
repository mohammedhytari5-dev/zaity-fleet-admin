import { describe, expect, it } from "vitest";
import { countOutstandingClaims, outstandingClaimAmount, receivableAging, totalOutstandingClaims } from "../shared/receivables";

describe("receivable balances", () => {
  const claims = [
    { status: "غير مرفوعة", amount: 800, paid: 0 },
    { status: "جديدة", amount: 1200, paid: 200 },
    { status: "تم اعتمادها", amount: 500, paid: 500 },
    { status: "مرفوضة", amount: 300, paid: 0 },
    { status: "ملغاة", amount: 250, paid: 50 },
  ];

  it("excludes drafts and cancelled or rejected claims from receivables", () => {
    expect(outstandingClaimAmount(claims[0])).toBe(0);
    expect(outstandingClaimAmount(claims[3])).toBe(0);
    expect(outstandingClaimAmount(claims[4])).toBe(0);
  });

  it("counts only positive balances and sums the remaining amount", () => {
    expect(totalOutstandingClaims(claims)).toBe(1000);
    expect(countOutstandingClaims(claims)).toBe(1);
  });

  it("classifies current receivables by days past due using the company calendar", () => {
    const today = new Date(2026, 9, 7, 12);
    expect(receivableAging("2026-10-07", today)).toEqual({ daysOverdue: 0, agingBucket: "غير مستحق" });
    expect(receivableAging("2026-09-07", today)).toEqual({ daysOverdue: 30, agingBucket: "1–30 يوم" });
    expect(receivableAging("2026-08-08", today)).toEqual({ daysOverdue: 60, agingBucket: "31–60 يوم" });
    expect(receivableAging("2026-08-07", today)).toEqual({ daysOverdue: 61, agingBucket: "أكثر من 60 يوم" });
    expect(receivableAging("2026-10-08", today)).toEqual({ daysOverdue: 0, agingBucket: "غير مستحق" });
    expect(receivableAging("—", today)).toEqual({ daysOverdue: null, agingBucket: "غير محدد" });
  });
});
