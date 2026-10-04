import { describe, expect, it } from "vitest";
import { isSafeFileReference } from "./fileReferences";

describe("file reference validation", () => {
  it("accepts supported image and PDF data URLs and internal storage keys", () => {
    expect(isSafeFileReference("data:image/png;base64,aGVsbG8=")).toBe(true);
    expect(isSafeFileReference("data:application/pdf;base64,aGVsbG8=")).toBe(true);
    expect(isSafeFileReference("/manus-storage/receipts/invoice_12.pdf")).toBe(true);
  });

  it("rejects executable data URLs, insecure URLs, and traversal keys", () => {
    expect(isSafeFileReference("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeFileReference("javascript:alert(1)")).toBe(false);
    expect(isSafeFileReference("http://example.com/file.pdf")).toBe(false);
    expect(isSafeFileReference("/manus-storage/../private.pdf")).toBe(false);
  });

  it("enforces the 700 KB attachment limit on server supplied data URLs", () => {
    const withinLimit = Buffer.alloc(700_000).toString("base64");
    const aboveLimit = Buffer.alloc(700_001).toString("base64");
    expect(isSafeFileReference(`data:application/pdf;base64,${withinLimit}`)).toBe(true);
    expect(isSafeFileReference(`data:application/pdf;base64,${aboveLimit}`)).toBe(false);
    expect(isSafeFileReference("data:image/png;base64,aGVsbG8")).toBe(false);
  });
});
