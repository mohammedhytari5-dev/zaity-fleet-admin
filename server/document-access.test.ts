import { describe, expect, it } from "vitest";
import { documentsVisibleTo } from "./document-access";

describe("documentsVisibleTo", () => {
  it("requires access to the linked module before exposing a document", () => {
    const records = [
      { id: 1, entityType: "مركبة", entityId: 8 },
      { id: 2, entityType: "عقد", entityId: 3 },
      { id: 3, entityType: "غير معروف", entityId: 4 },
      { id: 4, entityType: "عميل", entityId: null },
    ];
    const visible = documentsVisibleTo(records, module => module === "vehicles");
    expect(visible.map(record => record.id)).toEqual([1, 4]);
  });
});
