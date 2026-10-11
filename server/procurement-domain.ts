import { multiplyMoney, roundMoney } from "../shared/money";

export type PurchaseRequestPriority = "عادي" | "متوسط" | "عاجل" | "طارئ";
export type PurchaseRequestStatus =
  | "جديد"
  | "بانتظار العروض"
  | "قيد المقارنة"
  | "معتمد"
  | "أمر شراء صادر"
  | "مرفوض"
  | "مكتمل";

export interface QuoteComparisonSummary {
  quoteId: number;
  supplierName: string;
  totalAmount: number;
  deliveryDays: number;
  warrantyPeriod: string;
  supplierRating: number;
  isLowestPrice: boolean;
  isFastestDelivery: boolean;
  score: number;
}

/**
 * Canonical quote total.
 *
 * `totalAmount` decides the award ranking, so it is always derived from the
 * quote's own parts and never accepted from the client. The stated tax amount is
 * used as-is rather than re-derived at a fixed rate, because a supplier quote can
 * legitimately carry zero-rated or exempt lines.
 */
export function purchaseQuoteTotal(quote: {
  quantity?: number | null;
  unitPrice?: number | null;
  taxAmount?: number | null;
}): number {
  const subtotal = multiplyMoney(quote.unitPrice ?? 0, quote.quantity ?? 1);
  return roundMoney(subtotal + (quote.taxAmount ?? 0));
}

/**
 * Preview helper that derives the tax at a given rate, for the entry form.
 * Rounds to the stored money scale so the preview matches what will be saved.
 */
export function calculateQuoteTotal(
  unitPrice: number,
  quantity: number,
  vatRate = 0.15
): { subtotal: number; taxAmount: number; totalAmount: number } {
  const cleanPrice = Math.max(0, unitPrice);
  const cleanQty = Math.max(1, Math.round(quantity));
  const subtotal = multiplyMoney(cleanPrice, cleanQty);
  const taxAmount = roundMoney(subtotal * vatRate);
  return { subtotal, taxAmount, totalAmount: roundMoney(subtotal + taxAmount) };
}

/**
 * مقارنة عروض الأسعار وتقييمها تلقائياً للمساعدة في اتخاذ القرار
 */
export function rankQuotes(quotes: Array<{
  id: number;
  supplierName: string;
  totalAmount: number;
  deliveryDays: number;
  warrantyPeriod: string;
  supplierRating: number;
}>): QuoteComparisonSummary[] {
  if (quotes.length === 0) return [];

  const minPrice = Math.min(...quotes.map(q => q.totalAmount).filter(p => p > 0)) || 1;
  const minDays = Math.min(...quotes.map(q => q.deliveryDays).filter(d => d > 0)) || 1;

  return quotes.map(q => {
    // تقييم مركب: 50% للسعر الأقل، 25% لسرعة التوريد، 25% لتقييم المورد
    const priceScore = q.totalAmount > 0 ? (minPrice / q.totalAmount) * 50 : 0;
    const deliveryScore = q.deliveryDays > 0 ? (minDays / q.deliveryDays) * 25 : 0;
    const ratingScore = (Math.min(5, Math.max(1, q.supplierRating)) / 5) * 25;
    const score = Math.round(priceScore + deliveryScore + ratingScore);

    return {
      quoteId: q.id,
      supplierName: q.supplierName,
      totalAmount: q.totalAmount,
      deliveryDays: q.deliveryDays,
      warrantyPeriod: q.warrantyPeriod,
      supplierRating: q.supplierRating,
      isLowestPrice: q.totalAmount === minPrice,
      isFastestDelivery: q.deliveryDays === minDays,
      score,
    };
  }).sort((a, b) => b.score - a.score);
}
