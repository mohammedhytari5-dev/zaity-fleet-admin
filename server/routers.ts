import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { isSafeFileReference } from "./_core/fileReferences";
import { adminProcedure, permissionProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ONE_YEAR_MS } from "@shared/const";
import { sdk } from "./_core/sdk";
import { documentModuleByType, resolveDocumentLink, type DocumentEntityType } from "./document-relations";
import { documentsVisibleTo } from "./document-access";
import { payableLinkPermissions, payablesVisibleTo } from "./payable-access";
import { vehicleRecordForViewer } from "./vehicle-access";
import { driverRecordForViewer } from "./driver-access";
import { projectRecordForViewer } from "./project-access";
import { notificationModule, notificationsVisibleTo } from "./notification-access";
import { archiveClaim, archiveClient, archiveContract, archiveDocument, archiveDriver, archiveMaintenanceRequest, advanceMaintenanceRequest, decideMaintenanceApproval, settleMaintenanceAdvance, listMaintenanceEvents, archivePayment, archiveVehicleExpense, archiveVehicleRevenue, archiveProject, archiveSetting, deleteSetting, archiveVehicle, assignVehicleDriver, authenticateLocalUser, LastActiveAdminDemotionError, createLocalUser, createAuditLog, createClaim, createClient, createContract, createDocument, createDriver, createEmployee, updateEmployee, archiveEmployee, listEmployees, createMaintenanceRequest, createNotification, createPayment, createProject, createPayable, registerPayablePayment, updatePayable, updatePayableStatus, listPayables, getPayableReceipt, createRepresentative, createTask, createVehicle, createVehicleExpense, createVehicleRevenue, getVehicleFinancialProfile, getVehicleReceipt, listVehicleFinancialSummaries, updateVehicleExpense, listAuditLogs, listClaims, listClients, listContracts, listDocuments, listDrivers, listMaintenanceRequests, listNotifications, getNotification, listPayments, listProjects, listRepresentatives, listSettings, listTasks, listUsers, listVehicles, getCompanyReport, markNotificationRead, updateClaim, updatePayment, updateSetting, updateClient, updateContract, updateContractStatus, updateProject, updateUserRole, updateUserAccess, updateDocument, updateDriver, updateMaintenanceRequest, updateTask, updateVehicle, upsertSetting, getDocument } from "./db";
import { maintenanceStages, type MaintenanceStage } from "../shared/maintenance-domain";
import { maintenanceEventForViewer, maintenanceRecordForViewer } from "./maintenance-access";
import { scopeCompanyReport } from "./report-access";
import { isValidReportPeriod } from "./report-period";

function requireRecord<T>(record: T | null | undefined, entity: string): T {
  if (!record) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `قاعدة البيانات غير متصلة؛ تعذر حفظ ${entity}` });
  return record;
}
function hasModulePermission(user: { role?: string; permissions?: string | null } | undefined, module: string) {
  if (user?.role === "admin") return true;
  try { return (JSON.parse(user?.permissions || "[]") as string[]).includes(module); } catch { return false; }
}
function requireReferencePermission(user: { role?: string; permissions?: string | null } | undefined, module: string) {
  if (!hasModulePermission(user, module)) throw new TRPCError({ code: "FORBIDDEN", message: `تحتاج صلاحية ${module} لربط هذا السجل` });
}
function requirePayableLinkAccess(user: { role?: string; permissions?: string | null } | undefined, links: { vehicleId?: number | null; maintenanceRequestId?: number | null }) {
  for (const module of payableLinkPermissions(links)) requireReferencePermission(user, module);
}
function scopeVehicleForUser<T extends object>(user: { role?: string; permissions?: string | null } | undefined, vehicle: T): T {
  return vehicleRecordForViewer(vehicle, module => hasModulePermission(user, module));
}

const vehicleInput = z.object({
  plate: z.string().min(2).max(32),
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(120),
  year: z.string().min(4).max(8),
  color: z.string().min(1).max(48),
  mileage: z.string().min(1).max(32),
  purchasePrice: z.number().int().nonnegative().optional(),
  purchaseDate: z.string().max(32).optional(),
  inServiceDate: z.string().max(32).optional(),
  projectId: z.number().int().positive().nullable().default(null),
  project: z.string().max(200).default("—"),
  driver: z.string().max(120).default("—"),
  driverId: z.number().int().positive().nullable().default(null),
  employeeId: z.number().int().positive().nullable().default(null),
  employee: z.string().max(160).default("—"),
  status: z.enum(["متاحة", "مؤجرة", "مشغولة", "في الصيانة", "قيد التجهيز", "متوقفة"]),
  client: z.string().max(160).default("—"),
  clientId: z.number().int().positive().nullable().default(null),
  contract: z.string().max(80).default("—"),
  contractId: z.number().int().positive().nullable().default(null),
  notes: z.string().max(4000).optional(),
});

