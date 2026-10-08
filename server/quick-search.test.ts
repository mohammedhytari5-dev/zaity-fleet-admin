import { describe, expect, it } from "vitest";
import { filterQuickSearch, matchesQuickSearch, normalizeQuickSearch } from "../client/src/lib/quick-search";

describe("quick search", () => {
  it("normalizes Arabic alef variants and diacritics", () => {
    expect(normalizeQuickSearch("إِبْرَاهِيم")).toBe("ابراهيم");
  });

  it("normalizes Arabic and Persian numerals and repeated spaces", () => {
    expect(normalizeQuickSearch("لوحة ١٢٣   ۴۵۶")).toBe("لوحة 123 456");
  });

  it("finds matching records and enforces its result limit", () => {
    const rows = [{ name: "مركبة ألف" }, { name: "مركبة باء" }, { name: "سائق" }];
    expect(filterQuickSearch(rows, "مركبة", row => row.name, 1)).toEqual([rows[0]]);
  });

  it("does not return all records for an empty query", () => {
    expect(filterQuickSearch([{ name: "عميل" }], "  ", row => row.name)).toEqual([]);
  });

  it("matches Arabic and Persian digits and normalizes diacritics in records", () => {
    expect(matchesQuickSearch({ plate: "أ ب ج ١٢٣", name: "مُحمّد" }, "ابج 123")).toBe(true);
  });

  it("excludes file payloads and URL/token fields from searchable text", () => {
    expect(matchesQuickSearch({ name: "فاتورة", fileUrl: "data:application/pdf;base64,secretpayload", receiptUrl: "/manus-storage/private-secret.pdf" }, "secretpayload")).toBe(false);
    expect(matchesQuickSearch({ name: "فاتورة", fileUrl: "data:application/pdf;base64,secretpayload" }, "فاتورة")).toBe(true);
  });
});
