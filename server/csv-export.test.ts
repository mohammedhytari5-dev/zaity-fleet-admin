import { describe, expect, it } from "vitest";
import { serializeCsv, serializeExcelCsv, parseCsvText } from "../client/src/lib/csv";

describe("CSV exports", () => {
  it("quotes delimiters and escapes embedded quotes and line breaks", () => {
    expect(serializeCsv(["الاسم", "ملاحظة"], [["عميل، أول", 'قال "مرحبًا"\nثم غادر']])).toBe('"الاسم","ملاحظة"\r\n"عميل، أول","قال ""مرحبًا""\nثم غادر"');
  });

  it("neutralizes formula-like text without changing numeric amounts", () => {
    expect(serializeCsv(["القيمة"], [["=1+1"], ["  +CMD()"], ["@SUM(A1:A2)"], [-120]])).toBe('"القيمة"\r\n"\'=1+1"\r\n"\'  +CMD()"\r\n"\'@SUM(A1:A2)"\r\n"-120"');
  });

  it("serializes Excel-compatible CSV with UTF-8 BOM", () => {
    const excelCsv = serializeExcelCsv(["الاسم", "الرقم"], [["سائق 1", "050"]]);
    expect(excelCsv.startsWith("\ufeff")).toBe(true);
    expect(excelCsv).toContain('"الاسم","الرقم"');
  });

  it("correctly parses CSV files with or without sep= directive and with BOM", () => {
    const content = "sep=,\r\n\"الاسم\",\"الهاتف\"\r\n\"أحمد\",\"0501234567\"";
    const parsed = parseCsvText(content);
    expect(parsed).toEqual([{ "الاسم": "أحمد", "الهاتف": "0501234567" }]);

    const withBom = "\ufeff\"الاسم\",\"الهاتف\"\r\n\"أحمد\",\"0501234567\"";
    const parsedBom = parseCsvText(withBom);
    expect(parsedBom).toEqual([{ "الاسم": "أحمد", "الهاتف": "0501234567" }]);
  });
});
