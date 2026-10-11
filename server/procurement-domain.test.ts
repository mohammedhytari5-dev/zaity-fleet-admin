import { describe, expect, it } from "vitest";
import { calculateQuoteTotal, purchaseQuoteTotal, rankQuotes } from "./procurement-domain";

describe("quote total derivation", () => {
  it("derives the total from the quote's own parts", () => {
    expect(purchaseQuoteTotal({ unitPrice: 100, quantity: 3, taxAmount: 45 })).toBe(345);
  });

  it("uses the stated tax amount rather than re-deriving a fixed rate", () => {
    // A supplier quote can legitimately carry zero-rated or exempt lines, so
    // the stated tax is authoritative; only the total is derived.
    expect(purchaseQuoteTotal({ unitPrice: 100, quantity: 1, taxAmount: 0 })).toBe(100);
    expect(purchaseQuoteTotal({ unitPrice: 100, quantity: 1, taxAmount: 15 })).toBe(115);
  });

  it("supports halala precision", () => {
    // The old integer model could not represent these at all.
    expect(purchaseQuoteTotal({ unitPrice: 12.5, quantity: 4, taxAmount: 7.5 })).toBe(57.5);
    expect(purchaseQuoteTotal({ unitPrice: 0.07, quantity: 3, taxAmount: 0.03 })).toBe(0.24);
  });

  it("rounds the derived total to the stored scale", () => {
    // 3 x 33.333 = 99.999 -> 100.00
    expect(purchaseQuoteTotal({ unitPrice: 33.333, quantity: 3, taxAmount: 0 })).toBe(100);
  });

  it("defaults a missing quantity to one and missing parts to zero", () => {
    expect(purchaseQuoteTotal({ unitPrice: 50 })).toBe(50);
    expect(purchaseQuoteTotal({})).toBe(0);
  });

  it("cannot be influenced by a supplied total", () => {
    // The ranking reads totalAmount, so it must never come from the caller:
    // the function's input type has no totalAmount field at all.
    const quote = { unitPrice: 10, quantity: 2, taxAmount: 3, totalAmount: 999_999 } as const;
    expect(purchaseQuoteTotal(quote)).toBe(23);
  });
});

describe("quote total preview", () => {
  it("derives tax at the given rate with money rounding", () => {
    const result = calculateQuoteTotal(100, 3, 0.15);
    expect(result).toEqual({ subtotal: 300, taxAmount: 45, totalAmount: 345 });
  });

  it("keeps halala precision instead of rounding to whole riyals", () => {
    // Previously the unit price was rounded to an integer before multiplying.
    const result = calculateQuoteTotal(33.5, 3, 0.15);
    expect(result.subtotal).toBe(100.5);
    expect(result.taxAmount).toBe(15.08);
    expect(result.totalAmount).toBe(115.58);
  });

  it("never returns a negative subtotal and keeps quantity at least one", () => {
    expect(calculateQuoteTotal(-50, 0, 0.15)).toEqual({ subtotal: 0, taxAmount: 0, totalAmount: 0 });
  });
});

describe("quote ranking", () => {
  const base = {
    deliveryDays: 3,
    warrantyPeriod: "سنة",
    supplierRating: 4,
  };

  it("ranks the cheapest and fastest quote highest", () => {
    const ranked = rankQuotes([
      { id: 1, supplierName: "غالي", totalAmount: 200, ...base },
      { id: 2, supplierName: "رخيص وسريع", totalAmount: 100, deliveryDays: 1, warrantyPeriod: "سنة", supplierRating: 5 },
    ]);
    expect(ranked[0]?.quoteId).toBe(2);
    expect(ranked[0]?.isLowestPrice).toBe(true);
    expect(ranked[0]?.isFastestDelivery).toBe(true);
  });

  it("flags only the lowest price", () => {
    const ranked = rankQuotes([
      { id: 1, supplierName: "أ", totalAmount: 100, ...base },
      { id: 2, supplierName: "ب", totalAmount: 150, ...base },
    ]);
    expect(ranked.filter(q => q.isLowestPrice).map(q => q.quoteId)).toEqual([1]);
  });

  it("returns an empty list for no quotes", () => {
    expect(rankQuotes([])).toEqual([]);
  });

  it("tolerates a zero-priced quote without dividing by zero", () => {
    const ranked = rankQuotes([
      { id: 1, supplierName: "مجاني", totalAmount: 0, ...base },
      { id: 2, supplierName: "مدفوع", totalAmount: 100, ...base },
    ]);
    for (const quote of ranked) expect(Number.isFinite(quote.score)).toBe(true);
  });
});
