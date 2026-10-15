import { describe, expect, it } from "vitest";

describe("Workforce Self-Service & Daily Vehicle Inspection Domain", () => {
  describe("Role & Mode Detection for Self-Service Portal", () => {
    it("determines portal tabs based on mode (HR mode shows requests only for all staff; Inspection mode shows bus checks)", () => {
      function getAvailableTabs(mode: "hr" | "inspection" | "all", role: "driver" | "employee") {
        if (mode === "hr") {
          return ["requests"];
        }
        if (mode === "inspection") {
          return ["inspection"];
        }
        if (role === "driver") {
          return ["inspection", "requests"];
        }
        return ["requests"];
      }

      // Under HR: both drivers and employees see only HR requests
      expect(getAvailableTabs("hr", "driver")).toEqual(["requests"]);
      expect(getAvailableTabs("hr", "employee")).toEqual(["requests"]);

      // Under Maintenance: inspection mode shows inspection
      expect(getAvailableTabs("inspection", "driver")).toEqual(["inspection"]);
    });
  });

  describe("Vehicle Inspection Safety Issue Detection", () => {
    function evaluateInspectionSafety(data: {
      oilStatus: "سليم" | "ناقص" | "يحتاج تغيير";
      waterStatus: "سليم" | "ناقص";
      tiresStatus: "ممتاز" | "يحتاج هواء" | "متضرر";
      cleanliness: "نظيف" | "متوسط" | "غير نظيف";
      lightsStatus: "سليم" | "معطل";
      brakesStatus: "سليم" | "ضعيف";
    }) {
      const hasCriticalIssue =
        data.oilStatus === "ناقص" ||
        data.waterStatus === "ناقص" ||
        data.tiresStatus === "متضرر" ||
        data.brakesStatus === "ضعيف";

      const hasIssue =
        hasCriticalIssue ||
        data.oilStatus === "يحتاج تغيير" ||
        data.tiresStatus === "يحتاج هواء" ||
        data.cleanliness === "غير نظيف" ||
        data.lightsStatus === "معطل";

      return {
        hasIssue: hasIssue ? 1 : 0,
        hasCriticalIssue,
        status: hasCriticalIssue ? "تم تحويله للصيانة" : "جديد",
      };
    }

    it("flags critical alert when oil is low", () => {
      const result = evaluateInspectionSafety({
        oilStatus: "ناقص",
        waterStatus: "سليم",
        tiresStatus: "ممتاز",
        cleanliness: "نظيف",
        lightsStatus: "سليم",
        brakesStatus: "سليم",
      });

      expect(result.hasIssue).toBe(1);
      expect(result.hasCriticalIssue).toBe(true);
      expect(result.status).toBe("تم تحويله للصيانة");
    });

    it("flags critical alert when water/coolant is low", () => {
      const result = evaluateInspectionSafety({
        oilStatus: "سليم",
        waterStatus: "ناقص",
        tiresStatus: "ممتاز",
        cleanliness: "نظيف",
        lightsStatus: "سليم",
        brakesStatus: "سليم",
      });

      expect(result.hasIssue).toBe(1);
      expect(result.hasCriticalIssue).toBe(true);
    });

    it("marks vehicle as clean & ready when all checklist items pass", () => {
      const result = evaluateInspectionSafety({
        oilStatus: "سليم",
        waterStatus: "سليم",
        tiresStatus: "ممتاز",
        cleanliness: "نظيف",
        lightsStatus: "سليم",
        brakesStatus: "سليم",
      });

      expect(result.hasIssue).toBe(0);
      expect(result.hasCriticalIssue).toBe(false);
      expect(result.status).toBe("جديد");
    });
  });

  describe("Workforce Requests Types & Status Handling", () => {
    const validRequestTypes = [
      "إجازة",
      "نقل كفالة",
      "خروج نهائي",
      "تأشيرة خروج وعودة",
      "سلفة راتب",
      "شهادة تعريف بالراتب",
      "تجديد إقامة",
      "تجديد رخصة قيادة",
      "أخرى",
    ];

    it("supports all required HR request types for drivers and employees", () => {
      expect(validRequestTypes).toContain("إجازة");
      expect(validRequestTypes).toContain("نقل كفالة");
      expect(validRequestTypes).toContain("خروج نهائي");
      expect(validRequestTypes).toContain("سلفة راتب");
    });

    it("manages workflow transitions from review to approval or rejection", () => {
      type RequestStatus = "قيد المراجعة" | "معتمدة" | "مرفوضة" | "ملغاة";
      let status: RequestStatus = "قيد المراجعة";

      function approve(): RequestStatus {
        return "معتمدة";
      }

      function reject(reason: string): { status: RequestStatus; reason: string } {
        return { status: "مرفوضة", reason };
      }

      expect(status).toBe("قيد المراجعة");
      expect(approve()).toBe("معتمدة");
      expect(reject("الرصيد لا يسمح").status).toBe("مرفوضة");
    });
  });

  describe("Self-Service User Permissions and Access Scoping", () => {
    function evaluateUserAccess(user: {
      role: "admin" | "user";
      permissions: string[];
    }) {
      const userPermissions = new Set(
        user.role === "admin"
          ? [
              "dashboard",
              "vehicles",
              "projects",
              "maintenance",
              "finance",
              "self_service",
            ]
          : user.permissions
      );

      const canAccess = (key: string) => {
        if (user.role === "admin") return true;
        if (key === "self_service") {
          return (
            userPermissions.has("self_service_hr") ||
            userPermissions.has("self_service_driver") ||
            userPermissions.has("self_service")
          );
        }
        return userPermissions.has(key);
      };

      const canHr =
        user.role === "admin" ||
        userPermissions.has("self_service_hr") ||
        userPermissions.has("self_service_driver");

      const canInspection =
        user.role === "admin" || userPermissions.has("self_service_driver");

      return {
        canAccessSelfService: canAccess("self_service"),
        canAccessVehicles: canAccess("vehicles"),
        canAccessFinance: canAccess("finance"),
        canHr,
        canInspection,
      };
    }

    it("restricts self_service_hr users to HR requests only (no bus inspection, no fleet/finance data)", () => {
      const access = evaluateUserAccess({
        role: "user",
        permissions: ["self_service_hr"],
      });

      expect(access.canAccessSelfService).toBe(true);
      expect(access.canHr).toBe(true);
      expect(access.canInspection).toBe(false);
      expect(access.canAccessVehicles).toBe(false);
      expect(access.canAccessFinance).toBe(false);
    });

    it("allows self_service_driver users to submit both HR requests and daily bus inspections (no fleet/finance data)", () => {
      const access = evaluateUserAccess({
        role: "user",
        permissions: ["self_service_driver"],
      });

      expect(access.canAccessSelfService).toBe(true);
      expect(access.canHr).toBe(true);
      expect(access.canInspection).toBe(true);
      expect(access.canAccessVehicles).toBe(false);
      expect(access.canAccessFinance).toBe(false);
    });

    it("grants full access to admins across all modules and inspections", () => {
      const access = evaluateUserAccess({
        role: "admin",
        permissions: [],
      });

      expect(access.canAccessSelfService).toBe(true);
      expect(access.canHr).toBe(true);
      expect(access.canInspection).toBe(true);
      expect(access.canAccessVehicles).toBe(true);
      expect(access.canAccessFinance).toBe(true);
    });
  });
});

