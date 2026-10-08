import { describe, expect, it } from "vitest";
import { notificationRecord, notificationTarget } from "../client/src/lib/notification-target";

describe("notification destinations", () => {
  it("maps supported entity names to the correct workspace modules", () => {
    expect(notificationTarget("مركبة")).toBe("vehicles");
    expect(notificationTarget("مطالبة")).toBe("finance");
    expect(notificationTarget("فاتورة مورد")).toBe("payables");
    expect(notificationTarget("unexpected")).toBe("dashboard");
  });

  it("resolves a notification to its linked record when the client has it loaded", () => {
    const records = { maintenance: [{ id: 12, ref: "MT-12" }] };
    expect(notificationRecord({ entityType: "maintenance", entityId: 12 }, records)).toMatchObject({ target: "maintenance", record: { id: 12, ref: "MT-12" } });
    expect(notificationRecord({ entityType: "maintenance", entityId: 13 }, records)).toEqual({ target: "maintenance", record: null });
  });
});