const projectInput = z.object({
  ref: z.string().min(2).max(40), name: z.string().min(2).max(200),
  clientId: z.number().int().positive().nullable().default(null), client: z.string().min(2).max(200),
  contractId: z.number().int().positive().nullable().default(null), contract: z.string().max(40).default("—"),
  managerEmployeeId: z.number().int().positive().nullable().default(null), manager: z.string().max(160).default("—"), startDate: z.string().max(32).default("—"), endDate: z.string().max(32).default("—"),
  requiredVehicles: z.number().int().nonnegative().default(0), status: z.enum(["مخطط", "نشط", "موقوف", "مكتمل", "ملغي"]).default("مخطط"), notes: z.string().max(4000).optional(),
});

const contractItemInput = z.object({
  vehicleId: z.number().int().positive().nullable().default(null),
  vehiclePlate: z.string().max(32).default("—"),
  quantity: z.number().int().positive().default(1),
  driver: z.string().max(120).default("—"),
  coverage: z.enum(["مركبة وسائق", "سائق فقط", "مركبة فقط"]).default("مركبة وسائق"),
  description: z.string().max(240).default("خدمة تشغيل"),
});
const contractInput = z.object({
  ref: z.string().min(2).max(40), client: z.string().min(2).max(160), clientId: z.number().int().positive().nullable().default(null), type: z.string().min(2).max(120),
  startDate: z.string().min(2).max(32), expiry: z.string().min(2).max(32), total: z.number().int().nonnegative().default(0), collected: z.number().int().nonnegative().default(0),
  status: z.enum(["قائم", "مكتمل", "عرض سعر", "ملغي"]).default("قائم"), notes: z.string().max(4000).nullable().optional(), items: z.array(contractItemInput).min(1),
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
const employeeInput = z.object({
  employeeNo: z.string().min(2).max(40), name: z.string().min(2).max(160), nationalId: z.string().max(64).default("—"),
  phone: z.string().max(40).default("—"), email: z.string().email().max(320).or(z.literal("—")).default("—"),
  department: z.string().min(2).max(120).default("الإدارة"), jobTitle: z.string().min(2).max(120).default("موظف"),
  hireDate: z.string().max(32).default("—"), status: z.enum(["نشط", "إجازة", "موقوف", "منتهي الخدمة"]).default("نشط"), notes: z.string().max(4000).optional(),
});
const maintenanceInput = z.object({
  ref: z.string().min(2).max(40),
  vehicle: z.string().min(2).max(80),
  vehicleId: z.number().int().positive().nullable().default(null),
  type: z.string().min(2).max(160),
  priority: z.enum(["طارئ", "عاجل", "متوسط", "عادي"]).default("متوسط"),
  reportedBy: z.string().max(160).default("—"),
  reason: z.string().max(500).default("—"),
  diagnosis: z.string().max(4000).nullable().optional(),
  workDone: z.string().max(4000).nullable().optional(),
  parts: z.string().max(4000).nullable().optional(),
  technician: z.string().max(160).default("—"),
  workshop: z.string().max(200).default("—"),
  manager: z.string().max(160).default("—"),
  start: z.string().max(32).default("—"),
  due: z.string().max(32).default("—"),
  expectedReturn: z.string().max(32).default("—"),
  status: z.enum(["جديد", "جاري العمل", "بانتظار الفحص", "مكتمل", "متوقف"]).default("جديد"),
  cost: z.string().max(40).optional(),
  estimatedCost: z.number().int().nonnegative().default(0),
  quotedPartsCost: z.number().int().nonnegative().default(0),
  quoteName: z.string().max(255).nullable().optional(), quoteUrl: z.string().max(1200000).refine(isSafeFileReference, "مرجع ملف غير صالح").nullable().optional(),
  laborCost: z.number().int().nonnegative().optional(),
  partsCost: z.number().int().nonnegative().optional(),
  warrantyUntil: z.string().max(32).default("—"),
  receiptName: z.string().max(255).nullable().optional(), receiptUrl: z.string().max(1200000).refine(isSafeFileReference, "مرجع ملف غير صالح").nullable().optional(),
});
const documentInput = z.object({
  name: z.string().min(2).max(160),
  entity: z.string().max(160).default("—"),
  entityId: z.number().int().positive().nullable().default(null),
  entityType: z.enum(["مركبة", "سائق", "موظف", "مشروع", "عميل", "عقد", "مطالبة", "صيانة"]).default("مركبة"),
  type: z.string().max(80).default("مركبة"),
  expiry: z.string().max(32).default("—"),
  status: z.enum(["ساري", "قريبًا", "متأخر", "منتهي"]).default("ساري"),
  owner: z.string().max(160).default("—"),
  fileName: z.string().max(255).optional(),
  fileUrl: z.string().max(3000000).refine(isSafeFileReference, "مرجع ملف غير صالح").optional(),
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
  submittedAt: z.string().max(32).default("—"),
  followUpAt: z.string().max(32).default("—"),
  notes: z.string().max(4000).optional(),
  status: z.enum(["غير مرفوعة", "جديدة", "تحت الإجراء", "تم اعتمادها", "تم صرفها", "مرفوضة", "ملغاة"]).default("جديدة"),
});
const vehicleExpenseInput = z.object({
  vehicleId: z.number().int().positive(),
  category: z.enum(["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"]),
  amount: z.number().int().positive(), spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(2).max(300), vendor: z.string().max(160).default("—"),
  receiptName: z.string().max(255).optional(), receiptUrl: z.string().max(1200000).refine(isSafeFileReference, "مرجع ملف غير صالح").optional(), notes: z.string().max(4000).optional(),
});
const vehicleRevenueInput = z.object({
  vehicleId: z.number().int().positive(), paymentId: z.number().int().positive(), amount: z.number().int().positive(),
  receiptName: z.string().max(255).optional(), receiptUrl: z.string().max(1200000).refine(isSafeFileReference, "مرجع ملف غير صالح").optional(), notes: z.string().max(4000).optional(),
});

const payableInput = z.object({
  ref: z.string().min(2).max(40), supplier: z.string().min(2).max(200), description: z.string().min(2).max(300),
  amount: z.number().int().positive(), issueDate: z.string().max(32).default("—"), dueDate: z.string().max(32).default("—"), notes: z.string().max(4000).optional(),
  vehicleId: z.number().int().positive().nullable().optional(), maintenanceRequestId: z.number().int().positive().nullable().optional(), vehicleCategory: z.enum(["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"]).nullable().optional(),
  receiptName: z.string().max(255).optional(), receiptUrl: z.string().max(1200000).refine(isSafeFileReference, "مرجع ملف غير صالح").optional(),
});
const payablePaymentInput = z.object({ payableId: z.number().int().positive(), amount: z.number().int().positive(), paidAt: z.string().min(2).max(32), method: z.string().min(2).max(80), reference: z.string().max(80).default("—"), notes: z.string().max(4000).optional() });
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
  projects: router({
    list: permissionProcedure("projects").query(async ({ ctx }) => (await listProjects() ?? []).map(project => projectRecordForViewer(project, module => hasModulePermission(ctx.user, module)))),
    create: permissionProcedure("projects").input(projectInput).mutation(async ({ ctx, input }) => { if (input.managerEmployeeId) requireReferencePermission(ctx.user, "employees"); if (input.clientId !== null) requireReferencePermission(ctx.user, "clients"); if (input.contractId !== null) requireReferencePermission(ctx.user, "finance"); return projectRecordForViewer(requireRecord(await createProject(input), "المشروع"), module => hasModulePermission(ctx.user, module)); }),
    update: permissionProcedure("projects").input(z.object({ id: z.number().int().positive(), data: projectInput.partial() })).mutation(async ({ ctx, input }) => { if (input.data.managerEmployeeId) requireReferencePermission(ctx.user, "employees"); if (input.data.clientId !== undefined && input.data.clientId !== null) requireReferencePermission(ctx.user, "clients"); if (input.data.contractId !== undefined && input.data.contractId !== null) requireReferencePermission(ctx.user, "finance"); return projectRecordForViewer(requireRecord(await updateProject(input.id, input.data), "المشروع"), module => hasModulePermission(ctx.user, module)); }),
    archive: permissionProcedure("projects").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveProject(input.id) })),
  }),
  vehicles: router({
    list: permissionProcedure("vehicles").query(async ({ ctx }) => {
      const records = await listVehicles() ?? [];
      const finance = hasModulePermission(ctx.user, "finance");
      if (finance) {
        const summaries = await listVehicleFinancialSummaries() ?? {};
        return records.map(vehicle => scopeVehicleForUser(ctx.user, { ...vehicle, ...(summaries[vehicle.id] ?? { expenseTotal: 0, revenueTotal: 0, netOperatingReturn: 0 }) }));
      }
      return records.map(vehicle => scopeVehicleForUser(ctx.user, vehicle));
    }),
    financeProfile: permissionProcedure("vehicles").input(z.object({ vehicleId: z.number().int().positive() })).query(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "finance"); return requireRecord(await getVehicleFinancialProfile(input.vehicleId), "الملف المالي للباص"); }),
    receipt: permissionProcedure("vehicles").input(z.object({ vehicleId: z.number().int().positive(), recordId: z.number().int().positive(), kind: z.enum(["expense", "revenue", "maintenance"]) })).query(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "finance"); if (input.kind === "maintenance") requireReferencePermission(ctx.user, "maintenance"); return getVehicleReceipt(input.vehicleId, input.kind, input.recordId); }),
    expenseCreate: permissionProcedure("vehicles").input(vehicleExpenseInput).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "finance"); return requireRecord(await createVehicleExpense(input, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "مصروف الباص"); }),
    expenseUpdate: permissionProcedure("vehicles").input(z.object({ id: z.number().int().positive(), data: vehicleExpenseInput.omit({ vehicleId: true }).partial() })).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "finance"); return requireRecord(await updateVehicleExpense(input.id, input.data, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "مصروف الباص"); }),
    expenseArchive: permissionProcedure("vehicles").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "finance"); return { success: await archiveVehicleExpense(input.id, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }) }; }),
    create: permissionProcedure("vehicles").input(vehicleInput).mutation(async ({ ctx, input }) => { if (input.employeeId) requireReferencePermission(ctx.user, "employees"); if (input.projectId !== null) requireReferencePermission(ctx.user, "projects"); if (input.driverId !== null) requireReferencePermission(ctx.user, "drivers"); if (input.clientId !== null) requireReferencePermission(ctx.user, "clients"); if (input.contractId !== null || input.purchasePrice !== undefined || input.purchaseDate !== undefined || input.inServiceDate !== undefined) requireReferencePermission(ctx.user, "finance"); return scopeVehicleForUser(ctx.user, requireRecord(await createVehicle(input), "المركبة")); }),
    update: permissionProcedure("vehicles").input(z.object({ id: z.number().int().positive(), data: vehicleInput.partial() })).mutation(async ({ ctx, input }) => { if (input.data.employeeId !== undefined) requireReferencePermission(ctx.user, "employees"); if (input.data.projectId !== undefined) requireReferencePermission(ctx.user, "projects"); if (input.data.driverId !== undefined) requireReferencePermission(ctx.user, "drivers"); if (input.data.clientId !== undefined) requireReferencePermission(ctx.user, "clients"); if (input.data.contractId !== undefined || input.data.purchasePrice !== undefined || input.data.purchaseDate !== undefined || input.data.inServiceDate !== undefined) requireReferencePermission(ctx.user, "finance"); return scopeVehicleForUser(ctx.user, requireRecord(await updateVehicle(input.id, input.data), "المركبة")); }),
    assignDriver: permissionProcedure("vehicles").input(z.object({ vehicleId: z.number().int().positive(), driverId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "drivers"); return scopeVehicleForUser(ctx.user, requireRecord(await assignVehicleDriver(input.vehicleId, input.driverId), "إسناد السائق")); }),
    archive: permissionProcedure("vehicles").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveVehicle(input.id) })),
  }),
  drivers: router({
    list: permissionProcedure("drivers").query(async ({ ctx }) => (await listDrivers() ?? []).map(driver => driverRecordForViewer(driver, hasModulePermission(ctx.user, "vehicles")))),
    create: permissionProcedure("drivers").input(driverInput).mutation(async ({ ctx, input }) => { if (input.vehicleId !== null) requireReferencePermission(ctx.user, "vehicles"); return driverRecordForViewer(requireRecord(await createDriver(input), "السائق"), hasModulePermission(ctx.user, "vehicles")); }),
    update: permissionProcedure("drivers").input(z.object({ id: z.number().int().positive(), data: driverInput.partial() })).mutation(async ({ ctx, input }) => { if (input.data.vehicleId !== undefined) requireReferencePermission(ctx.user, "vehicles"); return driverRecordForViewer(requireRecord(await updateDriver(input.id, input.data), "السائق"), hasModulePermission(ctx.user, "vehicles")); }),
    archive: permissionProcedure("drivers").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveDriver(input.id) })),
  }),
  employees: router({
    list: permissionProcedure("employees").query(async () => (await listEmployees()) ?? []),
    create: permissionProcedure("employees").input(employeeInput).mutation(async ({ input }) => requireRecord(await createEmployee(input), "ملف الموظف")),
    update: permissionProcedure("employees").input(z.object({ id: z.number().int().positive(), data: employeeInput.partial() })).mutation(async ({ input }) => requireRecord(await updateEmployee(input.id, input.data), "ملف الموظف")),
    archive: permissionProcedure("employees").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveEmployee(input.id) })),
  }),
  maintenance: router({
    list: permissionProcedure("maintenance").query(async ({ ctx }) => (await listMaintenanceRequests() ?? []).map(row => maintenanceRecordForViewer(row, hasModulePermission(ctx.user, "finance")))),
    create: permissionProcedure("maintenance").input(maintenanceInput).mutation(async ({ ctx, input }) => { if (input.vehicleId !== null) requireReferencePermission(ctx.user, "vehicles"); if (!input.quoteName || !input.quoteUrl || input.estimatedCost + input.quotedPartsCost <= 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أرفق عرض سعر الورشة وأدخل قيمة عرض الورشة أو قطع الغيار" }); if (input.cost !== undefined || input.laborCost !== undefined || input.partsCost !== undefined || input.receiptName !== undefined || input.receiptUrl !== undefined) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المصروف الفعلي يسجل بعد اعتماد المالية" }); return requireRecord(await createMaintenanceRequest({ ...input, reportedBy: ctx.user.name || ctx.user.username || "—", workflowStage: "اعتماد", approvalStatus: "بانتظار الاعتماد" }, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "طلب الصيانة"); }),
    update: permissionProcedure("maintenance").input(z.object({ id: z.number().int().positive(), data: maintenanceInput.omit({ status: true, reportedBy: true }).partial() })).mutation(async ({ ctx, input }) => {
      if (input.data.cost !== undefined || input.data.laborCost !== undefined || input.data.partsCost !== undefined || input.data.receiptName !== undefined || input.data.receiptUrl !== undefined) requireReferencePermission(ctx.user, "finance");
      const current = (await listMaintenanceRequests() ?? []).find(row => row.id === input.id);
      if (input.data.vehicleId !== undefined && input.data.vehicleId !== current?.vehicleId) requireReferencePermission(ctx.user, "vehicles");
      const quoteChanged = !current ||
        (input.data.estimatedCost !== undefined && Number(input.data.estimatedCost) !== Number(current.estimatedCost)) ||
        (input.data.quotedPartsCost !== undefined && Number(input.data.quotedPartsCost) !== Number(current.quotedPartsCost)) ||
        (input.data.quoteName !== undefined && input.data.quoteName !== current.quoteName) ||
        (input.data.quoteUrl !== undefined && input.data.quoteUrl !== current.quoteUrl);
      const quoteSubmitted = input.data.estimatedCost !== undefined || input.data.quotedPartsCost !== undefined || input.data.quoteName !== undefined || input.data.quoteUrl !== undefined;
      if (quoteSubmitted && quoteChanged && current?.approvalStatus !== "بانتظار الاعتماد") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تغيير عرض السعر بعد اعتماد المالية" });
      if (input.data.cost !== undefined || input.data.laborCost !== undefined || input.data.partsCost !== undefined || input.data.receiptUrl !== undefined) {
        if (current?.approvalStatus !== "معتمد" || !["تنفيذ", "فحص بعد الإصلاح"].includes(String(current.workflowStage))) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب اعتماد الطلب وبدء التنفيذ قبل تسجيل المصروف الفعلي" });
      }
      return requireRecord(await updateMaintenanceRequest(input.id, input.data, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "طلب الصيانة");
    }),
    advance: permissionProcedure("maintenance").input(z.object({ id: z.number().int().positive(), toStage: z.enum(maintenanceStages) })).mutation(async ({ ctx, input }) => requireRecord(await advanceMaintenanceRequest(input.id, input.toStage as MaintenanceStage, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "طلب الصيانة")),
    decideApproval: permissionProcedure("finance").input(z.object({ id: z.number().int().positive(), approved: z.boolean(), fundingType: z.enum(["عهدة", "تحويل مباشر"]).optional(), fundingReference: z.string().max(120).optional(), fundingAmount: z.number().int().positive().optional(), fundingRecipient: z.string().max(160).optional(), notes: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => { if (input.approved && (!input.fundingType || !input.fundingReference || !input.fundingAmount || !input.fundingRecipient)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "حدد طريقة الصرف وأدخل رقم العملية والمبلغ والجهة المستلمة" }); return requireRecord(await decideMaintenanceApproval(input.id, input.approved, input, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "قرار اعتماد الصيانة"); }),
    settleAdvance: permissionProcedure("finance").input(z.object({ id: z.number().int().positive(), reference: z.string().min(1).max(120) })).mutation(async ({ ctx, input }) => requireRecord(await settleMaintenanceAdvance(input.id, input.reference, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "تسوية العهدة")),
    history: permissionProcedure("maintenance").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => (await listMaintenanceEvents(input.id) ?? []).map(event => maintenanceEventForViewer(event, hasModulePermission(ctx.user, "finance")))),
    archive: permissionProcedure("maintenance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "vehicles"); return { success: await archiveMaintenanceRequest(input.id) }; }),
  }),
  documents: router({
    list: permissionProcedure("documents").query(async ({ ctx }) => documentsVisibleTo((await listDocuments()) ?? [], module => hasModulePermission(ctx.user, module))),
    create: permissionProcedure("documents").input(documentInput).mutation(async ({ ctx, input }) => { if (input.entityId) requireReferencePermission(ctx.user, documentModuleByType[input.entityType]); return requireRecord(await createDocument(input), "المستند"); }),
    update: permissionProcedure("documents").input(z.object({ id: z.number().int().positive(), data: documentInput.partial().refine(value => value.entityId === undefined || value.entityType !== undefined, { message: "حدد نوع الكيان عند تغيير ارتباط المستند" }) })).mutation(async ({ ctx, input }) => {
      const current = requireRecord(await getDocument(input.id), "المستند");
      const currentType = current.entityType as DocumentEntityType;
      if (current.entityId) requireReferencePermission(ctx.user, documentModuleByType[currentType]);
      const finalLink = resolveDocumentLink({ entityType: currentType, entityId: current.entityId }, input.data as { entityType?: DocumentEntityType; entityId?: number | null });
      if (finalLink.entityId) requireReferencePermission(ctx.user, documentModuleByType[finalLink.entityType]);
      return requireRecord(await updateDocument(input.id, input.data), "المستند");
    }),
    archive: permissionProcedure("documents").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const document = requireRecord(await getDocument(input.id), "المستند"); if (document.entityId) requireReferencePermission(ctx.user, documentModuleByType[document.entityType as DocumentEntityType]); return { success: await archiveDocument(input.id) }; }),
  }),
  clients: router({
    list: permissionProcedure("clients").query(async () => (await listClients()) ?? []),
    create: permissionProcedure("clients").input(clientInput).mutation(async ({ input }) => requireRecord(await createClient(input), "العميل")),
    update: permissionProcedure("clients").input(z.object({ id: z.number().int().positive(), data: clientInput.partial() })).mutation(async ({ input }) => requireRecord(await updateClient(input.id, input.data), "العميل")),
    archive: permissionProcedure("clients").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      if (!await archiveClient(input.id)) throw new TRPCError({ code: "CONFLICT", message: "لا يمكن أرشفة العميل قبل فك ارتباط المشاريع والمركبات والعقود النشطة" });
      return { success: true };
    }),
  }),
  payables: router({
    list: permissionProcedure("payables").query(async ({ ctx }) => payablesVisibleTo((await listPayables()) ?? [], permission => hasModulePermission(ctx.user, permission))),
    receipt: permissionProcedure("payables").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => { const receipt = await getPayableReceipt(input.id); if (receipt) requirePayableLinkAccess(ctx.user, receipt); return receipt ? { name: receipt.name, url: receipt.url } : null; }),
    create: permissionProcedure("payables").input(payableInput).mutation(async ({ ctx, input }) => { requirePayableLinkAccess(ctx.user, input); if (input.vehicleId && !input.vehicleCategory) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر فئة مصروف الباص المرتبط بالفاتورة" }); return requireRecord(await createPayable(input, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "فاتورة المورد"); }),
    update: permissionProcedure("payables").input(z.object({ id: z.number().int().positive(), data: payableInput.partial() })).mutation(async ({ ctx, input }) => { const current = (await listPayables() ?? []).find(row => row.id === input.id); requirePayableLinkAccess(ctx.user, current ?? {}); requirePayableLinkAccess(ctx.user, input.data); if (input.data.vehicleId && !(input.data.vehicleCategory ?? current?.vehicleCategory)) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر فئة مصروف الباص المرتبط بالفاتورة" }); return requireRecord(await updatePayable(input.id, input.data, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "فاتورة المورد"); }),
    updateStatus: permissionProcedure("payables").input(z.object({ id: z.number().int().positive(), status: z.enum(["معتمدة", "ملغاة"]) })).mutation(async ({ ctx, input }) => { const current = (await listPayables() ?? []).find(row => row.id === input.id); if (current) requirePayableLinkAccess(ctx.user, current); return requireRecord(await updatePayableStatus(input.id, input.status, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "فاتورة المورد"); }),
    registerPayment: permissionProcedure("payables").input(payablePaymentInput).mutation(async ({ ctx, input }) => { const current = (await listPayables() ?? []).find(row => row.id === input.payableId); if (current) requirePayableLinkAccess(ctx.user, current); return requireRecord(await registerPayablePayment(input), "الدفعة الصادرة"); }),
  }),
  reports: router({
    summary: permissionProcedure("reports").input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).query(async ({ ctx, input }) => {
      if (!isValidReportPeriod(input.from, input.to)) throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل نطاقًا صحيحًا؛ يجب أن يكون التاريخان صالحين والبداية قبل النهاية أو مساوية لها" });
      const report = requireRecord(await getCompanyReport(input.from, input.to), "التقرير");
      const sourceModules = ["finance", "vehicles", "maintenance", "projects", "documents", "employees", "drivers"];
      return scopeCompanyReport(report, sourceModules.filter(module => hasModulePermission(ctx.user, module)));
    }),
  }),
  claims: router({
    list: permissionProcedure("finance").query(async () => (await listClaims()) ?? []),
    create: permissionProcedure("finance").input(claimInput.omit({ paid: true })).mutation(async ({ input }) => requireRecord(await createClaim(input), "المطالبة")),
    update: permissionProcedure("finance").input(z.object({ id: z.number().int().positive(), data: claimInput.omit({ paid: true }).partial() })).mutation(async ({ input }) => requireRecord(await updateClaim(input.id, input.data), "المطالبة")),
    archive: permissionProcedure("finance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveClaim(input.id) })),
  }),
  contracts: router({
    list: permissionProcedure("finance").query(async () => (await listContracts()) ?? []),
    create: permissionProcedure("finance").input(contractInput).mutation(async ({ ctx, input }) => {
      if (input.clientId !== null) requireReferencePermission(ctx.user, "clients");
      if (input.items.some(item => item.vehicleId !== null)) requireReferencePermission(ctx.user, "vehicles");
      const { items, ...contract } = input;
      return requireRecord(await createContract(contract, items), "العقد");
    }),
    update: permissionProcedure("finance").input(z.object({ id: z.number().int().positive(), data: contractInput.partial() })).mutation(async ({ ctx, input }) => { if (input.data.clientId !== undefined) requireReferencePermission(ctx.user, "clients"); if (input.data.items?.some(item => item.vehicleId !== null)) requireReferencePermission(ctx.user, "vehicles"); const { items, ...contract } = input.data; return requireRecord(await updateContract(input.id, contract, items), "العقد"); }),
    updateStatus: permissionProcedure("finance").input(z.object({ id: z.number().int().positive(), status: z.enum(["قائم", "مكتمل", "عرض سعر", "ملغي"]) })).mutation(async ({ input }) => requireRecord(await updateContractStatus(input.id, input.status), "العقد")),
    archive: permissionProcedure("finance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveContract(input.id) })),
  }),
  tasks: router({
    list: permissionProcedure("dashboard").query(() => listTasks()),
    create: adminProcedure.input(taskInput).mutation(({ input }) => createTask(input)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), data: taskInput.partial() })).mutation(({ input }) => updateTask(input.id, input.data)),
  }),
  notifications: router({
    list: permissionProcedure("dashboard").query(async ({ ctx }) => notificationsVisibleTo(await listNotifications() ?? [], permission => hasModulePermission(ctx.user, permission))),
    create: adminProcedure.input(z.object({ type: z.string().max(60), title: z.string().max(200), message: z.string().max(4000), entityType: z.string().max(60).optional(), entityId: z.number().int().positive().optional(), severity: z.enum(["معلومة", "تنبيه", "حرج"]).default("معلومة") })).mutation(({ input }) => createNotification(input)),
    markRead: permissionProcedure("dashboard").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const notification = await getNotification(input.id); if (!notification) return false; const module = notificationModule(notification); if (module === "unknown") throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية لهذا التنبيه" }); if (module) requireReferencePermission(ctx.user, module); return markNotificationRead(input.id); }),
  }),
  payments: router({ list: permissionProcedure("finance").query(() => listPayments()), create: permissionProcedure("finance").input(paymentInput).mutation(({ input }) => createPayment(input)), update: permissionProcedure("finance").input(z.object({ id: z.number().int().positive(), data: paymentInput.partial() })).mutation(({ input }) => updatePayment(input.id, input.data)), archive: permissionProcedure("finance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archivePayment(input.id) })) }),
  vehicleRevenues: router({
    create: permissionProcedure("finance").input(vehicleRevenueInput).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "vehicles"); return requireRecord(await createVehicleRevenue(input, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }), "تخصيص إيراد الباص"); }),
    archive: permissionProcedure("finance").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { requireReferencePermission(ctx.user, "vehicles"); return { success: await archiveVehicleRevenue(input.id, { id: ctx.user.id, name: ctx.user.name || ctx.user.username || "—" }) }; }),
  }),
  representatives: router({ list: permissionProcedure("clients").input(z.object({ clientId: z.number().int().positive() })).query(({ input }) => listRepresentatives(input.clientId)), create: permissionProcedure("clients").input(representativeInput).mutation(({ input }) => createRepresentative(input)) }),
  users: router({
    list: adminProcedure.query(() => listUsers()),
    create: adminProcedure.input(userCreateInput).mutation(async ({ input }) => requireRecord(await createLocalUser(input), "المستخدم")),
    updateRole: adminProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(async ({ input }) => { try { return requireRecord(await updateUserRole(input.id, input.role), "المستخدم"); } catch (error) { if (error instanceof LastActiveAdminDemotionError) throw new TRPCError({ code: "FORBIDDEN", message: error.message }); throw error; } }),
    updateAccess: adminProcedure.input(z.object({ id: z.number().int().positive(), permissions: z.array(z.string().max(80)).max(30).optional(), password: z.string().min(8).max(200).optional() })).mutation(async ({ input }) => requireRecord(await updateUserAccess(input.id, input), "بيانات المستخدم")),
  }),
  settingsCatalog: router({ list: protectedProcedure.input(z.object({ category: z.string().optional() }).optional()).query(({ input }) => listSettings(input?.category)), create: permissionProcedure("settings").input(settingInput).mutation(async ({ input }) => requireRecord(await upsertSetting(input), "القيمة المرجعية")), update: permissionProcedure("settings").input(z.object({ id: z.number().int().positive(), data: settingInput.partial() })).mutation(async ({ input }) => requireRecord(await updateSetting(input.id, input.data), "القيمة المرجعية")), archive: permissionProcedure("settings").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await archiveSetting(input.id) })),
    delete: permissionProcedure("settings").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ success: await deleteSetting(input.id) })) }),
  audit: router({ list: adminProcedure.query(() => listAuditLogs()), record: adminProcedure.input(z.object({ action: z.string().max(80), entityType: z.string().max(80), entityId: z.number().int().positive().optional(), details: z.string().max(4000).optional() })).mutation(({ ctx, input }) => createAuditLog({ ...input, userId: ctx.user?.id ?? null })) }),
});

export type AppRouter = typeof appRouter;
