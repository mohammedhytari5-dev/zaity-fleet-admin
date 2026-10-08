import { describe, expect, it } from "vitest";
import { formatCompanyDate, isCompanyDateBeforeToday, isExpiredOrWithinUpcomingDays, isWithinUpcomingDays, resolveDocumentStatus, resolveRenewalStatus } from "../shared/date-utils";

describe("upcoming date windows", () => {
  const today = new Date(2026, 9, 7, 12);

  it("includes today and the final included day, but excludes expired and later dates", () => {
    expect(isWithinUpcomingDays("2026-10-07", 60, today)).toBe(true);
    expect(isWithinUpcomingDays("٠٧/١٠/٢٠٢٦", 60, today)).toBe(true);
    expect(isWithinUpcomingDays("2026-12-06", 60, today)).toBe(true);
    expect(isWithinUpcomingDays("2026-10-06", 60, today)).toBe(false);
    expect(isWithinUpcomingDays("2026-12-07", 60, today)).toBe(false);
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(isWithinUpcomingDays("—", 60, today)).toBe(false);
    expect(isWithinUpcomingDays("2026-02-30", 60, today)).toBe(false);
  });

  it("uses the company calendar day across server timezone boundaries", () => {
    const lateUtc = new Date("2026-10-07T22:00:00.000Z"); // 01:00 on October 8 in Aden
    expect(formatCompanyDate(lateUtc)).toBe("2026-10-08");
    expect(isCompanyDateBeforeToday("2026-10-07", lateUtc)).toBe(true);
    expect(isCompanyDateBeforeToday("2026-10-08", lateUtc)).toBe(false);
    expect(isWithinUpcomingDays("2026-10-08", 0, lateUtc)).toBe(true);
    expect(isWithinUpcomingDays("2026-10-07", 0, lateUtc)).toBe(false);
    expect(resolveDocumentStatus("2026-10-07", "ساري", lateUtc)).toBe("منتهي");
  });

  it("counts expired and near-term renewal dates but not distant renewals", () => {
    expect(isExpiredOrWithinUpcomingDays("2026-10-06", 60, today)).toBe(true);
    expect(isExpiredOrWithinUpcomingDays("2026-12-06", 60, today)).toBe(true);
    expect(isExpiredOrWithinUpcomingDays("2026-12-07", 60, today)).toBe(false);
    expect(isExpiredOrWithinUpcomingDays("—", 60, today)).toBe(false);
  });

  it("classifies driver license renewals into actionable states", () => {
    expect(resolveRenewalStatus("2026-10-06", today)).toBe("منتهية");
    expect(resolveRenewalStatus("2026-12-06", today)).toBe("قريبة");
    expect(resolveRenewalStatus("2026-12-07", today)).toBe("سارية");
    expect(resolveRenewalStatus("—", today)).toBe("غير محددة");
  });

  it("derives document status from its actual expiry date", () => {
    expect(resolveDocumentStatus("2026-10-06", "ساري", today)).toBe("منتهي");
    expect(resolveDocumentStatus("2026-12-06", "منتهي", today)).toBe("قريبًا");
    expect(resolveDocumentStatus("2027-01-01", "قريبًا", today)).toBe("ساري");
    expect(resolveDocumentStatus("—", "متأخر", today)).toBe("متأخر");
  });
});
