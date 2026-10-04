type LinkedDocument = { entityType?: string | null; entityId?: number | string | null };

export function isLinkedDocument(document: LinkedDocument, entityType: string, entityId: number): boolean {
  return String(document.entityType ?? "").trim() === entityType
    && Number(document.entityId) === entityId;
}
