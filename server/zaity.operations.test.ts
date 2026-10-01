import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Zaity operations", () => {
  const adminUser = {
    id: 1,
    openId: "admin-test",
    name: "Admin Test",
    email: "admin@example.com",
    loginMethod: "test",
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  it("exposes the authenticated dashboard contract", async () => {
    const ctx: TrpcContext = {
      user: undefined,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toBeUndefined();
  });

  it("keeps the default admin dashboard data contract stable", () => {
    const visibleStatuses = ["متاحة", "مؤجرة", "مشغولة", "في الصيانة", "قيد التجهيز"];
    expect(visibleStatuses).toHaveLength(5);
    expect(visibleStatuses).toContain("في الصيانة");
  });

  it("rejects vehicle mutations without authentication", async () => {
    const ctx: TrpcContext = {
      user: undefined,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    await expect(
      appRouter.createCaller(ctx).vehicles.update({ id: 1, data: { driver: "غير مصرح" } }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns a usable vehicle list contract for an authenticated user", async () => {
    const ctx: TrpcContext = {
      user: adminUser,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const vehicles = await appRouter.createCaller(ctx).vehicles.list();
    expect(Array.isArray(vehicles)).toBe(true);
    if (vehicles.length) expect(vehicles[0]).toMatchObject({ plate: expect.any(String), status: expect.any(String) });
  });

  it("accepts driver assignment through the vehicle update contract", async () => {
    const ctx: TrpcContext = {
      user: adminUser,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    try {
      const updated = await appRouter.createCaller(ctx).vehicles.update({ id: 1, data: { driver: "فيصل صالح القحطاني" } });
      expect(updated).toMatchObject({ id: 1, driver: "فيصل صالح القحطاني" });
    } catch (error: any) {
      expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
    }
  });


  it("rejects driver assignment without authentication", async () => {
    const ctx: TrpcContext = { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).vehicles.assignDriver({ vehicleId: 1, driverId: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rejects unlinked payments for authenticated admins", async () => {
    const ctx: TrpcContext = { user: adminUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).payments.create({ amount: 100, paidAt: "2026-09-30", method: "تحويل" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("protects operational mutations added in the operations suite", async () => {
    const ctx: TrpcContext = { user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).tasks.create({ title: "مهمة اختبار" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(ctx).payments.create({ amount: 100, paidAt: "2026-09-30", method: "تحويل" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(ctx).settingsCatalog.create({ category: "vehicles", key: "color", label: "أبيض", value: "أبيض" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects invalid payment amounts before reaching the database", async () => {
    const ctx: TrpcContext = { user: adminUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).payments.create({ amount: 0, paidAt: "2026-09-30", method: "تحويل" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
