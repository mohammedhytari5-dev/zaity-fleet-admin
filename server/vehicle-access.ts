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

export function vehicleFinancialProfileForViewer<T extends object>(
  profile: T,
  canAccessModule: (module: string) => boolean,
): T {
  const scoped = { ...profile } as unknown as Record<string, unknown>;
  const vehicle = scoped.vehicle;
  if (vehicle && typeof vehicle === "object") scoped.vehicle = vehicleRecordForViewer(vehicle as object, canAccessModule);
  if (!canAccessModule("clients")) {
    scoped.client = "—";
    for (const key of ["revenues", "allocatablePayments"]) {
      if (Array.isArray(scoped[key])) scoped[key] = (scoped[key] as Array<Record<string, unknown>>).map(item => ({ ...item, client: "—", clientId: null, clientName: "—" }));
    }
  }
  if (!canAccessModule("projects")) {
    scoped.project = "—";
    if (Array.isArray(scoped.revenues)) scoped.revenues = (scoped.revenues as Array<Record<string, unknown>>).map(item => ({ ...item, projectId: null, projectName: "—" }));
  }
  if (!canAccessModule("maintenance")) {
    if (Array.isArray(scoped.expenses)) scoped.expenses = (scoped.expenses as Array<Record<string, unknown>>).map(({ maintenanceItem: _maintenanceItem, ...item }) => item);
    scoped.maintenanceItemTotals = [];
  }
  return scoped as T;
}
