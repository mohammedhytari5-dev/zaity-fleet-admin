export function projectRecordForViewer<T extends object>(
  record: T,
  canAccessModule: (module: string) => boolean,
): T {
  const scoped = { ...record } as unknown as Record<string, unknown>;
  if (!canAccessModule("clients")) { scoped.clientId = null; scoped.client = "—"; }
  if (!canAccessModule("finance")) { scoped.contractId = null; scoped.contract = "—"; }
  if (!canAccessModule("employees")) { scoped.managerEmployeeId = null; scoped.manager = "—"; }
  if (!canAccessModule("vehicles")) scoped.actualVehicles = null;
  return scoped as T;
}
