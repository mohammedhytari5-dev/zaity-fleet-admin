export type NotificationModule = "dashboard" | "vehicles" | "projects" | "maintenance" | "documents" | "drivers" | "employees" | "clients" | "finance" | "payables";

const notificationTargets: Record<string, NotificationModule> = {
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

export function notificationTarget(entityType?: string | null): NotificationModule {
  return entityType ? notificationTargets[entityType] ?? "dashboard" : "dashboard";
}

export function notificationRecord<T extends { id?: number; entityType?: string | null; entityId?: number | null }>(
  notification: T,
  records: Partial<Record<NotificationModule, Array<{ id: number }>>>,
) {
  const target = notificationTarget(notification.entityType);
  if (target === "dashboard" || !notification.entityId) return { target, record: null };
  const record = records[target]?.find(item => item.id === notification.entityId) ?? null;
  return { target, record };
}
