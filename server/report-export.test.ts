import { describe, expect, it } from "vitest";
import { appendReportSummary } from "../client/src/lib/report-export";

describe("filtered report exports", () => {
  it("appends numeric totals to the filtered rows without altering the originals", () => {
    const rows = [{ ref: "CL-1", amount: 100, paid: 25 }, { ref: "CL-2", amount: 300, paid: 50 }];
    const exported = appendReportSummary(rows, ["ref", "amount", "paid"], [
      { key: "amount", value: 400 },
      { key: "paid", value: 75 },
    ]);
    expect(exported).toEqual([...rows, { ref: "الإجمالي (2)", amount: 400, paid: 75 }]);
    expect(rows).toHaveLength(2);
  });

  it("adds a matching row count to non-financial reports", () => {
    expect(appendReportSummary([{ name: "أحمد" }, { name: "خالد" }], ["name"], [])).toEqual([
      { name: "أحمد" },
      { name: "خالد" },
      { name: "عدد السجلات (2)" },
    ]);
  });

  it("leaves empty results without a misleading summary row", () => {
    expect(appendReportSummary([], ["ref"], [{ key: "amount", value: 0 }])).toEqual([]);
  });
});
