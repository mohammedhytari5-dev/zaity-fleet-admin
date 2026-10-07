export function contractRecordForViewer<T extends object>(
  record: T,
  canAccessModule: (module: string) => boolean,
): T {
  const scoped = { ...record } as unknown as Record<string, unknown>;
  if (!canAccessModule("clients")) { scoped.clientId = null; scoped.client = "—"; }
  if (Array.isArray(scoped.items)) {
    if (!canAccessModule("vehicles")) scoped.items = [];
    else if (!canAccessModule("drivers")) scoped.items = scoped.items.map((item: Record<string, unknown>) => ({ ...item, driver: "—" }));
  }
  return scoped as T;
}
