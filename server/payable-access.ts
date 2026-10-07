type PayableLinks = { vehicleId?: number | null; maintenanceRequestId?: number | null };

/** Permissions required to inspect or mutate a payable's linked operational records. */
export function payableLinkPermissions(links: PayableLinks): string[] {
  const permissions = new Set<string>();
  if (links.vehicleId) {
    permissions.add("vehicles");
    permissions.add("finance");
  }
  if (links.maintenanceRequestId) {
    permissions.add("maintenance");
    permissions.add("finance");
  }
  return Array.from(permissions);
}
