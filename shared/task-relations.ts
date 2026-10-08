export const taskRelatedEntityTypes = [
  "vehicle",
  "maintenance",
  "project",
  "document",
  "driver",
  "employee",
  "client",
  "contract",
  "claim",
  "payable",
] as const;

export type TaskRelatedEntityType = typeof taskRelatedEntityTypes[number];

export const taskRelatedEntityPermissions: Record<TaskRelatedEntityType, string> = {
  vehicle: "vehicles",
  maintenance: "maintenance",
  project: "projects",
  document: "documents",
  driver: "drivers",
  employee: "employees",
  client: "clients",
  contract: "finance",
  claim: "finance",
  payable: "payables",
};

export function isValidTaskRelation(type: string | null | undefined, id: number | null | undefined): boolean {
  return (type == null && id == null) ||
    (taskRelatedEntityTypes.includes(type as TaskRelatedEntityType) && Number.isInteger(id) && Number(id) > 0);
}
