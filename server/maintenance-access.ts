const financeOnlyMaintenanceFields = [
  "cost",
  "laborCost",
  "partsCost",
  "receiptName",
  "receiptUrl",
  "fundingType",
  "fundingReference",
  "fundingAmount",
  "fundingRecipient",
  "advanceStatus",
  "advanceSettledAt",
  "advanceSettlementReference",
  "approvedByUserId",
  "approvedByName",
  "approvedAt",
  "approvalNotes",
  "fundingIssuedAt",
  "fundingIssuedByUserId",
  "fundingIssuedByName",
] as const;

export function maintenanceRecordForViewer<T extends object>(record: T, canViewFinance: boolean): T {
  const visible = { ...record } as Record<string, unknown>;
  if (!canViewFinance) financeOnlyMaintenanceFields.forEach(field => delete visible[field]);
  else delete visible.receiptUrl;
  return visible as T;
}

export function maintenanceEventForViewer<T extends { eventType: string; details?: unknown }>(event: T, canViewFinance: boolean): T {
  if (canViewFinance || (!event.eventType.startsWith("اعتماد الصيانة") && event.eventType !== "تسوية العهدة")) return event;
  return { ...event, details: null };
}
