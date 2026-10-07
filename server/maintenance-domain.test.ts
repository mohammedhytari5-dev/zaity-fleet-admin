import { describe, expect, it } from "vitest";
import { canAdvanceMaintenance, nextMaintenanceStages } from "../shared/maintenance-domain";

describe("maintenance workflow", () => {
  it("offers optional post-repair inspection after execution", () => {
    expect(nextMaintenanceStages("تنفيذ")).toEqual(["فحص بعد الإصلاح", "مغلق"]);
    expect(canAdvanceMaintenance({ from: "تنفيذ", to: "فحص بعد الإصلاح", approvalStatus: "معتمد" })).toBe(true);
    expect(canAdvanceMaintenance({ from: "تنفيذ", to: "مغلق", approvalStatus: "معتمد" })).toBe(true);
  });

  it("requires approval before closing an approved workflow", () => {
    expect(canAdvanceMaintenance({ from: "تنفيذ", to: "مغلق", approvalStatus: "بانتظار الاعتماد" })).toBe(false);
  });
});
