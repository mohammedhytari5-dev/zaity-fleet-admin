import { describe, expect, it } from "vitest";
import { isProtectedLastAdminDemotion } from "./user-role-domain";

describe("last administrator protection", () => {
  it("blocks demoting the only active administrator", () => {
    expect(isProtectedLastAdminDemotion({ targetRole: "admin", targetActive: 1, nextRole: "user", activeAdminCount: 1 })).toBe(true);
  });

  it("allows demotion when another active administrator remains", () => {
    expect(isProtectedLastAdminDemotion({ targetRole: "admin", targetActive: 1, nextRole: "user", activeAdminCount: 2 })).toBe(false);
  });

  it("does not count an inactive administrator as the last usable admin", () => {
    expect(isProtectedLastAdminDemotion({ targetRole: "admin", targetActive: 0, nextRole: "user", activeAdminCount: 1 })).toBe(false);
  });
});
