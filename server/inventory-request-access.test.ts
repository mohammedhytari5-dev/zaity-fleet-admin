import { describe, expect, it } from "vitest";
import { inventoryRequestOwnerFilter } from "./inventory-request-access";

describe("inventory request visibility", () => {
  it("limits inventory workers to their own requests", () => {
    expect(inventoryRequestOwnerFilter({ id: 23, role: "user" }, false)).toBe(23);
  });

  it("allows finance approvers and admins to see all requests", () => {
    expect(inventoryRequestOwnerFilter({ id: 23, role: "user" }, true)).toBeUndefined();
    expect(inventoryRequestOwnerFilter({ id: 1, role: "admin" }, false)).toBeUndefined();
  });
});
