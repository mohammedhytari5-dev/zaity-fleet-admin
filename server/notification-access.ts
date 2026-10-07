const notificationModuleByEntityType: Record<string, string> = {
  vehicle: "vehicles", vehicles: "vehicles", "مركبة": "vehicles",
  driver: "drivers", drivers: "drivers", "سائق": "drivers",
  employee: "employees", employees: "employees", "موظف": "employees",
  project: "projects", projects: "projects", "مشروع": "projects",
  client: "clients", clients: "clients", "عميل": "clients",
  contract: "finance", claim: "finance", contract_payment: "finance", "عقد": "finance", "مطالبة": "finance",
  payable: "payables", payables: "payables", "فاتورة مورد": "payables",
  maintenance: "maintenance", "صيانة": "maintenance",
  document: "documents", documents: "documents", "مستند": "documents",
};

type NotificationRecord = { entityType?: string | null; entityId?: number | null };

export function notificationModule(record: NotificationRecord): string | null {
  if (!record.entityType && !record.entityId) return null;
  return record.entityType ? notificationModuleByEntityType[record.entityType] ?? "unknown" : "unknown";
}

export function notificationReadAtForUser<T>(legacyReadAt: T | null | undefined, userReadAt: T | null | undefined): T | null {
  return userReadAt ?? legacyReadAt ?? null;
}

export function notificationsVisibleTo<T extends NotificationRecord>(
  records: T[],
  hasPermission: (permission: string) => boolean,
): T[] {
  return records.filter(record => {
    const module = notificationModule(record);
    return module === null || (module !== "unknown" && hasPermission(module));
  });
}
