export function driverRecordForViewer<T extends object>(
  record: T,
  canAccessVehicles: boolean,
): T {
  if (canAccessVehicles) return record;
  const scoped = { ...record } as unknown as Record<string, unknown>;
  scoped.vehicleId = null;
  scoped.vehicle = "—";
  return scoped as T;
}
