export type InventoryDirection = "استلام" | "صرف";

export function nextInventoryBalance(currentBalance: number, direction: InventoryDirection, quantity: number): number {
  const balance = Number(currentBalance);
  const amount = Number(quantity);
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("رصيد المخزون الحالي غير صالح");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
  const next = direction === "استلام" ? balance + amount : balance - amount;
  if (!Number.isSafeInteger(next)) throw new Error("الكمية تتجاوز الحد المدعوم");
  if (next < 0) throw new Error("لا يمكن صرف كمية أكبر من الرصيد المتوفر");
  return next;
}

export function inventoryStockStatus(onHand: number, reorderLevel: number): "نفد" | "منخفض" | "متوفر" {
  if (onHand <= 0) return "نفد";
  return onHand <= reorderLevel ? "منخفض" : "متوفر";
}

export type InventoryRequestStatus = "بانتظار الاعتماد" | "معتمد" | "مرفوض" | "مصروف";
export type InventoryRequestAction = "اعتماد" | "رفض" | "صرف";

export function nextInventoryRequestStatus(current: InventoryRequestStatus, action: InventoryRequestAction): InventoryRequestStatus {
  if (current === "بانتظار الاعتماد" && action === "اعتماد") return "معتمد";
  if (current === "بانتظار الاعتماد" && action === "رفض") return "مرفوض";
  if (current === "معتمد" && action === "صرف") return "مصروف";
  if (action === "صرف" && current !== "معتمد") throw new Error("يجب اعتماد طلب الصرف قبل إخراج الأصناف");
  throw new Error("تم اتخاذ قرار على هذا الطلب مسبقًا");
}

export function validateInventoryRequestAvailability(
  lines: Array<{ itemId: number; itemName: string; requestedQuantity: number }>,
  onHandByItem: ReadonlyMap<number, number>,
): void {
  const requestedByItem = new Map<number, { name: string; quantity: number }>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.requestedQuantity) || line.requestedQuantity <= 0) {
      throw new Error(`الكمية المطلوبة للصنف ${line.itemName} غير صالحة`);
    }
    const previous = requestedByItem.get(line.itemId);
    requestedByItem.set(line.itemId, {
      name: line.itemName,
      quantity: (previous?.quantity ?? 0) + line.requestedQuantity,
    });
  }

  for (const [itemId, request] of requestedByItem) {
    const available = onHandByItem.get(itemId);
    if (!Number.isSafeInteger(available) || available! < 0) {
      throw new Error(`تعذر التحقق من رصيد الصنف ${request.name}`);
    }
    if (request.quantity > available!) {
      throw new Error(`الرصيد غير كافٍ للصنف ${request.name}: المتوفر ${available} والمطلوب ${request.quantity}`);
    }
  }
}
