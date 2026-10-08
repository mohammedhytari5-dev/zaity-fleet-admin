import { describe, expect, it } from "vitest";
import { inventoryStockStatus, nextInventoryBalance, nextInventoryRequestStatus, validateInventoryRequestAvailability } from "./inventory-domain";

describe("inventory stock rules", () => {
  it("adds receipts and subtracts issues", () => {
    expect(nextInventoryBalance(7, "استلام", 5)).toBe(12);
    expect(nextInventoryBalance(7, "صرف", 5)).toBe(2);
  });

  it("rejects invalid quantities and issues beyond available stock", () => {
    expect(() => nextInventoryBalance(4, "صرف", 5)).toThrow("لا يمكن صرف كمية أكبر من الرصيد المتوفر");
    expect(() => nextInventoryBalance(4, "استلام", 0)).toThrow("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
    expect(() => nextInventoryBalance(-1, "استلام", 1)).toThrow("رصيد المخزون الحالي غير صالح");
  });

  it("flags empty, low, and healthy stock", () => {
    expect(inventoryStockStatus(0, 4)).toBe("نفد");
    expect(inventoryStockStatus(4, 4)).toBe("منخفض");
    expect(inventoryStockStatus(5, 4)).toBe("متوفر");
  });

  it("enforces request approval before issue", () => {
    expect(nextInventoryRequestStatus("بانتظار الاعتماد", "اعتماد")).toBe("معتمد");
    expect(nextInventoryRequestStatus("بانتظار الاعتماد", "رفض")).toBe("مرفوض");
    expect(nextInventoryRequestStatus("معتمد", "صرف")).toBe("مصروف");
    expect(() => nextInventoryRequestStatus("بانتظار الاعتماد", "صرف")).toThrow("يجب اعتماد طلب الصرف قبل إخراج الأصناف");
    expect(() => nextInventoryRequestStatus("مصروف", "صرف")).toThrow("يجب اعتماد طلب الصرف قبل إخراج الأصناف");
    expect(() => nextInventoryRequestStatus("مصروف", "اعتماد")).toThrow("تم اتخاذ قرار على هذا الطلب مسبقًا");
  });

  it("requires enough stock before approving an issue request", () => {
    const lines = [
      { itemId: 1, itemName: "فلتر زيت", requestedQuantity: 3 },
      { itemId: 2, itemName: "سير", requestedQuantity: 2 },
    ];
    expect(() => validateInventoryRequestAvailability(lines, new Map([[1, 3], [2, 2]]))).not.toThrow();
    expect(() => validateInventoryRequestAvailability(lines, new Map([[1, 3], [2, 1]]))).toThrow("الرصيد غير كافٍ للصنف سير");
    expect(() => validateInventoryRequestAvailability([
      { itemId: 1, itemName: "فلتر زيت", requestedQuantity: 2 },
      { itemId: 1, itemName: "فلتر زيت", requestedQuantity: 2 },
    ], new Map([[1, 3]]))).toThrow("المتوفر 3 والمطلوب 4");
  });
});
