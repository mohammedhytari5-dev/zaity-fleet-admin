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

export function claimRecordForViewer<T extends object>(
  record: T,
  canAccessModule: (module: string) => boolean,
): T {
  if (canAccessModule("clients")) return record;
  const scoped = { ...record } as unknown as Record<string, unknown>;
  scoped.clientId = null;
  scoped.client = "—";
  return scoped as T;
}

export function paymentRecordForViewer<T extends object>(
  record: T,
  canAccessModule: (module: string) => boolean,
): T {
  if (canAccessModule("clients")) return record;
  const scoped = { ...record } as unknown as Record<string, unknown>;
  scoped.clientId = null;
  return scoped as T;
}
