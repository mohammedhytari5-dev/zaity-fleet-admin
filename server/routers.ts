import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ONE_YEAR_MS } from "@shared/const";
import { sdk } from "./_core/sdk";
import { archiveClaim, archiveClient, archiveContract, archiveDocument, archiveDriver, archiveMaintenanceRequest, archivePayment, archiveSetting, deleteSetting, archiveVehicle, assignVehicleDriver, authenticateLocalUser, countAdmins, createLocalUser, createAuditLog, createClaim, createClient, createContract, createDocument, createDriver, createMaintenanceRequest, createNotification, createPayment, createRepresentative, createTask, createVehicle, listAuditLogs, listClaims, listClients, listContracts, listDocuments, listDrivers, listMaintenanceRequests, listNotifications, listPayments, listRepresentatives, listSettings, listTasks, listUsers, listVehicles, markNotificationRead, updateClaim, updatePayment, updateSetting, updateClient, updateContract, updateContractStatus, updateUserRole, updateDocument, updateDriver, updateMaintenanceRequest, updateTask, updateVehicle, upsertSetting } from "./db";

function requireRecord<T>(record: T | null | undefined, entity: string): T {
  if (!record) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `قاعدة البيانات غير متصلة؛ تعذر حفظ ${entity}` });
  return record;
}

const vehicleInput = z.object({
  plate: z.string().min(2).max(32),
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(120),
  year: z.string().min(4).max(8),
  color: z.string().min(1).max(48),
  mileage: z.string().min(1).max(32),
  driver: z.string().max(120).default("—"),
  driverId: z.number().int().positive().nullable().default(null),
  status: z.enum(["متاحة", "مؤجرة", "مشغولة", "في الصيانة", "قيد التجهيز"]),
  client: z.string().max(160).default("—"),
  clientId: z.number().int().positive().nullable().default(null),
  contract: z.string().max(80).default("—"),
  contractId: z.number().int().positive().nullable().default(null),
  notes: z.string().max(4000).optional(),
});

