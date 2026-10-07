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
  const vehicleOnlyUser = { ...adminUser, role: "user" as const, permissions: JSON.stringify(["vehicles"]) };

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

  it("allows an explicitly authorized module read but denies unrelated module reads", async () => {
    const ctx: TrpcContext = {
      user: vehicleOnlyUser,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.vehicles.list()).resolves.toEqual(expect.any(Array));
    await expect(caller.drivers.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.projects.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.payables.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.maintenance.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.documents.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.clients.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.contracts.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.claims.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.payments.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.tasks.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.notifications.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires module access before linking projects to clients or contracts", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["projects"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.create({ ref: "PR-LINK", name: "مشروع اختبار", clientId: 4, client: "عميل", contractId: null, contract: "—", managerEmployeeId: null, manager: "—", startDate: "—", endDate: "—", requiredVehicles: 0, status: "مخطط" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires both vehicle and driver access to assign a driver", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["vehicles"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).vehicles.assignDriver({ vehicleId: 1, driverId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires vehicle access when a financial contract links vehicles", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["finance"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).contracts.create({ ref: "CT-LINK", client: "عميل", clientId: null, type: "تشغيل", startDate: "2026-10-04", expiry: "2027-10-04", total: 100, collected: 0, status: "قائم", items: [{ vehicleId: 3, vehiclePlate: "1234", quantity: 1, driver: "—", coverage: "مركبة فقط", description: "خدمة" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires vehicle access when a driver record is linked to a vehicle", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["drivers"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).drivers.create({ name: "سائق اختبار", vehicleId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an explicitly authorized projects read", async () => {
    const ctx: TrpcContext = {
      user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["projects"]) },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    await expect(appRouter.createCaller(ctx).projects.list()).resolves.toEqual(expect.any(Array));
  });

  it("allows the dedicated payables permission without granting other financial modules", async () => {
    const ctx: TrpcContext = {
      user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["payables"]) },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.payables.list()).resolves.toEqual(expect.any(Array));
    await expect(caller.claims.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps employee records and cross-module reports behind their dedicated permissions", async () => {
    const ctx: TrpcContext = {
      user: vehicleOnlyUser,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.employees.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.reports.summary({ from: "2026-10-01", to: "2026-10-31" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires employee access before linking an employee to a document", async () => {
    const ctx: TrpcContext = {
      user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["documents"]) },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    await expect(appRouter.createCaller(ctx).documents.create({ name: "هوية موظف", entityType: "موظف", entityId: 4 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects reversed report periods before querying stored data", async () => {
    const ctx: TrpcContext = {
      user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["reports"]) },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    await expect(appRouter.createCaller(ctx).reports.summary({ from: "2026-10-31", to: "2026-10-01" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("keeps a bus financial file and its expense/revenue mutations behind finance permission", async () => {
    const ctx: TrpcContext = { user: vehicleOnlyUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.vehicles.financeProfile({ vehicleId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.vehicles.receipt({ vehicleId: 1, recordId: 1, kind: "expense" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.vehicles.update({ id: 1, data: { purchasePrice: 20000 } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.vehicles.expenseCreate({ vehicleId: 1, category: "إطارات", amount: 1000, spentAt: "2026-10-03", description: "إطارات اختبار", vendor: "ورشة" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.vehicleRevenues.create({ vehicleId: 1, paymentId: 1, amount: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires vehicle access as well as finance before attributing collected money to a bus", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["finance"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).vehicleRevenues.create({ vehicleId: 1, paymentId: 1, amount: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires finance as well as vehicle access before linking an accounts-payable invoice", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["payables", "vehicles"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).payables.create({ ref: "AP-TEST-F", supplier: "ورشة اختبار", description: "فاتورة إطارات", amount: 1000, issueDate: "2026-10-03", dueDate: "2026-10-20", vehicleId: 1, vehicleCategory: "إطارات" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires vehicle permission before attaching an accounts-payable invoice to a bus", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["payables"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).payables.create({ ref: "AP-TEST", supplier: "ورشة اختبار", description: "فاتورة إطارات", amount: 1000, issueDate: "2026-10-03", dueDate: "2026-10-20", vehicleId: 1, vehicleCategory: "إطارات" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires maintenance permission to link an accounts-payable invoice to a maintenance request", async () => {
    const vehicleFinanceUser = { ...adminUser, role: "user" as const, permissions: JSON.stringify(["payables", "vehicles", "finance"]) };
    const caller = appRouter.createCaller({ user: vehicleFinanceUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
    await expect(caller.payables.create({ ref: "AP-MT-PERM", supplier: "ورشة اختبار", description: "فاتورة صيانة", amount: 1000, issueDate: "2026-10-03", dueDate: "2026-10-20", vehicleId: 1, maintenanceRequestId: 1, vehicleCategory: "صيانة" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not allow maintenance-only users to enter invoice amounts or financial attachments", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["maintenance"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(ctx).maintenance.create({ ref: "MT-TEST", vehicleId: 1, vehicle: "1234", type: "إصلاح", manager: "اختبار", start: "2026-10-03", due: "2026-10-03", status: "جديد", cost: "500 ر.س" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(ctx).maintenance.update({ id: 1, data: { cost: "500 SAR" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(ctx).maintenance.update({ id: 1, data: { receiptUrl: "data:application/pdf;base64,ZmFrZQ==" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires vehicle permission when maintenance actions link to or change a vehicle", async () => {
    const ctx: TrpcContext = { user: { ...adminUser, role: "user" as const, permissions: JSON.stringify(["maintenance"]) }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.maintenance.create({ ref: "MT-VEHICLE-LINK", vehicleId: 1, vehicle: "1234", type: "إصلاح", manager: "اختبار", start: "2026-10-04", due: "2026-10-04", status: "جديد" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.maintenance.update({ id: 1, data: { vehicleId: 1 } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.maintenance.update({ id: 1, data: { status: "مكتمل" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.maintenance.archive({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
