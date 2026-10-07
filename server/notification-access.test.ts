import { describe, expect, it } from "vitest";
import { notificationModule, notificationsVisibleTo } from "./notification-access";

describe("notification access", () => {
  it("scopes linked notifications by entity module and keeps only global unlinked notices", () => {
    const records = [
      { id: 1, entityType: null, entityId: null },
      { id: 2, entityType: "maintenance", entityId: 4 },
      { id: 3, entityType: "claim", entityId: 7 },
      { id: 4, entityType: "unknown", entityId: 8 },
      { id: 5, entityType: null, entityId: 9 },
    ];
    expect(notificationsVisibleTo(records, permission => permission === "maintenance").map(row => row.id)).toEqual([1, 2]);
  });

  it("treats unknown linked event types as inaccessible", () => {
    expect(notificationModule({ entityType: "not-a-module", entityId: 1 })).toBe("unknown");
  });
});
