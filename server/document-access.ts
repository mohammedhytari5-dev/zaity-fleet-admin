import { documentModuleByType } from "./document-relations";

type DocumentLinkRecord = { entityId: number | null; entityType: string };

/** Keep the documents module permission from bypassing permissions on linked records. */
export function documentsVisibleTo<T extends DocumentLinkRecord>(
  records: T[],
  canAccessModule: (module: string) => boolean,
): T[] {
  return records.filter(record => {
    if (record.entityId === null) return true;
    const module = documentModuleByType[record.entityType as keyof typeof documentModuleByType];
    return module !== undefined && canAccessModule(module);
  });
}
