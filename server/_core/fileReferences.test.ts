import { describe, expect, it } from "vitest";
import { isSafeFileReference } from "./fileReferences";

describe("file reference validation", () => {
  it("accepts supported image and PDF data URLs and internal storage keys", () => {
    expect(isSafeFileReference("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/b5sAAAAASUVORK5CYII=")).toBe(true);
    expect(isSafeFileReference(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString("base64")}`)).toBe(true);
    expect(isSafeFileReference(`data:image/gif;base64,${Buffer.from("GIF89a").toString("base64")}`)).toBe(true);
    const webp = Buffer.alloc(12); webp.write("RIFF", 0); webp.write("WEBP", 8);
    expect(isSafeFileReference(`data:image/webp;base64,${webp.toString("base64")}`)).toBe(true);
    expect(isSafeFileReference("data:application/pdf;base64,JVBERi0xLjQK")).toBe(true);
    expect(isSafeFileReference("/manus-storage/receipts/invoice_12.pdf")).toBe(true);
  });

  it("rejects executable data URLs, insecure URLs, and traversal keys", () => {
    expect(isSafeFileReference("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeFileReference("javascript:alert(1)")).toBe(false);
    expect(isSafeFileReference("http://example.com/file.pdf")).toBe(false);
    expect(isSafeFileReference("/manus-storage/../private.pdf")).toBe(false);
    expect(isSafeFileReference("data:image/png;base64,aGVsbG8=")).toBe(false);
    expect(isSafeFileReference("data:application/pdf;base64,aGVsbG8=")).toBe(false);
  });

  it("enforces the 700 KB attachment limit on server supplied data URLs", () => {
    const signature = Buffer.from("%PDF-1.4\n");
    const withinLimit = Buffer.concat([signature, Buffer.alloc(700_000 - signature.length)]).toString("base64");
    const aboveLimit = Buffer.concat([signature, Buffer.alloc(700_001 - signature.length)]).toString("base64");
    expect(isSafeFileReference(`data:application/pdf;base64,${withinLimit}`)).toBe(true);
    expect(isSafeFileReference(`data:application/pdf;base64,${aboveLimit}`)).toBe(false);
    expect(isSafeFileReference("data:image/png;base64,aGVsbG8")).toBe(false);
  });
});
