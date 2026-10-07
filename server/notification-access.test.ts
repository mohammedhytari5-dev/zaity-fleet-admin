import { describe, expect, it } from "vitest";
import { notificationModule, notificationReadAtForUser, notificationsVisibleTo } from "./notification-access";

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

  it("uses per-user read state while preserving legacy read timestamps", () => {
    const legacy = new Date("2026-10-01T00:00:00Z");
    const personal = new Date("2026-10-02T00:00:00Z");
    expect(notificationReadAtForUser(legacy, personal)).toBe(personal);
    expect(notificationReadAtForUser(legacy, null)).toBe(legacy);
    expect(notificationReadAtForUser(null, null)).toBeNull();
  });
});
