import { describe, expect, it } from "vitest";
import { documentModuleByType, resolveDocumentLink } from "./document-relations";

describe("document relation authorization", () => {
  it("resolves the final link when only the entity type changes", () => {
    expect(resolveDocumentLink({ entityType: "مركبة", entityId: 41 }, { entityType: "عقد" }))
      .toEqual({ entityType: "عقد", entityId: 41 });
  });

  it("resolves replacement and cleared links", () => {
    const current = { entityType: "عميل" as const, entityId: 8 };
    expect(resolveDocumentLink(current, { entityType: "صيانة", entityId: 13 }))
      .toEqual({ entityType: "صيانة", entityId: 13 });
    expect(resolveDocumentLink(current, { entityId: null }))
      .toEqual({ entityType: "عميل", entityId: null });
  });

  it("maps every supported relation to its permission module", () => {
    expect(documentModuleByType["عقد"]).toBe("finance");
    expect(documentModuleByType["مطالبة"]).toBe("finance");
    expect(documentModuleByType["صيانة"]).toBe("maintenance");
    expect(documentModuleByType["حادث"]).toBe("accidents");
  });
});
