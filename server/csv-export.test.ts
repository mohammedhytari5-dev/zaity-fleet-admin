import { describe, expect, it } from "vitest";
import { serializeCsv } from "../client/src/lib/csv";

describe("CSV exports", () => {
  it("quotes delimiters and escapes embedded quotes and line breaks", () => {
    expect(serializeCsv(["الاسم", "ملاحظة"], [["عميل، أول", 'قال "مرحبًا"\nثم غادر']])).toBe('"الاسم","ملاحظة"\r\n"عميل، أول","قال ""مرحبًا""\nثم غادر"');
  });

  it("neutralizes formula-like text without changing numeric amounts", () => {
    expect(serializeCsv(["القيمة"], [["=1+1"], ["  +CMD()"], ["@SUM(A1:A2)"], [-120]])).toBe('"القيمة"\r\n"\'=1+1"\r\n"\'  +CMD()"\r\n"\'@SUM(A1:A2)"\r\n"-120"');
  });
});
