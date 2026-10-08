import { describe, expect, it } from "vitest";
import { isValidReportPeriod, reportPeriodExclusiveEnd } from "./report-period";

describe("report period validation", () => {
  it("accepts real dates in ascending or equal order", () => {
    expect(isValidReportPeriod("2026-10-01", "2026-10-07")).toBe(true);
    expect(isValidReportPeriod("2026-10-07", "2026-10-07")).toBe(true);
  });

  it("rejects impossible dates and reversed ranges", () => {
    expect(isValidReportPeriod("2026-02-30", "2026-03-01")).toBe(false);
    expect(isValidReportPeriod("2026-10-08", "2026-10-07")).toBe(false);
    expect(isValidReportPeriod("not-a-date", "2026-10-07")).toBe(false);
  });

  it("returns the next calendar day as an exclusive SQL range boundary", () => {
    expect(reportPeriodExclusiveEnd("2026-10-08")).toBe("2026-10-09");
    expect(reportPeriodExclusiveEnd("2024-02-29")).toBe("2024-03-01");
    expect(reportPeriodExclusiveEnd("2026-02-30")).toBeNull();
  });
});
