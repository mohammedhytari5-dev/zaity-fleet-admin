import { describe, expect, it } from "vitest";
import { isOptionalFixedLengthIdentity, normalizeIdentityNumber, normalizeNumericInput } from "../shared/identity-number";

describe("identity number normalization", () => {
  it("converts Arabic and Persian numerals without changing leading zeros", () => {
    expect(normalizeIdentityNumber("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(normalizeIdentityNumber("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("accepts only an empty value or the requested digit length", () => {
    expect(isOptionalFixedLengthIdentity("—", 10)).toBe(true);
    expect(isOptionalFixedLengthIdentity("", 10)).toBe(true);
    expect(isOptionalFixedLengthIdentity("٠١٢٣٤٥٦٧٨٩", 10)).toBe(true);
    expect(isOptionalFixedLengthIdentity("123456789", 10)).toBe(false);
    expect(isOptionalFixedLengthIdentity("12345678901", 10)).toBe(false);
    expect(isOptionalFixedLengthIdentity("12345A7890", 10)).toBe(false);
  });

  it("limits numeric form input and strips non-digits", () => {
    expect(normalizeNumericInput("١٢٣-٤٥٦٧٨٩٠١٢٣٤٥", 15)).toBe("123456789012345");
  });
});