const contractItemInput = z.object({
  vehicleId: z.number().int().positive().nullable().default(null),
  vehiclePlate: z.string().max(32).default("—"),
  quantity: z.number().int().positive().default(1),
  driver: z.string().max(120).default("—"),
  coverage: z.enum(["مركبة وسائق", "سائق فقط", "مركبة فقط"]),
  description: z.string().max(240).default("خدمة تشغيل"),
});
const contractInput = z.object({
  ref: z.string().min(2).max(40), client: z.string().min(2).max(160), clientId: z.number().int().positive().nullable().default(null), type: z.string().min(2).max(120),
  startDate: z.string().min(2).max(32), expiry: z.string().min(2).max(32), total: z.number().int().nonnegative().default(0), collected: z.number().int().nonnegative().default(0),
  status: z.enum(["قائم", "مكتمل", "عرض سعر", "ملغي"]).default("قائم"), notes: z.string().max(4000).optional(), items: z.array(contractItemInput).min(1),
});
const driverInput = z.object({
  name: z.string().min(2).max(160),
  phone: z.string().max(40).default("—"),
  idNo: z.string().max(64).default("—"),
  status: z.enum(["متاح", "مشغول", "موقوف"]).default("متاح"),
  vehicle: z.string().max(32).default("—"),
  vehicleId: z.number().int().positive().nullable().default(null),
  license: z.string().max(80).default("خصوصي"),
  renewal: z.string().max(32).default("—"),
});
const maintenanceInput = z.object({
  ref: z.string().min(2).max(40),
  vehicle: z.string().min(2).max(80),
  vehicleId: z.number().int().positive().nullable().default(null),
  type: z.string().min(2).max(160),
  manager: z.string().max(160).default("—"),
  start: z.string().max(32).default("—"),
  due: z.string().max(32).default("—"),
  status: z.enum(["جديد", "جاري العمل", "مكتمل", "متوقف"]).default("جديد"),
  cost: z.string().max(40).default("0 ر.س"),
});
const documentInput = z.object({
  name: z.string().min(2).max(160),
  entity: z.string().max(160).default("—"),
  entityId: z.number().int().positive().nullable().default(null),
  type: z.string().max(80).default("مركبة"),
  expiry: z.string().max(32).default("—"),
  status: z.enum(["ساري", "قريبًا", "متأخر", "منتهي"]).default("ساري"),
  owner: z.string().max(160).default("—"),
  fileName: z.string().max(255).optional(),
  fileUrl: z.string().max(3000000).optional(),
});
const clientInput = z.object({
  name: z.string().min(2).max(200),
  location: z.string().max(120).default("—"),
  vat: z.string().max(80).default("—"),
  commercial: z.string().max(80).default("—"),
  contact: z.string().max(160).default("—"),
  phone: z.string().max(40).default("—"),
  contracts: z.number().int().nonnegative().default(0),
});
const claimInput = z.object({
  ref: z.string().min(2).max(40),
  client: z.string().min(2).max(160),
  clientId: z.number().int().positive().nullable().default(null),
  contract: z.string().min(2).max(40),
  contractId: z.number().int().positive().nullable().default(null),
  amount: z.number().int().nonnegative().default(0),
  due: z.string().max(32).default("—"),
  paid: z.number().int().nonnegative().default(0),
  status: z.enum(["مستحقة", "مدفوعة", "متأخرة", "ملغاة"]).default("مستحقة"),
});
const taskInput = z.object({ title: z.string().min(2).max(200), description: z.string().max(4000).optional(), dueAt: z.string().max(32).default("—"), status: z.enum(["مفتوحة", "مكتملة", "ملغاة"]).default("مفتوحة"), assignee: z.string().max(160).default("—") });
const paymentInput = z.object({ contractId: z.number().int().positive().nullable().default(null), claimId: z.number().int().positive().nullable().default(null), clientId: z.number().int().positive().nullable().default(null), amount: z.number().int().positive(), paidAt: z.string().min(2).max(32), method: z.string().min(2).max(80), reference: z.string().max(80).default("—"), notes: z.string().max(4000).optional() }).refine(value => Boolean(value.contractId || value.claimId || value.clientId), { message: "يجب ربط الدفعة بعقد أو مطالبة أو عميل" });
const representativeInput = z.object({ clientId: z.number().int().positive(), name: z.string().min(2).max(160), phone: z.string().min(3).max(40) });
const userCreateInput = z.object({ name: z.string().min(2).max(160), username: z.string().regex(/^[^\s@]{3,40}$/).transform(value => value.toLowerCase()), password: z.string().min(8).max(200), role: z.enum(["user", "admin"]).default("user"), permissions: z.array(z.string().max(80)).max(30).default([]) });
const settingInput = z.object({ category: z.string().min(2).max(80), key: z.string().min(2).max(80), label: z.string().min(2).max(160), value: z.string().min(1).max(255), active: z.number().int().min(0).max(1).default(1) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? { ...opts.ctx.user, passwordHash: undefined } : undefined),
    login: publicProcedure.input(z.object({ username: z.string().min(3).max(40), password: z.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const user = await authenticateLocalUser(input.username, input.password);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      const token = await sdk.createSessionToken(user.openId, { name: user.name || user.username || "", expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS, sameSite: "lax" });
      return { ...user, passwordHash: undefined };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // Match the cookie attributes used by local login and production OAuth
      // so the browser removes the actual session instead of retaining it.
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
        sameSite: cookieOptions.secure ? "none" : "lax",
      });
      return { success: true } as const;
    }),
  }),
  vehicles: router({
    list: protectedProcedure.query(async () => {
      const records = await listVehicles();
      return records ?? [];
    }),
    create: adminProcedure.input(vehicleInput).mutation(async ({ input }) => requireRecord(await createVehicle(input), "المركبة")),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: vehicleInput.partial() })).mutation(async ({ input }) => requireRecord(await updateVehicle(input.id, input.data), "المركبة")),
    assignDriver: adminProcedure.input(z.object({ vehicleId: z.number().int().positive(), driverId: z.number().int().positive().nullable() })).mutation(async ({ input }) => requireRecord(await assignVehicleDriver(input.vehicleId, input.driverId), "إسناد السائق")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveVehicle(input.id) })),
  }),
  drivers: router({
    list: protectedProcedure.query(async () => (await listDrivers()) ?? []),
    create: adminProcedure.input(driverInput).mutation(async ({ input }) => requireRecord(await createDriver(input), "السائق")),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: driverInput.partial() })).mutation(async ({ input }) => requireRecord(await updateDriver(input.id, input.data), "السائق")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveDriver(input.id) })),
  }),
  maintenance: router({
    list: protectedProcedure.query(async () => (await listMaintenanceRequests()) ?? []),
    create: adminProcedure.input(maintenanceInput).mutation(async ({ input }) => requireRecord(await createMaintenanceRequest(input), "طلب الصيانة")),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: maintenanceInput.partial() })).mutation(async ({ input }) => requireRecord(await updateMaintenanceRequest(input.id, input.data), "طلب الصيانة")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveMaintenanceRequest(input.id) })),
  }),
  documents: router({
    list: protectedProcedure.query(async () => (await listDocuments()) ?? []),
    create: adminProcedure.input(documentInput).mutation(async ({ input }) => requireRecord(await createDocument(input), "المستند")),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: documentInput.partial() })).mutation(async ({ input }) => requireRecord(await updateDocument(input.id, input.data), "المستند")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveDocument(input.id) })),
  }),
  clients: router({
    list: protectedProcedure.query(async () => (await listClients()) ?? []),
    create: adminProcedure.input(clientInput).mutation(async ({ input }) => requireRecord(await createClient(input), "العميل")),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: clientInput.partial() })).mutation(async ({ input }) => requireRecord(await updateClient(input.id, input.data), "العميل")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveClient(input.id) })),
  }),
  claims: router({
    list: protectedProcedure.query(async () => (await listClaims()) ?? []),
    create: adminProcedure.input(claimInput).mutation(async ({ input }) => requireRecord(await createClaim(input), "المطالبة")),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: claimInput.partial() })).mutation(async ({ input }) => requireRecord(await updateClaim(input.id, input.data), "المطالبة")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveClaim(input.id) })),
  }),
  contracts: router({
    list: protectedProcedure.query(async () => (await listContracts()) ?? []),
    create: adminProcedure.input(contractInput).mutation(async ({ input }) => {
      const { items, ...contract } = input;
      return requireRecord(await createContract(contract, items), "العقد");
    }),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: contractInput.partial() })).mutation(async ({ input }) => { const { items, ...contract } = input.data; return requireRecord(await updateContract(input.id, contract, items), "العقد"); }),
    updateStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["قائم", "مكتمل", "عرض سعر", "ملغي"]) })).mutation(async ({ input }) => requireRecord(await updateContractStatus(input.id, input.status), "العقد")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveContract(input.id) })),
  }),
  tasks: router({
    list: protectedProcedure.query(() => listTasks()),
    create: adminProcedure.input(taskInput).mutation(({ input }) => createTask(input)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: taskInput.partial() })).mutation(({ input }) => updateTask(input.id, input.data)),
  }),
  notifications: router({
    list: protectedProcedure.query(() => listNotifications()),
    create: adminProcedure.input(z.object({ type: z.string().max(60), title: z.string().max(200), message: z.string().max(4000), entityType: z.string().max(60).optional(), entityId: z.number().int().positive().optional(), severity: z.enum(["معلومة", "تنبيه", "حرج"]).default("معلومة") })).mutation(({ input }) => createNotification(input)),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => markNotificationRead(input.id)),
  }),
  payments: router({ list: protectedProcedure.query(() => listPayments()), create: adminProcedure.input(paymentInput).mutation(({ input }) => createPayment(input)), update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: paymentInput.partial() })).mutation(({ input }) => updatePayment(input.id, input.data)), archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archivePayment(input.id) })) }),
  representatives: router({ list: protectedProcedure.input(z.object({ clientId: z.number().int().positive() })).query(({ input }) => listRepresentatives(input.clientId)), create: adminProcedure.input(representativeInput).mutation(({ input }) => createRepresentative(input)) }),
  users: router({
    list: adminProcedure.query(() => listUsers()),
    create: adminProcedure.input(userCreateInput).mutation(async ({ input }) => requireRecord(await createLocalUser(input), "المستخدم")),
    updateRole: adminProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(async ({ input }) => { if (input.role === "user") { const admins = await countAdmins(); if (admins !== null && admins <= 1) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تخفيض صلاحية آخر مدير في النظام" }); } return requireRecord(await updateUserRole(input.id, input.role), "صلاحية المستخدم"); }) }),
  settingsCatalog: router({ list: protectedProcedure.input(z.object({ category: z.string().optional() }).optional()).query(({ input }) => listSettings(input?.category)), create: adminProcedure.input(settingInput).mutation(async ({ input }) => requireRecord(await upsertSetting(input), "القيمة المرجعية")), update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: settingInput.partial() })).mutation(async ({ input }) => requireRecord(await updateSetting(input.id, input.data), "القيمة المرجعية")), archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveSetting(input.id) })),
    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await deleteSetting(input.id) })) }),
  audit: router({ list: adminProcedure.query(() => listAuditLogs()), record: adminProcedure.input(z.object({ action: z.string().max(80), entityType: z.string().max(80), entityId: z.number().int().positive().optional(), details: z.string().max(4000).optional() })).mutation(({ ctx, input }) => createAuditLog({ ...input, userId: ctx.user?.id ?? null })) }),
});

export type AppRouter = typeof appRouter;
