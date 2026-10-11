export function summarizeInventoryReport(
  items: Array<{ onHand: number; reorderLevel: number }>,
  movements: Array<{ direction: string }>,
) {
  return {
    itemCount: items.length,
    lowStockCount: items.filter(item => item.onHand > 0 && item.onHand <= item.reorderLevel).length,
    emptyStockCount: items.filter(item => item.onHand <= 0).length,
    receivedMovements: movements.filter(movement => movement.direction === "استلام").length,
    issuedMovements: movements.filter(movement => movement.direction === "صرف").length,
  };
}
