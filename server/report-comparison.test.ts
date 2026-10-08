import { describe, expect, it } from "vitest";
import { compareReportMetric, previousReportPeriod } from "../shared/report-comparison";

describe("report period comparisons", () => {
  it("builds an immediately preceding period with the same inclusive length", () => {
    expect(previousReportPeriod({ from: "2026-10-01", to: "2026-10-08" })).toEqual({ from: "2026-09-23", to: "2026-09-30" });
    expect(previousReportPeriod({ from: "2026-03-01", to: "2026-03-01" })).toEqual({ from: "2026-02-28", to: "2026-02-28" });
    expect(previousReportPeriod({ from: "2026-02-29", to: "2026-03-01" })).toBeNull();
    expect(previousReportPeriod({ from: "2026-10-02", to: "2026-10-01" })).toBeNull();
  });

  it("classifies change direction by whether an increase is favorable", () => {
    expect(compareReportMetric(120, 100, true)).toEqual({ change: 20, percent: 20, direction: "up", tone: "favorable" });
    expect(compareReportMetric(80, 100, false)).toEqual({ change: -20, percent: 20, direction: "down", tone: "favorable" });
    expect(compareReportMetric(0, 0)).toEqual({ change: 0, percent: 0, direction: "flat", tone: "neutral" });
    expect(compareReportMetric(25, 0)).toEqual({ change: 25, percent: null, direction: "new", tone: "favorable" });
  });
});
