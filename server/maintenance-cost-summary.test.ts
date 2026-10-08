import { describe, expect, it } from "vitest";
import { summarizeMaintenanceCost } from "../shared/maintenance-cost-summary";

describe("maintenance invoice cost summary", () => {
  it("compares approved invoices with the quote and keeps pending invoices separate", () => {
    expect(summarizeMaintenanceCost({
      workshopQuote: 100,
      partsQuote: 300,
      recordedActual: "250 SAR",
      invoices: [
        { amount: 250, status: "معتمدة" },
        { amount: 100, status: "جديدة" },
        { amount: 90, status: "ملغاة" },
      ],
    })).toEqual({ estimate: 400, approvedActual: 250, pendingTotal: 100, recordedActual: 250, variance: -150, invoiceCount: 2, hasRecordedActualMismatch: false });
  });

  it("recognizes Arabic digits and flags a stale recorded actual cost", () => {
    const summary = summarizeMaintenanceCost({
      workshopQuote: "١٠٠ SAR",
      partsQuote: "٣٠٠",
      recordedActual: "0 SAR",
      invoices: [{ amount: "٤٠٠ ريال", status: "مدفوعة جزئيًا" }],
    });
    expect(summary.estimate).toBe(400);
    expect(summary.approvedActual).toBe(400);
    expect(summary.hasRecordedActualMismatch).toBe(true);
  });

  it("does not claim a variance when no estimate was entered", () => {
    expect(summarizeMaintenanceCost({ invoices: [{ amount: 80, status: "معتمدة" }] }).variance).toBeNull();
  });
});
