export function vehicleRecordForViewer<T extends object>(
  record: T,
  canAccessModule: (module: string) => boolean,
): T {
  const scoped = { ...record } as unknown as Record<string, unknown>;
  if (!canAccessModule("finance")) {
    delete scoped.purchasePrice;
    delete scoped.purchaseDate;
    delete scoped.inServiceDate;
    delete scoped.expenseTotal;
    delete scoped.revenueTotal;
    delete scoped.netOperatingReturn;
    scoped.contractId = null;
    scoped.contract = "—";
  }
  if (!canAccessModule("projects")) { scoped.projectId = null; scoped.project = "—"; }
  if (!canAccessModule("employees")) { scoped.employeeId = null; scoped.employee = "—"; }
  if (!canAccessModule("drivers")) { scoped.driverId = null; scoped.driver = "—"; }
  if (!canAccessModule("clients")) { scoped.clientId = null; scoped.client = "—"; }
  return scoped as T;
}
