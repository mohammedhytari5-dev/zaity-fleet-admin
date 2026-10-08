import { describe, expect, it } from "vitest";
import { requiredPermissionsForStoredFile } from "./stored-file-access";

describe("stored file authorization", () => {
  it("requires both document access and linked-record access", () => {
    expect(requiredPermissionsForStoredFile({ documents: [{ entityType: "عقد", entityId: 9 }] }).sort()).toEqual(["documents", "finance"]);
  });

  it("fails closed for unknown linked document types", () => {
    expect(requiredPermissionsForStoredFile({ documents: [{ entityType: "نوع قديم", entityId: 9 }] })).toEqual(["documents", "__invalid_document_link__"]);
  });

  it("unions permissions from every record sharing the same file key", () => {
    expect(requiredPermissionsForStoredFile({
      documents: [{ entityType: "مركبة", entityId: 4 }, { entityType: "عميل", entityId: 8 }],
      payables: [{ vehicleId: null, maintenanceRequestId: 2 }],
    }).sort()).toEqual(["clients", "documents", "finance", "maintenance", "payables", "vehicles"]);
  });

  it("allows an unlinked document to require only document access", () => {
    expect(requiredPermissionsForStoredFile({ documents: [{ entityType: "مركبة", entityId: null }] })).toEqual(["documents"]);
  });

  it("requires accident access for documents linked to an accident", () => {
    expect(requiredPermissionsForStoredFile({ documents: [{ entityType: "حادث", entityId: 21 }] }).sort()).toEqual(["accidents", "documents"]);
  });

  it("allows procurement to preview a maintenance quote with maintenance access", () => {
    expect(requiredPermissionsForStoredFile({ maintenanceQuoteCount: 1 })).toEqual(["maintenance"]);
  });

  it("keeps maintenance receipts restricted to maintenance and finance", () => {
    expect(requiredPermissionsForStoredFile({ maintenanceReceiptCount: 1 }).sort()).toEqual(["finance", "maintenance"]);
  });
});
