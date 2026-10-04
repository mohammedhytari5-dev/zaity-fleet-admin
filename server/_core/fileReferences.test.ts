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
});
