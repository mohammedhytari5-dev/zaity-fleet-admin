export const documentModuleByType = {
  "مركبة": "vehicles",
  "سائق": "drivers",
  "موظف": "employees",
  "مشروع": "projects",
  "عميل": "clients",
  "عقد": "finance",
  "مطالبة": "finance",
  "صيانة": "maintenance",
} as const;

export type DocumentEntityType = keyof typeof documentModuleByType;
type DocumentLink = { entityType: DocumentEntityType; entityId: number | null };

export function resolveDocumentLink(current: DocumentLink, patch: Partial<DocumentLink>): DocumentLink {
  return {
    entityType: patch.entityType ?? current.entityType,
    entityId: patch.entityId === undefined ? current.entityId : patch.entityId,
  };
}
