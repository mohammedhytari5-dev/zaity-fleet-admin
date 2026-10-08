import { documentModuleByType } from "./document-relations";

type StoredDocumentReference = { entityType: string; entityId: number | null };
type StoredPayableReference = { vehicleId: number | null; maintenanceRequestId: number | null };

export function requiredPermissionsForStoredFile(input: {
  documents?: StoredDocumentReference[];
  maintenanceQuoteCount?: number;
  maintenanceReceiptCount?: number;
  vehicleLedgerCount?: number;
  payables?: StoredPayableReference[];
}): string[] {
  const permissions = new Set<string>();
  for (const document of input.documents ?? []) {
    permissions.add("documents");
    if (document.entityId === null) continue;
    const module = documentModuleByType[document.entityType as keyof typeof documentModuleByType];
    // Unknown linked record types must fail closed for non-administrators.
    permissions.add(module ?? "__invalid_document_link__");
  }
  if (input.maintenanceQuoteCount) permissions.add("maintenance");
  if (input.maintenanceReceiptCount) {
    permissions.add("maintenance");
    permissions.add("finance");
  }
  if (input.vehicleLedgerCount) {
    permissions.add("vehicles");
    permissions.add("finance");
  }
  for (const payable of input.payables ?? []) {
    permissions.add("payables");
    if (payable.vehicleId !== null) {
      permissions.add("vehicles");
      permissions.add("finance");
    }
    if (payable.maintenanceRequestId !== null) {
      permissions.add("maintenance");
      permissions.add("finance");
    }
  }
  return Array.from(permissions);
}
