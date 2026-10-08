import { describe, expect, it } from "vitest";
import { isValidTaskRelation, taskRelatedEntityPermissions, taskRelatedEntityTypes } from "../shared/task-relations";

describe("task record links", () => {
  it("supports records from the operational and finance modules", () => {
    expect(taskRelatedEntityTypes).toContain("maintenance");
    expect(taskRelatedEntityTypes).toContain("payable");
    expect(taskRelatedEntityPermissions.maintenance).toBe("maintenance");
    expect(taskRelatedEntityPermissions.contract).toBe("finance");
  });

  it("requires either no link or a known record type and positive integer id", () => {
    expect(isValidTaskRelation(null, null)).toBe(true);
    expect(isValidTaskRelation("maintenance", 12)).toBe(true);
    expect(isValidTaskRelation("unknown", 12)).toBe(false);
    expect(isValidTaskRelation("maintenance", null)).toBe(false);
    expect(isValidTaskRelation(null, 12)).toBe(false);
    expect(isValidTaskRelation("maintenance", 0)).toBe(false);
    expect(isValidTaskRelation("maintenance", 1.5)).toBe(false);
  });
});
