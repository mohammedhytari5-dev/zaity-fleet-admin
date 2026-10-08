import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { getMysqlConnectionOptions } from "./db-connection";
import { AuditLog, Claim, Client, Contract, ContractItem, Document, Driver, Employee, InsertEmployee, InsertClaim, InsertClient, InsertContract, InsertContractItem, InsertDocument, InsertDriver, InsertMaintenanceRequest, InsertUser, InsertVehicle, InsertVehicleExpense, VehicleExpense, InsertVehicleRevenue, VehicleRevenue, MaintenanceRequest, User, Vehicle, auditLogs, claims, clientRepresentatives, clients, contractItems, contracts, documents, drivers, employees, maintenanceEvents, maintenanceRequests, notifications, notificationReads, payments, vehicleExpenses, vehicleRevenues, settingCatalog, tasks, users, vehicles, InventoryItem, InsertInventoryItem, InventoryMovement, InsertInventoryMovement, inventoryItems, inventoryMovements, InventoryRequest, inventoryRequests, inventoryRequestItems, Accident, InsertAccident, accidents, AccidentEvent, accidentEvents } from "../drizzle/schema";
import { canAdvanceMaintenance, canCloseMaintenance, canEditMaintenanceQuote, hasMaintenanceQuote, statusForMaintenanceStage, type MaintenanceStage } from "../shared/maintenance-domain";
import { InsertProject, Project, projects } from "../drizzle/schema";
import { InsertPayable, Payable, PayablePayment, InsertPayablePayment, payables, payablePayments } from "../drizzle/schema";
import { ENV } from './_core/env';
import { summarizeMaintenanceItems } from "./vehicle-maintenance-summary";
import { canAcceptContractPayment, canArchiveClaim, canChangeClaimReferences, canSetContractCollection, canUpdateClaim, ClaimPaymentHistoryError, ClaimReferenceConflictError, validateClaimContractLink, validatePaymentLinkConsistency } from "./finance-domain";
import { isPayableExpensePosted } from "./payable-expense-policy";
import { hasPostedMaintenanceInvoices, maintenanceInvoiceTotal, shouldClearMaintenanceActualCost } from "./maintenance-invoice-total";
import { maintenanceExpenseTotalInPeriod } from "./maintenance-report";
import { isProtectedLastAdminDemotion } from "./user-role-domain";
import { notificationReadAtForUser } from "./notification-access";
import { isReceivableClaimStatus, outstandingClaimAmount, receivableAging, totalOutstandingClaims, countOutstandingClaims } from "../shared/receivables";
import { linkedVehicleDriverNameUpdate } from "./driver-domain";
import { deriveSingleVehicleAutoRevenues } from "./vehicle-revenue-allocation";
import { isValidReportPeriod, reportPeriodExclusiveEnd } from "./report-period";
import { groupIncomingPaymentsForReport, incomingPaymentRowsForReport } from "./report-ledger";
import { employeeAccountLinkError } from "./employee-account";
import { requiredPermissionsForStoredFile } from "./stored-file-access";
import { canAssignVehicleToContract, vehicleStatusAfterContractAssignment, vehicleStatusAfterContractRemoval } from "../shared/vehicle-contract-policy";
import { canUpdateTask } from "../shared/task-access";
import { formatCompanyDate, isCompanyDateBeforeToday, isWithinUpcomingDays, resolveDocumentStatus, resolveRenewalStatus } from "../shared/date-utils";
import { summarizePayableBalances } from "../shared/payable-report-summary";
import { nextInventoryBalance, nextInventoryRequestStatus, validateInventoryRequestAvailability, type InventoryDirection } from "./inventory-domain";
import { nextAccidentStage, type AccidentStage } from "./accident-domain";

let _db: ReturnType<typeof drizzle> | null = null;
let _authSchemaReady: Promise<void> | null = null;

async function ensureAuthSchema(db: ReturnType<typeof drizzle>) {
  const statements = [
    "ALTER TABLE `users` ADD COLUMN `passwordHash` TEXT NULL",
    "ALTER TABLE `users` ADD COLUMN `isActive` INT NOT NULL DEFAULT 1",
    "ALTER TABLE `users` ADD COLUMN `permissions` TEXT NULL",
    "ALTER TABLE `users` ADD COLUMN `username` VARCHAR(80) NULL",
    "CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`)",
  ];
  for (const statement of statements) {
    try {
      await db.execute(sql.raw(statement));
    } catch (error: any) {
      const message = String(error?.cause?.message || error?.message || error);
      if (!/Duplicate column|Duplicate key name|already exists|already has/i.test(message)) {
        console.warn(`[Database] Schema check skipped: ${message}`);
      }
    }
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const database = drizzle(createPool(getMysqlConnectionOptions(process.env.DATABASE_URL)));
      _db = database;
      _authSchemaReady = ensureAuthSchema(database).catch(error => {
        console.warn("[Database] Could not prepare authentication fields:", error);
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (_db && _authSchemaReady) await _authSchemaReady;
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.openId, openId), eq(users.isActive, 1))).limit(1);
  return result[0];
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.username, username.toLowerCase()), eq(users.isActive, 1))).limit(1);
  return result[0];
}

export async function authenticateLocalUser(username: string, password: string): Promise<User | null> {
  const user = await getUserByUsername(username);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) return null;
  const db = await getDb();
  if (!db) return null;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return { ...user, lastSignedIn: new Date() };
}

export async function createLocalUser(input: { name: string; username: string; password: string; role: "user" | "admin"; permissions?: string[] }) {
  const db = await getDb();
  if (!db) return null;
  const username = input.username.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing[0]) throw new Error("اسم المستخدم مستخدم بالفعل");
  const result = await db.insert(users).values({ openId: `local-${randomBytes(18).toString("hex")}`, name: input.name.trim(), username, loginMethod: "local", passwordHash: hashPassword(input.password), role: input.role, permissions: JSON.stringify(input.permissions ?? []), isActive: 1 });
  return (await db.select({ id: users.id, name: users.name, username: users.username, role: users.role, permissions: users.permissions, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, Number(result[0].insertId))).limit(1))[0] ?? null;
}

export async function listVehicles(): Promise<Vehicle[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vehicles).where(isNull(vehicles.archivedAt)).orderBy(desc(vehicles.createdAt));
}
export async function listVehicleFinancialSummaries() {
  const db = await getDb();
  if (!db) return null;
  const [expenses, revenues, payableRows] = await Promise.all([
    db.select({ vehicleId: vehicleExpenses.vehicleId, amount: vehicleExpenses.amount, payableId: vehicleExpenses.payableId }).from(vehicleExpenses).where(isNull(vehicleExpenses.archivedAt)),
    db.select({ vehicleId: vehicleRevenues.vehicleId, amount: vehicleRevenues.amount }).from(vehicleRevenues).where(isNull(vehicleRevenues.archivedAt)),
    db.select({ id: payables.id, status: payables.status }).from(payables).where(isNull(payables.archivedAt)),
  ]);
  const postedPayables = new Set(payableRows.filter(row => isPayableExpensePosted(row.status)).map(row => row.id));
  const postedExpenses = expenses.filter(row => row.payableId === null || postedPayables.has(row.payableId));
  const summary = new Map<number, { expenseTotal: number; revenueTotal: number }>();
  for (const row of postedExpenses) { const item = summary.get(row.vehicleId) ?? { expenseTotal: 0, revenueTotal: 0 }; item.expenseTotal += Number(row.amount || 0); summary.set(row.vehicleId, item); }
  for (const row of revenues) { const item = summary.get(row.vehicleId) ?? { expenseTotal: 0, revenueTotal: 0 }; item.revenueTotal += Number(row.amount || 0); summary.set(row.vehicleId, item); }
  return Object.fromEntries(Array.from(summary.entries()).map(([id, value]) => [id, { ...value, netOperatingReturn: value.revenueTotal - value.expenseTotal }]));
}

export async function getVehicleFinancialProfile(vehicleId: number) {
  const db = await getDb();
  if (!db) return null;
  const vehicle = (await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
  if (!vehicle) return null;
  const [expenses, revenueRows, paymentRows, contractRows, contractItemRows, claimRows, projectRows, clientRows, allAllocations, payableRows, maintenanceRows] = await Promise.all([
    db.select().from(vehicleExpenses).where(and(eq(vehicleExpenses.vehicleId, vehicleId), isNull(vehicleExpenses.archivedAt))).orderBy(desc(vehicleExpenses.spentAt), desc(vehicleExpenses.createdAt)),
    db.select().from(vehicleRevenues).where(and(eq(vehicleRevenues.vehicleId, vehicleId), isNull(vehicleRevenues.archivedAt))).orderBy(desc(vehicleRevenues.createdAt)),
    db.select().from(payments).where(isNull(payments.archivedAt)).orderBy(desc(payments.paidAt)),
    db.select().from(contracts), db.select().from(contractItems), db.select().from(claims), db.select().from(projects), db.select().from(clients),
    db.select({ paymentId: vehicleRevenues.paymentId, amount: vehicleRevenues.amount }).from(vehicleRevenues).where(isNull(vehicleRevenues.archivedAt)),
    db.select({ id: payables.id, receiptUrl: payables.receiptUrl, status: payables.status, maintenanceRequestId: payables.maintenanceRequestId }).from(payables).where(and(eq(payables.vehicleId, vehicleId), isNull(payables.archivedAt))),
    db.select({ id: maintenanceRequests.id, type: maintenanceRequests.type }).from(maintenanceRequests).where(eq(maintenanceRequests.vehicleId, vehicleId)),
  ]);
  const paymentById = new Map(paymentRows.map(row => [row.id, row]));
  const contractById = new Map(contractRows.map(row => [row.id, row]));
  const claimById = new Map(claimRows.map(row => [row.id, row]));
  const usedByPayment = new Map<number, number>();
  for (const row of allAllocations) usedByPayment.set(row.paymentId, (usedByPayment.get(row.paymentId) ?? 0) + Number(row.amount || 0));
  const revenueDetails = revenueRows.map(allocation => {
    const payment = paymentById.get(allocation.paymentId);
    const contractId = payment?.contractId ?? (payment?.claimId ? claimById.get(payment.claimId)?.contractId : null);
    const contract = contractId ? contractById.get(contractId) : undefined;
    const { receiptUrl, ...safeAllocation } = allocation;
    return { ...safeAllocation, hasReceipt: Boolean(receiptUrl), paidAt: payment?.paidAt ?? "—", method: payment?.method ?? "—", reference: payment?.reference ?? "—", contractRef: contract?.ref ?? "—", client: allocation.clientName || contract?.client || "—" };
  });
  const autoLinkedPayments = deriveSingleVehicleAutoRevenues({
    payments: paymentRows,
    claims: claimRows,
    contracts: contractRows,
    contractItems: contractItemRows,
    vehicles: [vehicle],
    projects: projectRows,
    clients: clientRows,
    allocations: allAllocations,
  });
  const allRevenueDetails = [...revenueDetails, ...autoLinkedPayments].sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
  const payableReceipts = new Set(payableRows.filter(row => Boolean(row.receiptUrl)).map(row => row.id));
  const payableById = new Map(payableRows.map(row => [row.id, row]));
  const maintenanceTypeByRequestId = new Map(maintenanceRows.map(row => [row.id, row.type]));
  const postedPayableIds = new Set(payableRows.filter(row => isPayableExpensePosted(row.status)).map(row => row.id));
  const postedExpenses = expenses.filter(expense => expense.payableId === null || postedPayableIds.has(expense.payableId));
  const expensesWithMaintenance = postedExpenses.map(expense => ({
    ...expense,
    maintenanceItem: expense.maintenanceRequestId ? maintenanceTypeByRequestId.get(expense.maintenanceRequestId) ?? null : expense.payableId ? maintenanceTypeByRequestId.get(payableById.get(expense.payableId)?.maintenanceRequestId ?? -1) ?? null : null,
  }));
  const safeExpenses = expensesWithMaintenance.map(({ receiptUrl, ...expense }) => ({ ...expense, hasReceipt: Boolean(receiptUrl) || Boolean(expense.payableId && payableReceipts.has(expense.payableId)) }));
  const maintenanceItemTotals = summarizeMaintenanceItems(expensesWithMaintenance);
  const allocatablePayments = paymentRows.flatMap(payment => {
    const contractId = payment.contractId ?? (payment.claimId ? claimById.get(payment.claimId)?.contractId : null);
    if (!contractId) return [];
    const contract = contractById.get(contractId);
    if (!contract) return [];
    const items = contractItemRows.filter(item => item.contractId === contractId);
    const linked = items.length ? items.some(item => item.vehicleId === vehicleId) : vehicle.contractId === contractId;
    if (!linked) return [];
    const remaining = Math.max(0, Number(payment.amount || 0) - (usedByPayment.get(payment.id) ?? 0));
    const linkedVehicleIds = Array.from(new Set(items.map(item => item.vehicleId).filter((id): id is number => id !== null)));
    const isSingleVehicleContract = items.length ? linkedVehicleIds.length === 1 && linkedVehicleIds[0] === vehicleId : vehicle.contractId === contractId;
    if (!remaining || isSingleVehicleContract) return [];
    return [{ id: payment.id, amount: Number(payment.amount), paidAt: payment.paidAt, method: payment.method, reference: payment.reference, contractId, contractRef: contract.ref, client: clientRows.find(client => client.id === (payment.clientId ?? contract.clientId))?.name ?? contract.client, remaining }];
  });
  const categoryTotals: Record<string, number> = {};
  for (const expense of expenses) categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + Number(expense.amount || 0);
  const expenseTotal = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const revenueTotal = allRevenueDetails.reduce((total, revenue) => total + Number(revenue.amount || 0), 0);
  const purchasePrice = Number(vehicle.purchasePrice || 0);
  return {
    vehicle, expenses: safeExpenses, revenues: allRevenueDetails, allocatablePayments, categoryTotals, maintenanceItemTotals,
    purchasePrice, expenseTotal, investedTotal: purchasePrice + expenseTotal, revenueTotal,
    netCashReturn: revenueTotal - purchasePrice - expenseTotal,
    project: projectRows.find(project => project.id === vehicle.projectId)?.name ?? vehicle.project,
    client: clientRows.find(client => client.id === vehicle.clientId)?.name ?? vehicle.client,
  };
}

export async function getVehicleReceipt(vehicleId: number, kind: "expense" | "revenue" | "maintenance", recordId: number) {
  const db = await getDb();
  if (!db) return null;
  if (kind === "maintenance") {
    const row = (await db.select({ receiptName: maintenanceRequests.receiptName, receiptUrl: maintenanceRequests.receiptUrl }).from(maintenanceRequests).where(and(eq(maintenanceRequests.id, recordId), eq(maintenanceRequests.vehicleId, vehicleId))).limit(1))[0];
    return row?.receiptUrl ? { name: row.receiptName || "مرفق صيانة", url: row.receiptUrl } : null;
  }
  if (kind === "expense") {
    const row = (await db.select({ receiptName: vehicleExpenses.receiptName, receiptUrl: vehicleExpenses.receiptUrl, payableId: vehicleExpenses.payableId }).from(vehicleExpenses).where(and(eq(vehicleExpenses.id, recordId), eq(vehicleExpenses.vehicleId, vehicleId), isNull(vehicleExpenses.archivedAt))).limit(1))[0];
    if (row?.receiptUrl) return { name: row.receiptName || "مرفق مالي", url: row.receiptUrl };
    if (row?.payableId) { const payable = (await db.select({ receiptName: payables.receiptName, receiptUrl: payables.receiptUrl }).from(payables).where(and(eq(payables.id, row.payableId), isNull(payables.archivedAt))).limit(1))[0]; if (payable?.receiptUrl) return { name: payable.receiptName || row.receiptName || "فاتورة مورد", url: payable.receiptUrl }; }
    return null;
  }
  const row = (await db.select({ receiptName: vehicleRevenues.receiptName, receiptUrl: vehicleRevenues.receiptUrl }).from(vehicleRevenues).where(and(eq(vehicleRevenues.id, recordId), eq(vehicleRevenues.vehicleId, vehicleId), isNull(vehicleRevenues.archivedAt))).limit(1))[0];
  return row?.receiptUrl ? { name: row.receiptName || "إيصال إيراد", url: row.receiptUrl } : null;
}

export async function createVehicleExpense(input: Pick<InsertVehicleExpense, "vehicleId" | "category" | "amount" | "spentAt" | "description" | "vendor" | "receiptName" | "receiptUrl" | "notes">, actor: LedgerActor) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const vehicle = (await tx.select().from(vehicles).where(and(eq(vehicles.id, input.vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
    if (!vehicle) return null;
    const result = await tx.insert(vehicleExpenses).values({ ...input, projectId: vehicle.projectId ?? null, projectName: vehicle.project || "—", clientId: vehicle.clientId ?? null, clientName: vehicle.client || "—", createdByUserId: actor.id ?? null, createdByName: actor.name || "—", updatedByUserId: actor.id ?? null, updatedByName: actor.name || "—" });
    return (await tx.select().from(vehicleExpenses).where(eq(vehicleExpenses.id, Number(result[0].insertId))).limit(1))[0] ?? null;
  });
}
export async function updateVehicleExpense(id: number, input: Partial<Pick<InsertVehicleExpense, "category" | "amount" | "spentAt" | "description" | "vendor" | "receiptName" | "receiptUrl" | "notes">>, actor: LedgerActor) {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(vehicleExpenses).where(and(eq(vehicleExpenses.id, id), isNull(vehicleExpenses.archivedAt))).limit(1))[0];
  if (!current || current.maintenanceRequestId) return null;
  await db.update(vehicleExpenses).set({ ...input, updatedByUserId: actor.id ?? null, updatedByName: actor.name || "—" }).where(eq(vehicleExpenses.id, id));
  return (await db.select().from(vehicleExpenses).where(eq(vehicleExpenses.id, id)).limit(1))[0] ?? null;
}
export async function archiveVehicleExpense(id: number, actor: LedgerActor) {
  const db = await getDb();
  if (!db) return false;
  const current = (await db.select().from(vehicleExpenses).where(and(eq(vehicleExpenses.id, id), isNull(vehicleExpenses.archivedAt))).limit(1))[0];
  if (!current || current.maintenanceRequestId) return false;
  await db.update(vehicleExpenses).set({ archivedAt: new Date(), archivedByUserId: actor.id ?? null, archivedByName: actor.name || "—" }).where(eq(vehicleExpenses.id, id));
  return true;
}
export async function createVehicleRevenue(input: Pick<InsertVehicleRevenue, "vehicleId" | "paymentId" | "amount" | "receiptName" | "receiptUrl" | "notes">, actor: LedgerActor) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM payments WHERE id = ${input.paymentId} FOR UPDATE`);
    const vehicle = (await tx.select().from(vehicles).where(and(eq(vehicles.id, input.vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
    const payment = (await tx.select().from(payments).where(and(eq(payments.id, input.paymentId), isNull(payments.archivedAt))).limit(1))[0];
    if (!vehicle || !payment) return null;
    const claim = payment.claimId ? (await tx.select().from(claims).where(eq(claims.id, payment.claimId)).limit(1))[0] : undefined;
    const contractId = payment.contractId ?? claim?.contractId;
    if (!contractId) throw new Error("لا يمكن تخصيص دفعة غير مرتبطة بعقد إلى باص");
    const contract = (await tx.select().from(contracts).where(eq(contracts.id, contractId)).limit(1))[0];
    if (!contract) throw new Error("العقد المرتبط بالإيراد غير موجود");
    const items = await tx.select().from(contractItems).where(eq(contractItems.contractId, contractId));
    if (items.length ? !items.some(item => item.vehicleId === vehicle.id) : vehicle.contractId !== contractId) throw new Error("هذا الباص غير مرتبط بالعقد المصدر للإيراد؛ لا يمكن نسبته إليه تلقائيًا");
    const allocations = await tx.select({ amount: vehicleRevenues.amount }).from(vehicleRevenues).where(and(eq(vehicleRevenues.paymentId, payment.id), isNull(vehicleRevenues.archivedAt)));
    const allocated = allocations.reduce((total, row) => total + Number(row.amount || 0), 0);
    if (Number(input.amount) > Number(payment.amount) - allocated) throw new Error(`المبلغ يتجاوز الجزء غير الموزع من الدفعة (${Math.max(0, Number(payment.amount) - allocated)} SAR)`);
    const project = (await tx.select().from(projects).where(and(eq(projects.contractId, contractId), isNull(projects.archivedAt))).limit(1))[0];
    const clientId = payment.clientId ?? contract.clientId ?? (vehicle.contractId === contractId ? vehicle.clientId : null);
    const client = clientId ? (await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId)).limit(1))[0] : undefined;
    const result = await tx.insert(vehicleRevenues).values({ ...input, projectId: project?.id ?? (vehicle.contractId === contractId ? vehicle.projectId : null), projectName: project?.name ?? (vehicle.contractId === contractId ? vehicle.project : "—"), clientId: clientId ?? null, clientName: client?.name ?? contract.client ?? vehicle.client ?? "—", createdByUserId: actor.id ?? null, createdByName: actor.name || "—" });
    return (await tx.select().from(vehicleRevenues).where(eq(vehicleRevenues.id, Number(result[0].insertId))).limit(1))[0] ?? null;
  });
}
export async function archiveVehicleRevenue(id: number, actor: LedgerActor) {
  const db = await getDb();
  if (!db) return false;
  const current = (await db.select().from(vehicleRevenues).where(and(eq(vehicleRevenues.id, id), isNull(vehicleRevenues.archivedAt))).limit(1))[0];
  if (!current) return false;
  await db.update(vehicleRevenues).set({ archivedAt: new Date(), archivedByUserId: actor.id ?? null, archivedByName: actor.name || "—" }).where(eq(vehicleRevenues.id, id));
  return true;
}

export async function createVehicle(input: InsertVehicle): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = { ...input };
  let linkedProject: Project | undefined;
  if (input.projectId) {
    const project = (await db.select().from(projects).where(and(eq(projects.id, input.projectId), isNull(projects.archivedAt))).limit(1))[0];
    if (!project) return null;
    if (project.clientId && input.clientId && project.clientId !== input.clientId) return null;
    if (project.contractId && input.contractId && project.contractId !== input.contractId) return null;
    linkedProject = project;
    normalized.project = project.name;
  } else normalized.project = "—";
  if (input.clientId) {
    const client = (await db.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0];
    if (!client) return null;
    normalized.client = client.name;
  } else normalized.client = "—";
  if (input.contractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1).for("update"))[0];
    if (!contract || (input.clientId && contract.clientId && input.clientId !== contract.clientId)) return null;
    normalized.contract = contract.ref;
    normalized.clientId = contract.clientId ?? input.clientId ?? null;
    normalized.client = contract.client;
  } else normalized.contract = "—";
  if (linkedProject?.clientId) {
    normalized.clientId = linkedProject.clientId;
    normalized.client = linkedProject.client;
  }
  if (linkedProject?.contractId) {
    const projectContract = (await db.select().from(contracts).where(and(eq(contracts.id, linkedProject.contractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!projectContract) return null;
    if (input.clientId && projectContract.clientId && input.clientId !== projectContract.clientId) return null;
    normalized.contractId = projectContract.id;
    normalized.contract = projectContract.ref;
    normalized.clientId = projectContract.clientId ?? linkedProject.clientId ?? null;
    normalized.client = projectContract.client;
  }
  if (input.employeeId) {
    const employee = (await db.select().from(employees).where(and(eq(employees.id, input.employeeId), isNull(employees.archivedAt))).limit(1))[0];
    if (!employee || employee.status !== "نشط") return null;
    normalized.employee = employee.name;
  } else normalized.employee = "—";
  return db.transaction(async tx => {
    const linkedContractId = normalized.contractId ?? null;
    if (linkedContractId) {
      const contract = (await tx.select().from(contracts).where(and(eq(contracts.id, linkedContractId), isNull(contracts.archivedAt))).limit(1).for("update"))[0];
      if (!contract) return null;
      normalized.contract = contract.ref;
      normalized.clientId = contract.clientId ?? input.clientId ?? null;
      normalized.client = contract.client;
      normalized.status = "مؤجرة";
    }
    const result = await tx.insert(vehicles).values(normalized);
    const id = Number(result[0].insertId);
    if (linkedContractId) await tx.insert(contractItems).values({ contractId: linkedContractId, vehicleId: id, vehiclePlate: normalized.plate, driver: normalized.driver || "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" });
    return (await tx.select().from(vehicles).where(eq(vehicles.id, id)).limit(1))[0] ?? null;
  });
}

export async function updateVehicle(id: number, input: Partial<InsertVehicle>): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.archivedAt))).limit(1))[0];
  if (!current) return null;
  const relationshipChanged = input.projectId !== undefined || input.clientId !== undefined || input.contractId !== undefined;
  if (relationshipChanged) {
    const nextProjectId = input.projectId === undefined ? current.projectId : input.projectId;
    const project = nextProjectId ? (await db.select().from(projects).where(and(eq(projects.id, nextProjectId), isNull(projects.archivedAt))).limit(1))[0] : undefined;
    const nextContractId = input.contractId ? input.contractId : project?.contractId ?? (input.contractId === null ? null : current.contractId);
    const contract = nextContractId ? (await db.select().from(contracts).where(and(eq(contracts.id, nextContractId), isNull(contracts.archivedAt))).limit(1))[0] : undefined;
    const nextClientId = input.clientId ? input.clientId : project?.clientId ?? contract?.clientId ?? (input.clientId === null ? null : current.clientId);
    const client = nextClientId ? (await db.select().from(clients).where(and(eq(clients.id, nextClientId), isNull(clients.archivedAt))).limit(1))[0] : undefined;
    if ((nextProjectId && !project) || (nextClientId && !client) || (nextContractId && !contract)) return null;
    if (project?.clientId && nextClientId && project.clientId !== nextClientId) return null;
    if (project?.contractId && project.contractId !== nextContractId) return null;
    if (contract?.clientId && nextClientId && contract.clientId !== nextClientId) return null;
  }
  const normalized = { ...input };
  let linkedProject: Project | undefined;
  if (input.projectId !== undefined) {
    if (input.projectId === null) normalized.project = "—";
    else {
      const project = (await db.select().from(projects).where(and(eq(projects.id, input.projectId), isNull(projects.archivedAt))).limit(1))[0];
      if (!project) return null;
      if (project.clientId && input.clientId && project.clientId !== input.clientId) return null;
      if (project.contractId && input.contractId && project.contractId !== input.contractId) return null;
      linkedProject = project;
      normalized.project = project.name;
    }
  } else delete normalized.project;
  if (input.clientId !== undefined) {
    if (input.clientId === null) normalized.client = "—";
    else {
      const client = (await db.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0];
      if (!client) return null;
      normalized.client = client.name;
    }
  } else delete normalized.client;
  if (input.contractId !== undefined) {
    if (input.contractId === null) normalized.contract = "—";
    else {
      const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1))[0];
      if (!contract || (input.clientId && contract.clientId && input.clientId !== contract.clientId)) return null;
      normalized.contract = contract.ref;
      normalized.clientId = contract.clientId ?? input.clientId ?? null;
      normalized.client = contract.client;
    }
  } else delete normalized.contract;
  if (linkedProject?.clientId) {
    normalized.clientId = linkedProject.clientId;
    normalized.client = linkedProject.client;
  }
  if (linkedProject?.contractId) {
    const projectContract = (await db.select().from(contracts).where(and(eq(contracts.id, linkedProject.contractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!projectContract) return null;
    if (input.clientId && projectContract.clientId && input.clientId !== projectContract.clientId) return null;
    normalized.contractId = projectContract.id;
    normalized.contract = projectContract.ref;
    normalized.clientId = projectContract.clientId ?? linkedProject.clientId ?? null;
    normalized.client = projectContract.client;
  }
  if (input.employeeId !== undefined) {
    if (input.employeeId === null) normalized.employee = input.employee ?? "—";
    else {
      const employee = (await db.select().from(employees).where(and(eq(employees.id, input.employeeId), isNull(employees.archivedAt))).limit(1))[0];
      if (!employee || employee.status !== "نشط") return null;
      normalized.employee = employee.name;
    }
  } else delete normalized.employee;
  return db.transaction(async tx => {
    const locked = (await tx.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.archivedAt))).limit(1).for("update"))[0];
    if (!locked) return null;
    const nextContractId = normalized.contractId === undefined ? locked.contractId : normalized.contractId;
    if (nextContractId !== locked.contractId) {
      const nextContract = nextContractId ? (await tx.select().from(contracts).where(and(eq(contracts.id, nextContractId), isNull(contracts.archivedAt))).limit(1).for("update"))[0] : undefined;
      if (nextContractId && !nextContract) return null;
      if (nextContractId) {
        const conflictingItem = (await tx.select({ id: contractItems.id }).from(contractItems).where(and(eq(contractItems.vehicleId, id), ne(contractItems.contractId, nextContractId))).limit(1))[0];
        if (conflictingItem) return null;
      }
      if (locked.contractId) await tx.delete(contractItems).where(and(eq(contractItems.contractId, locked.contractId), eq(contractItems.vehicleId, id)));
      if (nextContract) {
        const existingItem = (await tx.select({ id: contractItems.id }).from(contractItems).where(and(eq(contractItems.contractId, nextContract.id), eq(contractItems.vehicleId, id))).limit(1))[0];
        if (!existingItem) await tx.insert(contractItems).values({ contractId: nextContract.id, vehicleId: id, vehiclePlate: input.plate ?? locked.plate, driver: input.driver ?? locked.driver ?? "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" });
        normalized.contract = nextContract.ref;
        normalized.clientId = nextContract.clientId ?? input.clientId ?? locked.clientId ?? null;
        normalized.client = nextContract.client;
        if (input.status === undefined) normalized.status = "مؤجرة";
      } else {
        normalized.contract = "—";
        normalized.contractId = null;
        if (input.status === undefined) normalized.status = "متاحة";
      }
    }
    if (locked.contractId && (input.plate !== undefined || input.driver !== undefined)) {
      await tx.update(contractItems).set({ ...(input.plate !== undefined ? { vehiclePlate: input.plate } : {}), ...(input.driver !== undefined ? { driver: input.driver } : {}) }).where(and(eq(contractItems.contractId, locked.contractId), eq(contractItems.vehicleId, id)));
    }
    await tx.update(vehicles).set(normalized).where(eq(vehicles.id, id));
    return (await tx.select().from(vehicles).where(eq(vehicles.id, id)).limit(1))[0] ?? null;
  });
}

export async function archiveVehicle(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const vehicle = (await tx.select().from(vehicles).where(eq(vehicles.id, id)).limit(1))[0];
    if (!vehicle) return false;
    if (vehicle.driverId) await tx.update(drivers).set({ vehicleId: null, vehicle: "—", status: "متاح" }).where(eq(drivers.id, vehicle.driverId));
    await tx.update(vehicles).set({ driverId: null, driver: "—", archivedAt: new Date() }).where(eq(vehicles.id, id));
    return true;
  });
}

export async function listDrivers(): Promise<Driver[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(drivers).where(isNull(drivers.archivedAt)).orderBy(desc(drivers.createdAt));
}
export async function listEmployees(): Promise<Employee[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(employees).where(isNull(employees.archivedAt)).orderBy(desc(employees.createdAt));
}
export async function createEmployee(input: InsertEmployee): Promise<Employee | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(employees).values(input);
  const id = Number(result[0].insertId);
  return (await db.select().from(employees).where(eq(employees.id, id)).limit(1))[0] ?? null;
}
export async function updateEmployee(id: number, input: Partial<InsertEmployee>): Promise<Employee | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(employees).set(input).where(and(eq(employees.id, id), isNull(employees.archivedAt)));
  return (await db.select().from(employees).where(eq(employees.id, id)).limit(1))[0] ?? null;
}
export async function archiveEmployee(id: number, actor: LedgerActor = {}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const initial = (await tx.select({ id: employees.id, userId: employees.userId }).from(employees).where(and(eq(employees.id, id), isNull(employees.archivedAt))).limit(1))[0];
    if (!initial) return false;
    const lockedUsers = initial.userId !== null
      ? await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).orderBy(users.id).for("update")
      : [];
    const employee = (await tx.select().from(employees).where(and(eq(employees.id, id), isNull(employees.archivedAt))).limit(1).for("update"))[0];
    if (!employee) return false;
    if (employee.userId !== initial.userId) throw new Error("تغير حساب الموظف أثناء الإنهاء؛ أعد المحاولة للتأكد من تعطيل الحساب الصحيح");
    if (employee.userId !== null) {
      const account = lockedUsers.find(user => user.id === employee.userId);
      if (account?.role === "admin" && account.isActive === 1) {
        if (lockedUsers.filter(user => user.role === "admin" && user.isActive === 1).length <= 1) throw new Error("لا يمكن إنهاء ملف الموظف المرتبط بآخر مدير نشط؛ انقل صلاحية الإدارة أولًا");
      }
      await tx.update(users).set({ isActive: 0 }).where(eq(users.id, employee.userId));
    }
    await tx.update(vehicles).set({ employeeId: null }).where(eq(vehicles.employeeId, id));
    await tx.update(projects).set({ managerEmployeeId: null }).where(eq(projects.managerEmployeeId, id));
    await tx.update(employees).set({ status: "منتهي الخدمة", archivedAt: new Date() }).where(eq(employees.id, id));
    await recordAuditInTransaction(tx, actor, "employees.archive", "employees", id, employee.userId ? `أرشفة الموظف وفصل إسناداته وتعطيل حساب المستخدم #${employee.userId}` : "أرشفة الموظف وفصل إسناداته التشغيلية");
    return true;
  });
}
export async function linkEmployeeUser(employeeId: number, userId: number | null, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const account = userId !== null
      ? (await tx.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.id, userId)).limit(1).for("update"))[0]
      : undefined;
    if (userId !== null) {
      const linkedEmployee = (await tx.select({ id: employees.id }).from(employees).where(eq(employees.userId, userId)).limit(1).for("update"))[0];
      const linkError = employeeAccountLinkError({ userExists: Boolean(account), userActive: account?.isActive === 1, employeeId, linkedEmployeeId: linkedEmployee?.id ?? null });
      if (linkError) throw new Error(linkError);
    }
    const employee = (await tx.select().from(employees).where(and(eq(employees.id, employeeId), isNull(employees.archivedAt))).limit(1).for("update"))[0];
    if (!employee) return null;
    await tx.update(employees).set({ userId }).where(eq(employees.id, employeeId));
    const saved = (await tx.select().from(employees).where(eq(employees.id, employeeId)).limit(1))[0] ?? null;
    if (saved) await recordAuditInTransaction(tx, actor, userId === null ? "employees.account.unlink" : "employees.account.link", "employees", employeeId, userId === null ? "فصل حساب النظام عن ملف الموظف" : `ربط حساب النظام #${userId} بملف الموظف`);
    return saved;
  });
}
export async function listProjects(): Promise<(Project & { actualVehicles: number })[] | null> {
  const db = await getDb();
  if (!db) return null;
  const [projectRows, vehicleRows] = await Promise.all([
    db.select().from(projects).where(isNull(projects.archivedAt)).orderBy(desc(projects.createdAt)),
    db.select({ projectId: vehicles.projectId }).from(vehicles).where(isNull(vehicles.archivedAt)),
  ]);
  return projectRows.map(project => ({ ...project, actualVehicles: vehicleRows.filter(vehicle => vehicle.projectId === project.id).length }));
}
export async function createProject(input: InsertProject): Promise<Project | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = { ...input };
  if (input.clientId) {
    const client = (await db.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0];
    if (!client) return null;
    normalized.client = client.name;
  }
  if (input.contractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1).for("update"))[0];
    if (!contract || (input.clientId && contract.clientId && input.clientId !== contract.clientId)) return null;
    normalized.contract = contract.ref;
    if (contract.clientId) normalized.clientId = contract.clientId;
    normalized.client = contract.client;
  }
  if (input.managerEmployeeId) {
    const employee = (await db.select().from(employees).where(and(eq(employees.id, input.managerEmployeeId), isNull(employees.archivedAt))).limit(1))[0];
    if (!employee || employee.status !== "نشط") return null;
    normalized.manager = employee.name;
  }
  const result = await db.insert(projects).values(normalized);
  const id = Number(result[0].insertId);
  return (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0] ?? null;
}
export async function updateProject(id: number, input: Partial<InsertProject>): Promise<Project | null> {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(projects).where(and(eq(projects.id, id), isNull(projects.archivedAt))).limit(1))[0];
  if (!current) return null;
  const normalized = { ...input };
  const nextClientId = input.clientId === undefined ? current.clientId : input.clientId;
  const nextContractId = input.contractId === undefined ? current.contractId : input.contractId;
  if (input.contractId !== undefined && nextContractId !== current.contractId) {
    const assignedVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.projectId, id), isNull(vehicles.archivedAt))).limit(1);
    if (assignedVehicles.length) return null;
  }
  if (input.clientId !== undefined) {
    if (input.clientId === null) normalized.client = input.client ?? "—";
    else {
      const client = (await db.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0];
      if (!client) return null;
      normalized.client = client.name;
    }
  }
  if (input.contractId !== undefined) {
    if (input.contractId === null) normalized.contract = input.contract ?? "—";
    else {
      const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1))[0];
      if (!contract || (nextClientId && contract.clientId && nextClientId !== contract.clientId)) return null;
      normalized.contract = contract.ref;
      if (contract.clientId) {
        normalized.clientId = contract.clientId;
        normalized.client = contract.client;
      }
    }
  }
  if (nextContractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, nextContractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!contract || (contract.clientId && nextClientId && contract.clientId !== nextClientId)) return null;
    if (contract.clientId) {
      normalized.clientId = contract.clientId;
      normalized.client = contract.client;
    }
  }
  if (input.clientId !== undefined && input.clientId !== current.clientId) {
    const assignedVehicles = await db.select({ contractId: vehicles.contractId }).from(vehicles).where(and(eq(vehicles.projectId, id), isNull(vehicles.archivedAt)));
    for (const vehicle of assignedVehicles) {
      if (!vehicle.contractId) continue;
      const vehicleContract = (await db.select({ clientId: contracts.clientId }).from(contracts).where(and(eq(contracts.id, vehicle.contractId), isNull(contracts.archivedAt))).limit(1))[0];
      if (vehicleContract?.clientId && vehicleContract.clientId !== nextClientId) return null;
    }
  }
  if (input.managerEmployeeId !== undefined) {
    if (input.managerEmployeeId === null) normalized.manager = input.manager ?? "—";
    else {
      const employee = (await db.select().from(employees).where(and(eq(employees.id, input.managerEmployeeId), isNull(employees.archivedAt))).limit(1))[0];
      if (!employee || employee.status !== "نشط") return null;
      normalized.manager = employee.name;
    }
  }
  await db.update(projects).set(normalized).where(and(eq(projects.id, id), isNull(projects.archivedAt)));
  if (input.name !== undefined || input.clientId !== undefined || input.client !== undefined) {
    const updatedProject = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
    if (updatedProject) await db.update(vehicles).set({ ...(input.name !== undefined ? { project: input.name } : {}), ...(input.clientId !== undefined || input.client !== undefined ? { clientId: updatedProject.clientId, client: updatedProject.client } : {}) }).where(and(eq(vehicles.projectId, id), isNull(vehicles.archivedAt)));
  }
  return (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0] ?? null;
}
export async function archiveProject(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const current = (await tx.select().from(projects).where(and(eq(projects.id, id), isNull(projects.archivedAt))).limit(1))[0];
    if (!current) return false;
    const assigned = await tx.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.projectId, id), isNull(vehicles.archivedAt))).limit(1);
    if (assigned.length) return false;
    await tx.update(projects).set({ archivedAt: new Date() }).where(eq(projects.id, id));
    return true;
  });
}
export async function createDriver(input: InsertDriver): Promise<Driver | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(drivers).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return created[0] ?? null;
}

export async function updateDriver(id: number, input: Partial<InsertDriver>): Promise<Driver | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const current = (await tx.select().from(drivers).where(and(eq(drivers.id, id), isNull(drivers.archivedAt))).limit(1))[0];
    if (!current) return null;
    await tx.update(drivers).set(input).where(and(eq(drivers.id, id), isNull(drivers.archivedAt)));
    const linkedNameUpdate = linkedVehicleDriverNameUpdate(current, input.name);
    if (linkedNameUpdate) {
      await tx.update(vehicles).set({ driver: linkedNameUpdate.name }).where(and(eq(vehicles.id, linkedNameUpdate.vehicleId), eq(vehicles.driverId, id), isNull(vehicles.archivedAt)));
    }
    const updated = await tx.select().from(drivers).where(and(eq(drivers.id, id), isNull(drivers.archivedAt))).limit(1);
    return updated[0] ?? null;
  });
}

export async function archiveDriver(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const driver = (await tx.select().from(drivers).where(eq(drivers.id, id)).limit(1))[0];
    if (!driver) return false;
    if (driver.vehicleId) await tx.update(vehicles).set({ driverId: null, driver: "—" }).where(eq(vehicles.id, driver.vehicleId));
    await tx.update(drivers).set({ vehicleId: null, vehicle: "—", status: "متاح", archivedAt: new Date() }).where(eq(drivers.id, id));
    return true;
  });
}

export async function assignVehicleDriver(vehicleId: number, driverId: number | null): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const vehicle = (await tx.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
    if (!vehicle) return null;
    if (vehicle.driverId && vehicle.driverId !== driverId) await tx.update(drivers).set({ vehicleId: null, vehicle: "—", status: "متاح" }).where(eq(drivers.id, vehicle.driverId));
    if (!driverId) {
      await tx.update(vehicles).set({ driverId: null, driver: "—" }).where(eq(vehicles.id, vehicleId));
    } else {
      const driver = (await tx.select().from(drivers).where(and(eq(drivers.id, driverId), isNull(drivers.archivedAt))).limit(1))[0];
      if (!driver) return null;
      if (driver.vehicleId && driver.vehicleId !== vehicleId) await tx.update(vehicles).set({ driverId: null, driver: "—" }).where(eq(vehicles.id, driver.vehicleId));
      await tx.update(vehicles).set({ driverId, driver: driver.name }).where(eq(vehicles.id, vehicleId));
      await tx.update(drivers).set({ vehicleId, vehicle: vehicle.plate, status: "مشغول" }).where(eq(drivers.id, driverId));
    }
    return (await tx.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1))[0] ?? null;
  });
}

type LedgerActor = { id?: number | null; name?: string | null };
async function recordAuditInTransaction(
  tx: any,
  actor: LedgerActor,
  action: string,
  entityType: string,
  entityId: number,
  details: string,
) {
  await tx.insert(auditLogs).values({
    userId: actor.id ?? null,
    action: action.slice(0, 80),
    entityType: entityType.slice(0, 80),
    entityId,
    details,
  });
}
function parseRiyalAmount(value: unknown) {
  const arabicDigits: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  const normalized = String(value ?? "").replace(/[٠-٩]/g, digit => arabicDigits[digit]).replace(/[٬,]/g, "").replace(/[^0-9.\-]/g, "");
  return Math.max(0, Math.round(Number(normalized) || 0));
}
async function syncMaintenanceExpense(tx: DbExecutor, request: MaintenanceRequest, actor: LedgerActor = {}, clearPostedCostWhenNoInvoicesRemain = false) {
  if (!request.vehicleId) return;
  const linkedPayables = await tx.select({ amount: payables.amount, status: payables.status }).from(payables).where(and(eq(payables.maintenanceRequestId, request.id), isNull(payables.archivedAt)));
  const linkedInvoiceTotal = maintenanceInvoiceTotal(linkedPayables);
  const amount = linkedPayables.length ? linkedInvoiceTotal : parseRiyalAmount(request.cost);
  const existing = (await tx.select().from(vehicleExpenses).where(eq(vehicleExpenses.maintenanceRequestId, request.id)).limit(1))[0];
  const vehicle = (await tx.select().from(vehicles).where(eq(vehicles.id, request.vehicleId)).limit(1))[0];
  if (!vehicle) return;
  if (hasPostedMaintenanceInvoices(linkedPayables)) {
    await tx.update(maintenanceRequests).set({ cost: `${amount} SAR` }).where(eq(maintenanceRequests.id, request.id));
    if (existing && !existing.archivedAt) await tx.update(vehicleExpenses).set({ archivedAt: new Date(), archivedByUserId: actor.id ?? null, archivedByName: actor.name || "—" }).where(eq(vehicleExpenses.id, existing.id));
    return;
  }
  if (shouldClearMaintenanceActualCost({ cancelledInvoiceWasPosted: clearPostedCostWhenNoInvoicesRemain, hasOtherPostedInvoices: false })) {
    await tx.update(maintenanceRequests).set({ cost: "0 SAR" }).where(eq(maintenanceRequests.id, request.id));
    if (existing && !existing.archivedAt) await tx.update(vehicleExpenses).set({ archivedAt: new Date(), archivedByUserId: actor.id ?? null, archivedByName: actor.name || "—" }).where(eq(vehicleExpenses.id, existing.id));
    return;
  }
  // A newly entered supplier invoice is still awaiting approval. Keep the
  // currently recorded actual cost until finance posts an approved invoice.
  if (linkedPayables.length) return;
  const reason = [request.type, request.reason !== "—" ? request.reason : ""].filter(Boolean).join(" · ").slice(0, 300) || "تكلفة أمر صيانة";
  const sameVehicle = existing?.vehicleId === request.vehicleId;
  const snapshot = {
    vehicleId: request.vehicleId, projectId: sameVehicle ? existing?.projectId ?? null : vehicle.projectId ?? null, projectName: sameVehicle ? existing?.projectName || vehicle.project || "—" : vehicle.project || "—", clientId: sameVehicle ? existing?.clientId ?? null : vehicle.clientId ?? null, clientName: sameVehicle ? existing?.clientName || vehicle.client || "—" : vehicle.client || "—",
    category: "صيانة" as const, amount, spentAt: request.start && request.start !== "—" ? request.start : formatCompanyDate(), description: reason,
    vendor: request.manager || "—", receiptName: request.receiptName ?? null, receiptUrl: request.receiptUrl ?? null,
    updatedByUserId: actor.id ?? existing?.updatedByUserId ?? null, updatedByName: actor.name || existing?.updatedByName || "—",
  };
  if (existing) await tx.update(vehicleExpenses).set(snapshot).where(eq(vehicleExpenses.id, existing.id));
  else if (amount > 0) await tx.insert(vehicleExpenses).values({ ...snapshot, maintenanceRequestId: request.id, createdByUserId: actor.id ?? null, createdByName: actor.name || "—" });
}

export async function listMaintenanceRequests(): Promise<MaintenanceRequest[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(maintenanceRequests).where(isNull(maintenanceRequests.archivedAt)).orderBy(desc(maintenanceRequests.createdAt));
}

async function refreshVehicleMaintenanceStatus(tx: DbExecutor, vehicleId: number) {
  const requests: MaintenanceRequest[] = await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.vehicleId, vehicleId), isNull(maintenanceRequests.archivedAt)));
  const active = requests.filter(request => !["مغلق", "مرفوض"].includes(request.workflowStage));
  const inRepair = active.some(request => ["تنفيذ", "فحص بعد الإصلاح"].includes(request.workflowStage));
  const stoppedForSafety = active.some(request => request.priority === "طارئ");
  const priorStatus = requests.find(request => request.vehicleStatusBefore && !["في الصيانة", "متوقفة"].includes(request.vehicleStatusBefore))?.vehicleStatusBefore;
  const status = stoppedForSafety ? "متوقفة" : inRepair ? "في الصيانة" : priorStatus;
  if (status) await tx.update(vehicles).set({ status }).where(eq(vehicles.id, vehicleId));
}

export async function createMaintenanceRequest(input: InsertMaintenanceRequest, actor: LedgerActor = {}): Promise<MaintenanceRequest | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    let vehicleStatusBefore: Vehicle["status"] | null = null;
    if (input.vehicleId) {
      const vehicle = (await tx.select({ id: vehicles.id, status: vehicles.status }).from(vehicles).where(and(eq(vehicles.id, input.vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
      if (!vehicle) return null;
      if (!(["في الصيانة", "متوقفة"] as string[]).includes(vehicle.status)) vehicleStatusBefore = vehicle.status;
    }
    const result = await tx.insert(maintenanceRequests).values({ ...input, vehicleStatusBefore });
    const id = Number(result[0].insertId);
    await tx.insert(maintenanceEvents).values({ maintenanceRequestId: id, eventType: "إنشاء الطلب", toStage: input.workflowStage || "بلاغ", details: `الأولوية: ${input.priority || "متوسط"}`, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    if (input.vehicleId && input.priority === "طارئ") await tx.update(vehicles).set({ status: "متوقفة" }).where(eq(vehicles.id, input.vehicleId));
    const created = (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
    if (created) await syncMaintenanceExpense(tx, created, actor);
    if (created) await recordAuditInTransaction(tx, actor, "maintenance.create", "maintenance", id, "تم إنشاء طلب صيانة");
    return created;
  });
}

export async function advanceMaintenanceRequest(id: number, toStage: MaintenanceStage, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM maintenance_requests WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (toStage === "اعتماد" && !hasMaintenanceQuote(current)) throw new Error("أرفق عرض سعر الورشة وأدخل قيمة عرض الورشة أو قطع الغيار قبل إرسال الطلب للمالية");
    if (toStage === "مغلق") {
      const linkedInvoices = await tx.select({ status: payables.status }).from(payables).where(and(eq(payables.maintenanceRequestId, id), isNull(payables.archivedAt)));
      if (!canCloseMaintenance({ approvalStatus: current.approvalStatus as "غير مطلوب" | "بانتظار الاعتماد" | "معتمد" | "مرفوض", actualCost: parseRiyalAmount(current.cost), linkedInvoices })) {
        if (current.approvalStatus === "معتمد" && linkedInvoices.some(invoice => !isPayableExpensePosted(invoice.status))) throw new Error("اعتمد جميع فواتير الورشة وقطع الغيار المرتبطة قبل إغلاق طلب الصيانة");
        if (current.approvalStatus === "معتمد") throw new Error("سجّل فاتورة معتمدة بقيمتها الفعلية قبل إغلاق طلب الصيانة");
        throw new Error("لا يمكن إغلاق الطلب قبل إكمال الفحص بعد الإصلاح");
      }
    }
    if (!canAdvanceMaintenance({ from: current.workflowStage as MaintenanceStage, to: toStage, approvalStatus: current.approvalStatus })) throw new Error("لا يمكن نقل الطلب إلى هذه المرحلة قبل استكمال المرحلة الحالية أو اعتماد التكلفة");
    const status = statusForMaintenanceStage(toStage);
    await tx.update(maintenanceRequests).set({ workflowStage: toStage, status, ...(toStage === "اعتماد" ? { approvalStatus: "بانتظار الاعتماد" as const } : {}), ...(toStage === "مغلق" ? { closedAt: new Date() } : {}) }).where(eq(maintenanceRequests.id, id));
    await tx.insert(maintenanceEvents).values({ maintenanceRequestId: id, eventType: "تغيير المرحلة", fromStage: current.workflowStage, toStage, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    if (current.vehicleId) await refreshVehicleMaintenanceStatus(tx, current.vehicleId);
    const updated = (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
    if (updated) await recordAuditInTransaction(tx, actor, "maintenance.advance", "maintenance", id, "تم نقل طلب الصيانة إلى مرحلة أخرى");
    return updated;
  });
}

export async function decideMaintenanceApproval(id: number, approved: boolean, decision: { notes?: string; fundingType?: "عهدة" | "تحويل مباشر"; fundingReference?: string; fundingAmount?: number; fundingRecipient?: string }, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM maintenance_requests WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (current.workflowStage !== "اعتماد" || current.approvalStatus !== "بانتظار الاعتماد") throw new Error("الطلب ليس بانتظار الاعتماد");
    const toStage = approved ? "تنفيذ" : "مرفوض";
    const status = statusForMaintenanceStage(toStage);
    if (approved && (!decision.fundingType || !decision.fundingReference || !decision.fundingAmount || !decision.fundingRecipient)) throw new Error("بيانات اعتماد وطريقة الصرف غير مكتملة");
    const fundingDetails = approved ? `طريقة الصرف: ${decision.fundingType} · المرجع: ${decision.fundingReference} · المبلغ: ${decision.fundingAmount} SAR · المستلم: ${decision.fundingRecipient}` : "";
    await tx.update(maintenanceRequests).set({ workflowStage: toStage, status, approvalStatus: approved ? "معتمد" : "مرفوض", approvedByUserId: actor.id ?? null, approvedByName: actor.name || "—", approvedAt: new Date(), approvalNotes: decision.notes || null, fundingType: approved ? decision.fundingType! : null, fundingReference: approved ? decision.fundingReference! : null, fundingAmount: approved ? decision.fundingAmount! : null, fundingRecipient: approved ? decision.fundingRecipient! : null, advanceStatus: approved && decision.fundingType === "عهدة" ? "مفتوحة" : null, fundingIssuedAt: approved ? new Date() : null, fundingIssuedByUserId: approved ? actor.id ?? null : null, fundingIssuedByName: approved ? actor.name || "—" : null }).where(eq(maintenanceRequests.id, id));
    await tx.insert(maintenanceEvents).values({ maintenanceRequestId: id, eventType: approved ? `اعتماد الصيانة · ${decision.fundingType}` : "رفض الطلب", fromStage: current.workflowStage, toStage, details: [fundingDetails, decision.notes].filter(Boolean).join(" · ") || null, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    if (current.vehicleId) await refreshVehicleMaintenanceStatus(tx, current.vehicleId);
    const updated = (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
    if (updated) await recordAuditInTransaction(tx, actor, "maintenance.decideApproval", "maintenance", id, approved ? "تم اعتماد طلب الصيانة" : "تم رفض طلب الصيانة");
    return updated;
  });
}

export async function settleMaintenanceAdvance(id: number, reference: string, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM maintenance_requests WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (current.fundingType !== "عهدة" || current.advanceStatus !== "مفتوحة") throw new Error("لا توجد عهدة مفتوحة لتسويتها");
    await tx.update(maintenanceRequests).set({ advanceStatus: "مسواة", advanceSettledAt: new Date(), advanceSettlementReference: reference }).where(eq(maintenanceRequests.id, id));
    await tx.insert(maintenanceEvents).values({ maintenanceRequestId: id, eventType: "تسوية العهدة", fromStage: current.workflowStage, toStage: current.workflowStage, details: `مرجع التسوية: ${reference}`, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    const updated = (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
    if (updated) await recordAuditInTransaction(tx, actor, "maintenance.settleAdvance", "maintenance", id, "تمت تسوية عهدة الصيانة");
    return updated;
  });
}

export async function listMaintenanceEvents(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(maintenanceEvents).where(eq(maintenanceEvents.maintenanceRequestId, id)).orderBy(maintenanceEvents.createdAt);
}

export async function updateMaintenanceRequest(id: number, input: Partial<InsertMaintenanceRequest>, actor: LedgerActor = {}): Promise<MaintenanceRequest | null> {
  const db = await getDb();
  if (!db) return null;
  if (input.cost !== undefined || input.laborCost !== undefined || input.partsCost !== undefined || input.receiptName !== undefined || input.receiptUrl !== undefined) throw new Error("سجّل فاتورة المورد من شاشة المستحقات علينا واربطها بطلب الصيانة لتحديث التكلفة الفعلية");
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM maintenance_requests WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (["مغلق", "مرفوض"].includes(current.workflowStage)) throw new Error("لا يمكن تعديل طلب مغلق أو مرفوض؛ أنشئ طلبًا جديدًا عند الحاجة");
    const quoteChanged =
      (input.estimatedCost !== undefined && Number(input.estimatedCost) !== Number(current.estimatedCost)) ||
      (input.quotedPartsCost !== undefined && Number(input.quotedPartsCost) !== Number(current.quotedPartsCost)) ||
      (input.quoteUrl !== undefined && input.quoteUrl !== current.quoteUrl) ||
      (input.quoteName !== undefined && input.quoteName !== current.quoteName);
    if (quoteChanged && !canEditMaintenanceQuote({ workflowStage: current.workflowStage as MaintenanceStage, approvalStatus: current.approvalStatus as "غير مطلوب" | "بانتظار الاعتماد" | "معتمد" | "مرفوض" })) throw new Error("لا يمكن تغيير عرض السعر بعد اعتماد المالية");
    const linkedInvoices = await tx.select({ id: payables.id }).from(payables).where(and(eq(payables.maintenanceRequestId, id), isNull(payables.archivedAt)));
    if (linkedInvoices.length && input.vehicleId !== undefined && input.vehicleId !== current.vehicleId) throw new Error("لا يمكن تغيير مركبة طلب الصيانة بعد ربط فواتير مورد به");
    const targetVehicleId = input.vehicleId !== undefined ? input.vehicleId : current.vehicleId;
    const changes: Partial<InsertMaintenanceRequest> = { ...input };
    if (targetVehicleId && targetVehicleId !== current.vehicleId) {
      const targetVehicle = (await tx.select({ id: vehicles.id, status: vehicles.status }).from(vehicles).where(and(eq(vehicles.id, targetVehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
      if (!targetVehicle) throw new Error("المركبة المرتبطة غير موجودة أو مؤرشفة");
      changes.vehicleStatusBefore = (["في الصيانة", "متوقفة"] as string[]).includes(targetVehicle.status) ? null : targetVehicle.status;
    }
    await tx.update(maintenanceRequests).set(changes).where(eq(maintenanceRequests.id, id));
    const changedFields = Object.keys(input).filter(key => !["receiptUrl"].includes(key));
    if (changedFields.length) await tx.insert(maintenanceEvents).values({ maintenanceRequestId: id, eventType: "تعديل الطلب", fromStage: current.workflowStage, toStage: current.workflowStage, details: `الحقول المعدلة: ${changedFields.join("، ")}`, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    if (current.vehicleId && current.vehicleId !== targetVehicleId) await refreshVehicleMaintenanceStatus(tx, current.vehicleId);
    if (targetVehicleId) await refreshVehicleMaintenanceStatus(tx, targetVehicleId);
    const updated = (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
    if (updated) await syncMaintenanceExpense(tx, updated, actor);
    if (updated && changedFields.length) await recordAuditInTransaction(tx, actor, "maintenance.update", "maintenance", id, "تم تعديل بيانات طلب الصيانة");
    return updated ? (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null : null;
  });
}

export async function archiveMaintenanceRequest(id: number, actor: LedgerActor = {}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return false;
    const linkedInvoices = await tx.select({ id: payables.id }).from(payables).where(and(eq(payables.maintenanceRequestId, id), isNull(payables.archivedAt)));
    if (linkedInvoices.length) throw new Error("لا يمكن أرشفة طلب صيانة مرتبط بفواتير؛ ألغ الفواتير أو احتفظ بالطلب كسجل مالي");
    await tx.update(maintenanceRequests).set({ archivedAt: new Date() }).where(eq(maintenanceRequests.id, id));
    if (current.vehicleId) await refreshVehicleMaintenanceStatus(tx, current.vehicleId);
    await recordAuditInTransaction(tx, actor, "maintenance.archive", "maintenance", id, "تمت أرشفة طلب الصيانة");
    return true;
  });
}

export async function listDocuments(): Promise<Document[] | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(documents).where(isNull(documents.archivedAt)).orderBy(desc(documents.createdAt));
  return rows.map(document => ({ ...document, status: resolveDocumentStatus(document.expiry, document.status) }));
}

export async function getDocument(id: number): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;
  const document = (await db.select().from(documents).where(and(eq(documents.id, id), isNull(documents.archivedAt))).limit(1))[0] ?? null;
  return document ? { ...document, status: resolveDocumentStatus(document.expiry, document.status) } : null;
}

async function documentEntityName(db: DbExecutor, entityType: string, entityId: number) {
  if (entityType === "مركبة") return (await db.select({ name: vehicles.plate }).from(vehicles).where(and(eq(vehicles.id, entityId), isNull(vehicles.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "سائق") return (await db.select({ name: drivers.name }).from(drivers).where(and(eq(drivers.id, entityId), isNull(drivers.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "موظف") return (await db.select({ name: employees.name }).from(employees).where(and(eq(employees.id, entityId), isNull(employees.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "مشروع") return (await db.select({ name: projects.name }).from(projects).where(and(eq(projects.id, entityId), isNull(projects.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "عميل") return (await db.select({ name: clients.name }).from(clients).where(and(eq(clients.id, entityId), isNull(clients.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "عقد") return (await db.select({ name: contracts.ref }).from(contracts).where(and(eq(contracts.id, entityId), isNull(contracts.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "مطالبة") return (await db.select({ name: claims.ref }).from(claims).where(and(eq(claims.id, entityId), isNull(claims.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "صيانة") return (await db.select({ name: maintenanceRequests.ref }).from(maintenanceRequests).where(and(eq(maintenanceRequests.id, entityId), isNull(maintenanceRequests.archivedAt))).limit(1))[0]?.name ?? null;
  if (entityType === "حادث") return (await db.select({ name: accidents.ref }).from(accidents).where(and(eq(accidents.id, entityId), isNull(accidents.archivedAt))).limit(1))[0]?.name ?? null;
  return null;
}

export async function createDocument(input: InsertDocument): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = { ...input };
  if (input.entityId) {
    const name = await documentEntityName(db, input.entityType || "مركبة", input.entityId);
    if (!name) return null;
    normalized.entity = name;
  } else normalized.entity = "—";
  const result = await db.insert(documents).values(normalized);
  const id = Number(result[0].insertId);
  const created = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return created[0] ?? null;
}

export async function updateDocument(id: number, input: Partial<InsertDocument>): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;
  const current = (await db.select().from(documents).where(and(eq(documents.id, id), isNull(documents.archivedAt))).limit(1))[0];
  if (!current) return null;
  const normalized = { ...input };
  const entityType = input.entityType ?? current.entityType;
  const entityId = input.entityId === undefined ? current.entityId : input.entityId;
  if (entityId) {
    const name = await documentEntityName(db, entityType || "مركبة", entityId);
    if (!name) return null;
    normalized.entity = name;
  } else normalized.entity = "—";
  await db.update(documents).set(normalized).where(and(eq(documents.id, id), isNull(documents.archivedAt)));
  const updated = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return updated[0] ?? null;
}

export async function archiveDocument(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(documents).set({ archivedAt: new Date() }).where(eq(documents.id, id));
  return true;
}

export async function listClients(): Promise<Client[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(clients).where(isNull(clients.archivedAt)).orderBy(desc(clients.createdAt));
}

export async function createClient(input: InsertClient): Promise<Client | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(clients).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return created[0] ?? null;
}

export async function updateClient(id: number, input: Partial<InsertClient>): Promise<Client | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(clients).set(input).where(and(eq(clients.id, id), isNull(clients.archivedAt)));
  const updated = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return updated[0] ?? null;
}

export async function archiveClient(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const client = (await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, id), isNull(clients.archivedAt))).limit(1))[0];
    if (!client) return false;
    const [linkedProject, linkedVehicle, linkedContract] = await Promise.all([
      tx.select({ id: projects.id }).from(projects).where(and(eq(projects.clientId, id), isNull(projects.archivedAt))).limit(1),
      tx.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.clientId, id), isNull(vehicles.archivedAt))).limit(1),
      tx.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.clientId, id), isNull(contracts.archivedAt))).limit(1),
    ]);
    if (linkedProject.length || linkedVehicle.length || linkedContract.length) return false;
    await tx.update(clients).set({ archivedAt: new Date() }).where(eq(clients.id, id));
    return true;
  });
}

export async function listClaims(): Promise<Claim[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(claims).where(isNull(claims.archivedAt)).orderBy(desc(claims.createdAt));
}

async function normalizeClaimLinks(db: DbExecutor, input: Partial<InsertClaim>, current?: Claim): Promise<Pick<Claim, "client" | "clientId" | "contract" | "contractId">> {
  const clientId = input.clientId !== undefined ? input.clientId : current?.clientId ?? null;
  const contractId = input.contractId !== undefined ? input.contractId : current?.contractId ?? null;
  if (!clientId && !contractId) {
    if (!current) throw new Error("اختر عميلًا وعقدًا مسجلين للمطالبة");
    if (current.clientId || current.contractId) throw new Error("لا يمكن فك ربط مطالبة مالية بعقد أو عميل");
    return {} as Pick<Claim, "client" | "clientId" | "contract" | "contractId">;
  }
  if (!clientId || !contractId) throw new Error("يجب ربط المطالبة بعميل وعقد معًا");
  const client = (await db.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.id, clientId), isNull(clients.archivedAt))).limit(1).for("update"))[0];
  if (!client) throw new Error("العميل المحدد غير موجود أو مؤرشف");
  const contract = (await db.select({ id: contracts.id, ref: contracts.ref, clientId: contracts.clientId, client: contracts.client }).from(contracts).where(and(eq(contracts.id, contractId), isNull(contracts.archivedAt))).limit(1).for("update"))[0];
  if (!contract) throw new Error("العقد المحدد غير موجود أو مؤرشف");
  validateClaimContractLink({ clientId: client.id, clientName: client.name, contractClientId: contract.clientId, contractClientName: contract.client });
  return { client: client.name, clientId: client.id, contract: contract.ref, contractId: contract.id };
}

export async function createClaim(input: InsertClaim): Promise<Claim | null> {
  const db = await getDb();
  if (!db) return null;
  if (input.status !== "غير مرفوعة" && input.status !== "جديدة") return null;
  return db.transaction(async tx => {
    const references = await normalizeClaimLinks(tx, input);
    const result = await tx.insert(claims).values({ ...input, ...references, paid: 0 });
    const id = Number(result[0].insertId);
    return (await tx.select().from(claims).where(eq(claims.id, id)).limit(1))[0] ?? null;
  });
}

export async function updateClaim(id: number, input: Partial<InsertClaim>): Promise<Claim | null> {
  const db = await getDb();
  if (!db) return null;
  if (input.paid !== undefined) return null;
  return db.transaction(async tx => {
    // Coordinate amount/status edits with payments that update this claim's paid total.
    await tx.execute(sql`SELECT id FROM claims WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(claims).where(and(eq(claims.id, id), isNull(claims.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (!canUpdateClaim({ currentStatus: current.status, currentAmount: current.amount, paid: current.paid, nextStatus: input.status, nextAmount: input.amount })) return null;
    const references = await normalizeClaimLinks(tx, input, current);
    if (references.clientId !== current.clientId || references.contractId !== current.contractId) {
      const activePayment = (await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.claimId, id), isNull(payments.archivedAt))).limit(1))[0];
      if (!canChangeClaimReferences({ hasActivePayments: Boolean(activePayment), clientChanged: references.clientId !== current.clientId, contractChanged: references.contractId !== current.contractId })) throw new ClaimReferenceConflictError();
    }
    await tx.update(claims).set({ ...input, ...references }).where(and(eq(claims.id, id), isNull(claims.archivedAt)));
    return (await tx.select().from(claims).where(eq(claims.id, id)).limit(1))[0] ?? null;
  });
}

export async function archiveClaim(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const current = (await tx.select({ id: claims.id }).from(claims).where(and(eq(claims.id, id), isNull(claims.archivedAt))).limit(1).for("update"))[0];
    if (!current) return false;
    const activePayments = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.claimId, id), isNull(payments.archivedAt))).limit(1);
    if (!canArchiveClaim(activePayments.length > 0)) throw new ClaimPaymentHistoryError();
    await tx.update(claims).set({ archivedAt: new Date() }).where(and(eq(claims.id, id), isNull(claims.archivedAt)));
    return true;
  });
}

export async function listContracts(): Promise<Array<Contract & { items: ContractItem[] }> | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contracts).where(isNull(contracts.archivedAt)).orderBy(desc(contracts.createdAt));
  const items = await db.select().from(contractItems);
  return rows.map(contract => ({ ...contract, items: items.filter(item => item.contractId === contract.id) }));
}

export async function getContractRelatedModuleAccess(contractId?: number, candidateVehicleIds: number[] = []): Promise<{ vehicles: boolean; projects: boolean }> {
  const db = await getDb();
  if (!db) return { vehicles: candidateVehicleIds.length > 0, projects: true };
  const [linkedVehicles, linkedProjects, candidateVehicles] = await Promise.all([
    contractId ? db.select({ id: vehicles.id, projectId: vehicles.projectId }).from(vehicles).where(and(eq(vehicles.contractId, contractId), isNull(vehicles.archivedAt))) : Promise.resolve([]),
    contractId ? db.select({ id: projects.id }).from(projects).where(and(eq(projects.contractId, contractId), isNull(projects.archivedAt))) : Promise.resolve([]),
    candidateVehicleIds.length ? db.select({ projectId: vehicles.projectId }).from(vehicles).where(and(inArray(vehicles.id, candidateVehicleIds), isNull(vehicles.archivedAt))) : Promise.resolve([]),
  ]);
  return {
    vehicles: candidateVehicleIds.length > 0 || linkedVehicles.length > 0,
    projects: linkedProjects.length > 0 || linkedVehicles.some(vehicle => vehicle.projectId !== null) || candidateVehicles.some(vehicle => vehicle.projectId !== null),
  };
}

async function ensureCollectedPayment(tx: DbExecutor, contractId: number, targetCollected: number, clientId: number | null | undefined, ref: string, paidAt: string) {
  const current = (await tx.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.contractId, contractId), isNull(payments.archivedAt))).limit(1))[0];
  const gap = Math.max(0, Math.round(targetCollected) - Number(current?.total || 0));
  if (!gap) return;
  await tx.insert(payments).values({ contractId, clientId: clientId ?? null, amount: gap, paidAt: paidAt || formatCompanyDate(), method: "تحويل بنكي", reference: `تحصيل العقد ${ref}`, notes: "دفعة تلقائية من خانة المحصل في العقد" });
}

async function lockContractResources(tx: DbExecutor, vehicleIds: number[]) {
  const vehicleRows = new Map<number, Vehicle>();
  for (const vehicleId of [...vehicleIds].sort((a, b) => a - b)) {
    const vehicle = (await tx.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), isNull(vehicles.archivedAt))).limit(1).for("update"))[0];
    if (!vehicle) return null;
    vehicleRows.set(vehicleId, vehicle);
  }

  const projectIds = Array.from(new Set(Array.from(vehicleRows.values()).map(vehicle => vehicle.projectId).filter((id): id is number => id !== null))).sort((a, b) => a - b);
  const projectRows = new Map<number, Project>();
  for (const projectId of projectIds) {
    const project = (await tx.select().from(projects).where(and(eq(projects.id, projectId), isNull(projects.archivedAt))).limit(1).for("update"))[0];
    if (!project) return null;
    projectRows.set(projectId, project);
  }
  return { vehicles: vehicleRows, projects: projectRows };
}

export async function createContract(input: InsertContract, items: Omit<InsertContractItem, "contractId">[]): Promise<(Contract & { items: ContractItem[] }) | null> {
  const db = await getDb();
  if (!db) return null;
  if (!canSetContractCollection({ total: Number(input.total ?? 0), targetCollected: Number(input.collected ?? 0), ledgerCollected: 0 })) throw new Error("المحصل لا يمكن أن يتجاوز القيمة الإجمالية للعقد");
  return db.transaction(async tx => {
    let normalized = { ...input };
    if (input.clientId) {
      const client = (await tx.select({ name: clients.name }).from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0];
      if (!client) return null;
      normalized = { ...normalized, client: client.name };
    }
    const vehicleIds = items.map(item => item.vehicleId).filter((value): value is number => value !== null);
    if (new Set(vehicleIds).size !== vehicleIds.length) return null;
    const resources = await lockContractResources(tx, vehicleIds);
    if (!resources) return null;
    const linkedProjectIds = new Set<number>();
    for (const vehicleId of vehicleIds) {
      const vehicle = resources.vehicles.get(vehicleId)!;
      if (!vehicle || !canAssignVehicleToContract({ status: vehicle.status, currentContractId: vehicle.contractId })) return null;
      if (vehicle.clientId && input.clientId && vehicle.clientId !== input.clientId) return null;
      if (vehicle.projectId) {
        const project = resources.projects.get(vehicle.projectId);
        if (!project || project.contractId) return null;
        if (project.clientId && input.clientId && project.clientId !== input.clientId) return null;
        linkedProjectIds.add(project.id);
      }
    }
    const result = await tx.insert(contracts).values(normalized);
    const id = Number(result[0].insertId);
    if (items.length) await tx.insert(contractItems).values(items.map(item => ({ ...item, contractId: id })));
    if (normalized.clientId) await tx.update(clients).set({ contracts: sql`${clients.contracts} + 1` }).where(eq(clients.id, normalized.clientId));
    await ensureCollectedPayment(tx, id, Number(normalized.collected || 0), normalized.clientId, normalized.ref, normalized.startDate);
    for (const projectId of Array.from(linkedProjectIds)) {
      await tx.update(projects).set({ contractId: id, contract: normalized.ref, ...(normalized.clientId ? { clientId: normalized.clientId, client: normalized.client } : {}) }).where(and(eq(projects.id, projectId), isNull(projects.archivedAt)));
      await tx.update(vehicles).set({ contract: normalized.ref, ...(normalized.clientId ? { clientId: normalized.clientId, client: normalized.client } : {}) }).where(and(eq(vehicles.projectId, projectId), isNull(vehicles.archivedAt)));
    }
    for (const item of items) {
      if (!item.vehicleId) continue;
      const vehicle = (await tx.select({ status: vehicles.status }).from(vehicles).where(eq(vehicles.id, item.vehicleId)).limit(1))[0];
      const vehicleStatus = vehicle ? vehicleStatusAfterContractAssignment(item.coverage || "مركبة وسائق", vehicle.status) : "متاحة";
      await tx.update(vehicles).set({ contract: normalized.ref, ...(normalized.clientId ? { client: normalized.client, clientId: normalized.clientId } : {}), contractId: id, status: vehicleStatus }).where(eq(vehicles.id, item.vehicleId));
    }
    const created = await tx.select().from(contracts).where(eq(contracts.id, id)).limit(1);
    const createdItems = await tx.select().from(contractItems).where(eq(contractItems.contractId, id));
    return created[0] ? { ...created[0], items: createdItems } : null;
  });
}

export async function updateContract(id: number, input: Partial<InsertContract>, items?: Omit<InsertContractItem, "contractId">[]) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM contracts WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(contracts).where(and(eq(contracts.id, id), isNull(contracts.archivedAt))).limit(1))[0];
    if (!current) return null;
    const oldItems = await tx.select().from(contractItems).where(eq(contractItems.contractId, id));
    const nextClientId = input.clientId === undefined ? current.clientId : input.clientId;
    if (nextClientId !== current.clientId) {
      const linkedClaims = await tx.select({ id: claims.id }).from(claims).where(eq(claims.contractId, id));
      const directPayments = await tx.select({ id: payments.id }).from(payments).where(eq(payments.contractId, id));
      const claimPayments = linkedClaims.length
        ? await tx.select({ id: payments.id }).from(payments).where(inArray(payments.claimId, linkedClaims.map(claim => claim.id)))
        : [];
      if (linkedClaims.length || directPayments.length || claimPayments.length) {
        throw new Error("لا يمكن تغيير عميل العقد بعد إنشاء مطالبات أو تسجيل دفعات مرتبطة به؛ حافظ على السجل المالي وأنشئ عقدًا جديدًا عند الحاجة");
      }
    }
    let nextClient = input.clientId === null ? "—" : input.client ?? current.client;
    if (nextClientId) {
      const client = (await tx.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.id, nextClientId), isNull(clients.archivedAt))).limit(1))[0];
      if (!client) return null;
      nextClient = client.name;
    }
    const normalizedInput = { ...input, ...(nextClientId || input.clientId === null ? { client: nextClient } : {}) };
    const shouldSyncClient = Boolean(nextClientId) || input.clientId === null;
    if (input.total !== undefined || input.collected !== undefined) {
      const currentPayments = (await tx.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.contractId, id), isNull(payments.archivedAt))).limit(1))[0];
      const ledgerCollected = Number(currentPayments?.total || 0);
      const nextTotal = Number(input.total ?? current.total);
      const targetCollected = Number(input.collected ?? ledgerCollected);
      if (!canSetContractCollection({ total: nextTotal, targetCollected, ledgerCollected })) throw new Error("إجمالي العقد أو المحصل لا يطابق سجل الدفعات؛ لا يمكن خفض الإجمالي عن التحصيل المسجل أو تجاوزه");
    }
    const nextProjectIds = new Set<number>();
    if (items) {
      const vehicleIds = items.map(item => item.vehicleId).filter((value): value is number => value !== null);
      if (new Set(vehicleIds).size !== vehicleIds.length) return null;
      const resources = await lockContractResources(tx, vehicleIds);
      if (!resources) return null;
      for (const vehicleId of vehicleIds) {
        const vehicle = resources.vehicles.get(vehicleId)!;
        if (!vehicle || !canAssignVehicleToContract({ status: vehicle.status, currentContractId: vehicle.contractId, targetContractId: id })) return null;
        if (vehicle.clientId && nextClientId && vehicle.clientId !== nextClientId) return null;
        if (vehicle.projectId) {
          const project = resources.projects.get(vehicle.projectId);
          if (!project || (project.contractId && project.contractId !== id) || (project.clientId && nextClientId && project.clientId !== nextClientId)) return null;
          nextProjectIds.add(project.id);
        }
      }
    }
    await tx.update(contracts).set(normalizedInput).where(eq(contracts.id, id));
    if (items) {
      await tx.delete(contractItems).where(eq(contractItems.contractId, id));
      if (items.length) await tx.insert(contractItems).values(items.map(item => ({ ...item, contractId: id })));
      const nextVehicleIds = new Set(items.map(item => item.vehicleId).filter((value): value is number => Boolean(value)));
      for (const item of oldItems) if (item.vehicleId && !nextVehicleIds.has(item.vehicleId)) {
        const removed = (await tx.select({ status: vehicles.status, projectId: vehicles.projectId }).from(vehicles).where(eq(vehicles.id, item.vehicleId)).limit(1))[0];
        if (removed?.projectId) {
          const linkedProject = (await tx.select({ contractId: projects.contractId }).from(projects).where(and(eq(projects.id, removed.projectId), isNull(projects.archivedAt))).limit(1))[0];
          if (linkedProject?.contractId === id) throw new Error("المركبة مرتبطة بعقد المشروع؛ افصلها عن المشروع قبل إزالتها من بنود العقد");
        }
        await tx.update(vehicles).set({ contract: "—", contractId: null, ...(removed ? { status: vehicleStatusAfterContractRemoval(removed.status) } : {}) }).where(eq(vehicles.id, item.vehicleId));
      }
      const nextRef = input.ref ?? current.ref;
      for (const item of items) if (item.vehicleId) {
        const assigned = (await tx.select({ status: vehicles.status }).from(vehicles).where(eq(vehicles.id, item.vehicleId)).limit(1))[0];
        const vehicleStatus = assigned ? vehicleStatusAfterContractAssignment(item.coverage || "مركبة وسائق", assigned.status) : "متاحة";
        await tx.update(vehicles).set({ contract: nextRef, contractId: id, client: nextClient, clientId: nextClientId ?? null, status: vehicleStatus }).where(eq(vehicles.id, item.vehicleId));
      }
    }
    const nextRef = input.ref ?? current.ref;
    for (const projectId of Array.from(nextProjectIds)) {
      await tx.update(projects).set({ contractId: id, contract: nextRef, ...(shouldSyncClient ? { clientId: nextClientId ?? null, client: nextClient } : {}) }).where(and(eq(projects.id, projectId), isNull(projects.archivedAt)));
    }
    if (!items && (input.ref !== undefined || input.client !== undefined || input.clientId !== undefined)) {
      await tx.update(vehicles).set({
        ...(input.ref !== undefined ? { contract: input.ref } : {}),
        ...(input.client !== undefined ? { client: nextClient } : {}),
        ...(input.clientId !== undefined ? { clientId: nextClientId ?? null, client: nextClient } : {}),
      }).where(and(eq(vehicles.contractId, id), isNull(vehicles.archivedAt)));
    }
    const linkedProjects = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.contractId, id), isNull(projects.archivedAt)));
    for (const project of linkedProjects) {
      await tx.update(projects).set({
        contract: nextRef,
        ...(shouldSyncClient ? { clientId: nextClientId ?? null, client: nextClient } : {}),
      }).where(eq(projects.id, project.id));
      await tx.update(vehicles).set({
        contract: nextRef,
        ...(shouldSyncClient ? { clientId: nextClientId ?? null, client: nextClient } : {}),
      }).where(and(eq(vehicles.projectId, project.id), isNull(vehicles.archivedAt)));
    }
    if (input.collected !== undefined) await ensureCollectedPayment(tx, id, input.collected, nextClientId, input.ref ?? current.ref, input.startDate ?? current.startDate);
    if (input.clientId !== undefined && input.clientId !== current.clientId) {
      if (current.clientId) await tx.update(clients).set({ contracts: sql`GREATEST(0, ${clients.contracts} - 1)` }).where(eq(clients.id, current.clientId));
      if (input.clientId) await tx.update(clients).set({ contracts: sql`${clients.contracts} + 1` }).where(eq(clients.id, input.clientId));
    }
    const updated = (await tx.select().from(contracts).where(eq(contracts.id, id)).limit(1))[0];
    const updatedItems = await tx.select().from(contractItems).where(eq(contractItems.contractId, id));
    return updated ? { ...updated, items: updatedItems } : null;
  });
}

export async function archiveContract(id: number) {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM contracts WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(contracts).where(and(eq(contracts.id, id), isNull(contracts.archivedAt))).limit(1))[0];
    if (!current) return false;
    const linkedProjects = await tx.select({ id: projects.id, clientId: projects.clientId, client: projects.client }).from(projects).where(and(eq(projects.contractId, id), isNull(projects.archivedAt)));
    for (const project of linkedProjects) {
      await tx.update(projects).set({ contractId: null, contract: "—" }).where(eq(projects.id, project.id));
      const projectVehicles = await tx.select({ id: vehicles.id, contractId: vehicles.contractId }).from(vehicles).where(and(eq(vehicles.projectId, project.id), isNull(vehicles.archivedAt)));
      for (const vehicle of projectVehicles) {
        if (vehicle.contractId !== null) continue;
        await tx.update(vehicles).set({ contract: "—", clientId: project.clientId, client: project.client || "—" }).where(eq(vehicles.id, vehicle.id));
      }
    }
    const assignedVehicles = await tx.select({ id: vehicles.id, projectId: vehicles.projectId, status: vehicles.status, clientId: vehicles.clientId, client: vehicles.client }).from(vehicles).where(and(eq(vehicles.contractId, id), isNull(vehicles.archivedAt)));
    for (const vehicle of assignedVehicles) {
      const project = linkedProjects.find(item => item.id === vehicle.projectId) ?? (vehicle.projectId
        ? (await tx.select({ clientId: projects.clientId, client: projects.client }).from(projects).where(and(eq(projects.id, vehicle.projectId), isNull(projects.archivedAt))).limit(1))[0]
        : undefined);
      await tx.update(vehicles).set({
        contract: "—",
        contractId: null,
        clientId: project?.clientId ?? vehicle.clientId ?? current.clientId ?? null,
        client: project?.client && project.client !== "—" ? project.client : vehicle.client && vehicle.client !== "—" ? vehicle.client : current.client || "—",
        status: vehicleStatusAfterContractRemoval(vehicle.status),
      }).where(eq(vehicles.id, vehicle.id));
    }
    if (current.clientId) await tx.update(clients).set({ contracts: sql`GREATEST(0, ${clients.contracts} - 1)` }).where(eq(clients.id, current.clientId));
    await tx.update(contracts).set({ archivedAt: new Date() }).where(eq(contracts.id, id));
    return true;
  });
}

export async function updateContractStatus(id: number, status: Contract["status"]): Promise<Contract | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM contracts WHERE id = ${id} FOR UPDATE`);
    await tx.update(contracts).set({ status }).where(and(eq(contracts.id, id), isNull(contracts.archivedAt)));
    return (await tx.select().from(contracts).where(eq(contracts.id, id)).limit(1))[0] ?? null;
  });
}

export async function listTasks(viewer: { id: number; name?: string | null; role?: string }) {
  const db = await getDb();
  if (!db) return null;
  const scope = viewer.role === "admin" ? isNull(tasks.archivedAt) : and(isNull(tasks.archivedAt), or(eq(tasks.assigneeUserId, viewer.id), and(isNull(tasks.assigneeUserId), eq(tasks.assignee, viewer.name || "—"))));
  return db.select().from(tasks).where(scope).orderBy(desc(tasks.createdAt));
}
export async function listTaskAssignees() {
  const db = await getDb();
  return db ? db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.isActive, 1), isNotNull(users.name))).orderBy(users.name) : null;
}
export async function createTask(input: Omit<typeof tasks.$inferInsert, "assignee">, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const assignee = (await tx.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, Number(input.assigneeUserId)), eq(users.isActive, 1))).limit(1))[0];
    if (!assignee?.name?.trim()) throw new Error("اختر مستخدمًا نشطًا له اسم مسجل لإسناد المهمة");
    const result = await tx.insert(tasks).values({ ...input, assignee: assignee.name.trim() });
    const id = Number(result[0].insertId);
    const created = (await tx.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0] ?? null;
    if (created) await recordAuditInTransaction(tx, actor, "task.create", "task", id, `تم إسناد المهمة إلى ${assignee.name}`);
    return created;
  });
}
export async function updateTask(id: number, input: Partial<typeof tasks.$inferInsert>, actor: LedgerActor & { role?: string } = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM tasks WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (!canUpdateTask(current, input as Record<string, unknown>, { id: actor.id ?? 0, name: actor.name, role: actor.role })) throw new Error("يمكنك تغيير حالة المهام المسندة إلى حسابك فقط؛ تعديل تفاصيل المهمة متاح للمدير");
    const { id: _id, assigneeUserId: _assigneeUserId, ...safeInput } = input;
    await tx.update(tasks).set(safeInput).where(eq(tasks.id, id));
    const updated = (await tx.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0] ?? null;
    if (updated) await recordAuditInTransaction(tx, actor, "task.update", "task", id, `تغيّرت حالة المهمة إلى ${updated.status}`);
    return updated;
  });
}
export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ notification: notifications, userReadAt: notificationReads.readAt }).from(notifications)
    .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)))
    .orderBy(desc(notifications.createdAt)).limit(100);
  return rows.map(({ notification, userReadAt }) => ({ ...notification, readAt: notificationReadAtForUser(notification.readAt, userReadAt) }));
}
export async function getNotification(id: number) { const db = await getDb(); return db ? (await db.select().from(notifications).where(eq(notifications.id, id)).limit(1))[0] ?? null : null; }
export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.insert(notificationReads).values({ notificationId: id, userId }).onDuplicateKeyUpdate({ set: { readAt: new Date() } });
  return true;
}
export async function createNotification(input: typeof notifications.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(notifications).values(input); return Number(result[0].insertId); }
export async function listPayments() { const db = await getDb(); return db ? db.select().from(payments).where(isNull(payments.archivedAt)).orderBy(desc(payments.createdAt)) : null; }

export async function listPayables(): Promise<(Omit<Payable, "receiptUrl"> & { hasReceipt: boolean; remaining: number; overdue: boolean; payments: PayablePayment[] })[] | null> {
  const db = await getDb();
  if (!db) return null;
  const [records, ledger] = await Promise.all([
    db.select().from(payables).where(isNull(payables.archivedAt)).orderBy(desc(payables.createdAt)),
    db.select().from(payablePayments).orderBy(desc(payablePayments.createdAt)),
  ]);
  return records.map(record => {
    const entries = ledger.filter(payment => payment.payableId === record.id);
    const remaining = Math.max(0, record.amount - record.paid);
    const { receiptUrl, ...safeRecord } = record;
    return { ...safeRecord, hasReceipt: Boolean(receiptUrl), remaining, overdue: isPayableExpensePosted(record.status) && remaining > 0 && isCompanyDateBeforeToday(record.dueDate), payments: entries };
  });
}
export async function getPayableReceipt(id: number) {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select({ receiptName: payables.receiptName, receiptUrl: payables.receiptUrl, vehicleId: payables.vehicleId, maintenanceRequestId: payables.maintenanceRequestId }).from(payables).where(and(eq(payables.id, id), isNull(payables.archivedAt))).limit(1))[0];
  return row?.receiptUrl ? { name: row.receiptName || "فاتورة مورد", url: row.receiptUrl, vehicleId: row.vehicleId, maintenanceRequestId: row.maintenanceRequestId } : null;
}

export async function getStoredFilePermissions(key: string): Promise<string[] | null> {
  const db = await getDb();
  if (!db) return null;
  const url = `/manus-storage/${key}`;
  const [documentRows, maintenanceQuoteRows, maintenanceReceiptRows, expenseRows, revenueRows, payableRows] = await Promise.all([
    db.select({ entityType: documents.entityType, entityId: documents.entityId }).from(documents).where(and(eq(documents.fileUrl, url), isNull(documents.archivedAt))),
    db.select({ id: maintenanceRequests.id }).from(maintenanceRequests).where(and(eq(maintenanceRequests.quoteUrl, url), isNull(maintenanceRequests.archivedAt))),
    db.select({ id: maintenanceRequests.id }).from(maintenanceRequests).where(and(eq(maintenanceRequests.receiptUrl, url), isNull(maintenanceRequests.archivedAt))),
    db.select({ id: vehicleExpenses.id }).from(vehicleExpenses).where(and(eq(vehicleExpenses.receiptUrl, url), isNull(vehicleExpenses.archivedAt))),
    db.select({ id: vehicleRevenues.id }).from(vehicleRevenues).where(and(eq(vehicleRevenues.receiptUrl, url), isNull(vehicleRevenues.archivedAt))),
    db.select({ vehicleId: payables.vehicleId, maintenanceRequestId: payables.maintenanceRequestId }).from(payables).where(and(eq(payables.receiptUrl, url), isNull(payables.archivedAt))),
  ]);
  return requiredPermissionsForStoredFile({
    documents: documentRows,
    maintenanceQuoteCount: maintenanceQuoteRows.length,
    maintenanceReceiptCount: maintenanceReceiptRows.length,
    vehicleLedgerCount: expenseRows.length + revenueRows.length,
    payables: payableRows,
  });
}
function isVehiclePurchasePayable(payable: Pick<Payable, "description">) {
  return /(?:شراء|قيمة شراء).*(?:باص|مركبة|سيارة)|(?:باص|مركبة|سيارة).*شراء/.test(String(payable.description || ""));
}

async function validateMaintenancePayableLink(tx: DbExecutor, input: { maintenanceRequestId?: number | null; vehicleId?: number | null; vehicleCategory?: string | null; description?: string }, current?: Payable) {
  const requestId = input.maintenanceRequestId ?? null;
  if (!requestId) return;
  if (current && current.maintenanceRequestId !== requestId && (current.maintenanceRequestId || isPayableExpensePosted(current.status))) throw new Error("لا يمكن تغيير ربط فاتورة موجودة بطلب صيانة آخر");
  const request = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, requestId), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
  if (!request) throw new Error("طلب الصيانة المرتبط غير موجود أو مؤرشف");
  if (!input.vehicleId || request.vehicleId !== input.vehicleId) throw new Error("المركبة في الفاتورة لا تطابق مركبة طلب الصيانة");
  if (input.vehicleCategory !== "صيانة" || (input.description && isVehiclePurchasePayable({ description: input.description }))) throw new Error("فاتورة طلب الصيانة يجب أن تكون من فئة صيانة وليست فاتورة شراء مركبة");
  if (request.approvalStatus !== "معتمد" || !["تنفيذ", "فحص بعد الإصلاح"].includes(request.workflowStage)) throw new Error("يمكن ربط الفاتورة بطلب صيانة معتمد وقيد التنفيذ أو الفحص فقط");
}

async function lockMaintenanceRequestForInvoice(tx: DbExecutor, requestId: number | null | undefined) {
  if (requestId) await tx.execute(sql`SELECT id FROM maintenance_requests WHERE id = ${requestId} AND archivedAt IS NULL FOR UPDATE`);
}

async function syncLinkedMaintenanceRequest(tx: DbExecutor, requestId: number | null | undefined, actor: LedgerActor, clearPostedCostWhenNoInvoicesRemain = false) {
  if (!requestId) return;
  const request = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, requestId), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
  if (request) await syncMaintenanceExpense(tx, request, actor, clearPostedCostWhenNoInvoicesRemain);
}

async function syncPayableVehicleExpense(tx: DbExecutor, payable: Payable, actor: LedgerActor = {}) {
  const existing = (await tx.select().from(vehicleExpenses).where(eq(vehicleExpenses.payableId, payable.id)).limit(1))[0];
  if (!isPayableExpensePosted(payable.status) || isVehiclePurchasePayable(payable) || !payable.vehicleId || !payable.vehicleCategory) {
    if (existing && !existing.archivedAt) await tx.update(vehicleExpenses).set({ archivedAt: new Date(), archivedByUserId: actor.id ?? null, archivedByName: actor.name || "—" }).where(eq(vehicleExpenses.id, existing.id));
    return;
  }
  const vehicle = (await tx.select().from(vehicles).where(eq(vehicles.id, payable.vehicleId)).limit(1))[0];
  if (!vehicle) throw new Error("الباص المرتبط بفاتورة المورد غير موجود");
  const sameVehicle = existing?.vehicleId === vehicle.id;
  const values = { vehicleId: vehicle.id, projectId: sameVehicle ? existing?.projectId ?? null : vehicle.projectId ?? null, projectName: sameVehicle ? existing?.projectName || vehicle.project || "—" : vehicle.project || "—", clientId: sameVehicle ? existing?.clientId ?? null : vehicle.clientId ?? null, clientName: sameVehicle ? existing?.clientName || vehicle.client || "—" : vehicle.client || "—", category: payable.vehicleCategory, amount: Number(payable.amount), spentAt: payable.issueDate && payable.issueDate !== "—" ? payable.issueDate : new Date(payable.createdAt).toISOString().slice(0, 10), description: `فاتورة ${payable.ref} · ${payable.description}`.slice(0, 300), vendor: payable.supplier, receiptName: payable.receiptName ?? null, receiptUrl: null, notes: payable.notes ?? null, updatedByUserId: actor.id ?? existing?.updatedByUserId ?? null, updatedByName: actor.name || existing?.updatedByName || "—" };
  if (existing) await tx.update(vehicleExpenses).set({ ...values, archivedAt: null, archivedByUserId: null, archivedByName: null }).where(eq(vehicleExpenses.id, existing.id));
  else await tx.insert(vehicleExpenses).values({ ...values, payableId: payable.id, createdByUserId: actor.id ?? null, createdByName: actor.name || "—", updatedByUserId: actor.id ?? null, updatedByName: actor.name || "—" });
}
export async function createPayable(input: InsertPayable, actor: LedgerActor = {}): Promise<Payable | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    // Serialize invoice creation for a maintenance request before its linked
    // invoice total is recalculated, so concurrent invoices cannot overwrite
    // each other's actual cost.
    await lockMaintenanceRequestForInvoice(tx, input.maintenanceRequestId);
    await validateMaintenancePayableLink(tx, input);
    const result = await tx.insert(payables).values({ ...input, paid: 0, status: "جديدة" });
    const id = Number(result[0].insertId);
    const payable = (await tx.select().from(payables).where(eq(payables.id, id)).limit(1))[0] ?? null;
    if (payable?.vehicleId) await syncPayableVehicleExpense(tx, payable, actor);
    await syncLinkedMaintenanceRequest(tx, payable?.maintenanceRequestId, actor);
    if (payable) await recordAuditInTransaction(tx, actor, "payables.create", "payables", id, "تم إنشاء فاتورة مورد");
    return payable;
  });
}
export async function updatePayable(id: number, input: Partial<InsertPayable>, actor: LedgerActor = {}): Promise<Payable | null> {
  const db = await getDb();
  if (!db) return null;
  if (input.paid !== undefined || input.status !== undefined) return null;
  return db.transaction(async tx => {
    // Serialize edits with payments so amount/status checks use the latest ledger state.
    await tx.execute(sql`SELECT id FROM payables WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(payables).where(and(eq(payables.id, id), isNull(payables.archivedAt))).for("update").limit(1))[0];
    if (!current || Number(input.amount ?? current.amount) < current.paid) return null;
    if (current.vehicleId && current.paid > 0 && (input.vehicleId !== undefined && input.vehicleId !== current.vehicleId || input.vehicleCategory !== undefined && input.vehicleCategory !== current.vehicleCategory)) throw new Error("لا يمكن نقل فاتورة باص أو تغيير فئتها بعد تسجيل دفعة عليها");
    const nextVehicleId = input.vehicleId !== undefined ? input.vehicleId : current.vehicleId;
    const nextMaintenanceRequestId = input.maintenanceRequestId !== undefined ? input.maintenanceRequestId : current.maintenanceRequestId;
    await lockMaintenanceRequestForInvoice(tx, nextMaintenanceRequestId);
    await validateMaintenancePayableLink(tx, { vehicleId: nextVehicleId, maintenanceRequestId: nextMaintenanceRequestId, vehicleCategory: input.vehicleCategory ?? current.vehicleCategory, description: input.description ?? current.description }, current);
    if (current.maintenanceRequestId && current.maintenanceRequestId !== nextMaintenanceRequestId) throw new Error("لا يمكن فك فاتورة مورد مرتبطة بطلب صيانة؛ ألغ الفاتورة واترك الربط التاريخي محفوظًا");
    await tx.update(payables).set(input).where(eq(payables.id, id));
    const updated = (await tx.select().from(payables).where(eq(payables.id, id)).limit(1))[0] ?? null;
    if (updated && (current.vehicleId || updated.vehicleId)) await syncPayableVehicleExpense(tx, updated, actor);
    await syncLinkedMaintenanceRequest(tx, current.maintenanceRequestId, actor);
    if (updated?.maintenanceRequestId !== current.maintenanceRequestId) await syncLinkedMaintenanceRequest(tx, updated?.maintenanceRequestId, actor);
    if (updated && Object.keys(input).length) await recordAuditInTransaction(tx, actor, "payables.update", "payables", id, "تم تعديل بيانات فاتورة مورد");
    return updated;
  });
}
export async function updatePayableStatus(id: number, status: Payable["status"], actor: LedgerActor = {}): Promise<Payable | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    // Status changes (especially cancellation/approval) must not race a payment.
    await tx.execute(sql`SELECT id FROM payables WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(payables).where(and(eq(payables.id, id), isNull(payables.archivedAt))).for("update").limit(1))[0];
    if (!current) return null;
    await lockMaintenanceRequestForInvoice(tx, current.maintenanceRequestId);
    const allowed: Record<Payable["status"], Payable["status"][]> = { "جديدة": ["معتمدة", "ملغاة"], "معتمدة": ["ملغاة"], "مدفوعة جزئيًا": ["ملغاة"], "مدفوعة": [], "ملغاة": [] };
    if (status !== current.status && !allowed[current.status].includes(status)) return null;
    if (status === "ملغاة" && current.vehicleId && current.paid > 0) throw new Error("لا يمكن إلغاء فاتورة مرتبطة بباص بعد تسجيل دفعة عليها؛ عالجها بإشعار دائن لتبقى تكلفة الباص دقيقة");
    if (status === "مدفوعة" && current.paid < current.amount) return null;
    await tx.update(payables).set({ status }).where(eq(payables.id, id));
    const updated = (await tx.select().from(payables).where(eq(payables.id, id)).limit(1))[0] ?? null;
    if (updated?.vehicleId) await syncPayableVehicleExpense(tx, updated, actor);
    await syncLinkedMaintenanceRequest(tx, updated?.maintenanceRequestId, actor, status === "ملغاة" && isPayableExpensePosted(current.status));
    if (updated && updated.status !== current.status) await recordAuditInTransaction(tx, actor, "payables.updateStatus", "payables", id, "تم تغيير حالة فاتورة مورد");
    return updated;
  });
}
export async function registerPayablePayment(input: InsertPayablePayment, actor: LedgerActor = {}): Promise<PayablePayment | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    // InnoDB holds this row lock through commit. Concurrent payment attempts
    // for the same payable then re-read the updated paid balance in sequence.
    await tx.execute(sql`SELECT id FROM payables WHERE id = ${input.payableId} FOR UPDATE`);
    const payable = (await tx.select().from(payables).where(and(eq(payables.id, input.payableId), isNull(payables.archivedAt))).limit(1))[0];
    if (!payable) return null;
    if (!["معتمدة", "مدفوعة جزئيًا"].includes(payable.status)) throw new Error("يجب اعتماد فاتورة المورد قبل تسجيل الصرف");
    if (input.amount <= 0 || input.amount > payable.amount - payable.paid) throw new Error("المبلغ يتجاوز الرصيد المتبقي أو غير صالح");
    const result = await tx.insert(payablePayments).values(input);
    const paid = payable.paid + input.amount;
    await tx.update(payables).set({ paid, status: paid >= payable.amount ? "مدفوعة" : "مدفوعة جزئيًا" }).where(eq(payables.id, payable.id));
    const id = Number(result[0].insertId);
    const payment = (await tx.select().from(payablePayments).where(eq(payablePayments.id, id)).limit(1))[0] ?? null;
    if (payment) await recordAuditInTransaction(tx, actor, "payables.registerPayment", "payables", payable.id, "تم تسجيل دفعة صادرة للمورد");
    return payment;
  });
}

export async function getCompanyReport(from: string, to: string) {
  const exclusiveEnd = reportPeriodExclusiveEnd(to);
  if (!exclusiveEnd || !isValidReportPeriod(from, to)) return null;
  const db = await getDb();
  if (!db) return null;
  const [vehicleRows, historicalVehicleRows, contractRows, historicalContractRows, contractItemRows, claimRows, incomingRows, payableRows, outgoingRows, maintenanceRows, projectRows, documentRows, employeeRows, driverRows, vehicleExpenseRows, clientRows] = await Promise.all([
    db.select().from(vehicles).where(isNull(vehicles.archivedAt)),
    db.select().from(vehicles),
    db.select().from(contracts).where(isNull(contracts.archivedAt)),
    db.select().from(contracts),
    db.select().from(contractItems),
    db.select().from(claims).where(isNull(claims.archivedAt)),
    db.select().from(payments).where(and(isNull(payments.archivedAt), gte(payments.paidAt, from), lt(payments.paidAt, exclusiveEnd))),
    db.select().from(payables).where(isNull(payables.archivedAt)),
    db.select().from(payablePayments).where(and(gte(payablePayments.paidAt, from), lt(payablePayments.paidAt, exclusiveEnd))),
    db.select().from(maintenanceRequests).where(isNull(maintenanceRequests.archivedAt)),
    db.select().from(projects).where(isNull(projects.archivedAt)),
    db.select().from(documents).where(isNull(documents.archivedAt)),
    db.select().from(employees).where(isNull(employees.archivedAt)),
    db.select().from(drivers).where(isNull(drivers.archivedAt)),
    db.select().from(vehicleExpenses).where(and(isNull(vehicleExpenses.archivedAt), gte(vehicleExpenses.spentAt, from), lt(vehicleExpenses.spentAt, exclusiveEnd))),
    db.select().from(clients).where(isNull(clients.archivedAt)),
  ]);
  const inRange = (value: unknown) => { const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10); return date >= from && date <= to; };
  const periodClaims = claimRows.filter(row => isReceivableClaimStatus(row.status) && inRange(row.submittedAt));
  const periodContracts = contractRows.filter(row => inRange(row.startDate));
  const periodIncoming = incomingRows.filter(row => inRange(row.paidAt));
  const periodOutgoing = outgoingRows.filter(row => inRange(row.paidAt));
  const periodPaymentIds = periodIncoming.map(row => row.id);
  const vehicleRevenueRows = periodPaymentIds.length
    ? await db.select().from(vehicleRevenues).where(and(inArray(vehicleRevenues.paymentId, periodPaymentIds), isNull(vehicleRevenues.archivedAt)))
    : [];
  const { byClaim: incomingByClaimInPeriod, byContract: incomingByContractInPeriod } = groupIncomingPaymentsForReport(periodIncoming, claimRows);
  const outgoingByPayableInPeriod = new Map<number, number>();
  for (const payment of periodOutgoing) outgoingByPayableInPeriod.set(payment.payableId, (outgoingByPayableInPeriod.get(payment.payableId) ?? 0) + payment.amount);
  const periodMaintenance = maintenanceRows.filter(row => inRange(row.start));
  const periodProjects = projectRows.filter(row => inRange(row.startDate));
  const periodDocuments = documentRows.filter(row => inRange(row.expiry));
  const postedPayableIds = new Set(payableRows.filter(row => isPayableExpensePosted(row.status)).map(row => row.id));
  const periodVehicleExpenses = vehicleExpenseRows.filter(row => inRange(row.spentAt) && (row.payableId === null || postedPayableIds.has(row.payableId)));
  const paymentById = new Map(incomingRows.map(row => [row.id, row]));
  const manuallyAllocatedPeriodVehicleRevenues = vehicleRevenueRows;
  const autoLinkedPeriodVehicleRevenues = deriveSingleVehicleAutoRevenues({
    payments: periodIncoming,
    claims: claimRows,
    contracts: historicalContractRows,
    contractItems: contractItemRows,
    vehicles: historicalVehicleRows,
    projects: projectRows,
    clients: clientRows,
    allocations: vehicleRevenueRows,
  });
  const periodVehicleRevenues = [...manuallyAllocatedPeriodVehicleRevenues, ...autoLinkedPeriodVehicleRevenues];
  const outstandingClaims = claimRows.filter(row => outstandingClaimAmount(row) > 0);
  const activePayables = payableRows.filter(row => row.status !== "ملغاة");
  const payableBalances = summarizePayableBalances(activePayables.map(row => ({ amount: row.amount, paid: row.paid, status: row.status, dueDate: row.dueDate })), formatCompanyDate());
  const activeMaintenance = maintenanceRows.filter(row => row.status !== "مكتمل");
  const vehiclesById = new Map(historicalVehicleRows.map(row => [row.id, row]));
  const ledgerGroups = (expenseRows: typeof periodVehicleExpenses, revenueRows: typeof periodVehicleRevenues, key: "vehicleId" | "projectId" | "clientId", labelFor: (row: any) => string) => {
    const grouped = new Map<string, { id: number | null; name: string; expense: number; revenue: number; buses: Set<number> }>();
    const add = (row: any, kind: "expense" | "revenue") => {
      const rawId = row[key] as number | null;
      const name = labelFor(row) || "—";
      const groupKey = rawId != null ? `${key}:${rawId}` : `${key}:${name}`;
      const item = grouped.get(groupKey) ?? { id: rawId ?? null, name, expense: 0, revenue: 0, buses: new Set<number>() };
      item[kind] += Number(row.amount || 0);
      item.buses.add(row.vehicleId);
      grouped.set(groupKey, item);
    };
    expenseRows.forEach(row => add(row, "expense")); revenueRows.forEach(row => add(row, "revenue"));
    return Array.from(grouped.values()).map(item => ({ id: item.id, name: item.name, expense: item.expense, revenue: item.revenue, netOperatingResult: item.revenue - item.expense, busCount: item.buses.size })).sort((a,b) => Math.abs(b.expense) + Math.abs(b.revenue) - Math.abs(a.expense) - Math.abs(a.revenue));
  };
  const vehicleProfitabilityBase = ledgerGroups(periodVehicleExpenses, periodVehicleRevenues, "vehicleId", row => { const bus = vehiclesById.get(row.vehicleId); return bus ? `${bus.plate} · ${bus.brand} ${bus.model}` : `مركبة #${row.vehicleId}`; });
  const vehicleProfitabilityIds = new Set(vehicleProfitabilityBase.map(row => row.id));
  for (const bus of historicalVehicleRows) if (inRange(bus.purchaseDate) && !vehicleProfitabilityIds.has(bus.id)) vehicleProfitabilityBase.push({ id: bus.id, name: `${bus.plate} · ${bus.brand} ${bus.model}`, expense: 0, revenue: 0, netOperatingResult: 0, busCount: 1 });
  const vehicleProfitability = vehicleProfitabilityBase.map(row => { const bus = vehiclesById.get(row.id ?? -1); const purchaseInPeriod = bus && inRange(bus.purchaseDate) ? Number(bus.purchasePrice || 0) : 0; return { ...row, plate: bus?.plate ?? row.name, purchaseInPeriod, netReturn: row.revenue - row.expense - purchaseInPeriod }; });
  const projectProfitability = ledgerGroups(periodVehicleExpenses, periodVehicleRevenues, "projectId", row => row.projectName || "—");
  const clientProfitability = ledgerGroups(periodVehicleExpenses, periodVehicleRevenues, "clientId", row => row.clientName || "—");
  const vehicleCostsInPeriod = periodVehicleExpenses.reduce((sum,row) => sum + Number(row.amount || 0), 0);
  const allocatedVehicleRevenueInPeriod = periodVehicleRevenues.reduce((sum,row) => sum + Number(row.amount || 0), 0);
  return {
    period: { from, to },
    fleet: {
      total: vehicleRows.length,
      working: vehicleRows.filter(row => ["مؤجرة", "مشغولة"].includes(row.status)).length,
      ready: vehicleRows.filter(row => row.status === "متاحة").length,
      maintenance: vehicleRows.filter(row => row.status === "في الصيانة").length,
      leased: vehicleRows.filter(row => row.status === "مؤجرة").length,
      stopped: vehicleRows.filter(row => row.status === "متوقفة").length,
      setup: vehicleRows.filter(row => row.status === "قيد التجهيز").length,
    },
    finance: {
      contractsValueInPeriod: periodContracts.reduce((sum, row) => sum + row.total, 0),
      incomingInPeriod: periodIncoming.reduce((sum, row) => sum + row.amount, 0),
      receivableOutstanding: totalOutstandingClaims(claimRows),
      unpaidClaims: countOutstandingClaims(claimRows),
      overdueClaims: outstandingClaims.filter(row => isCompanyDateBeforeToday(row.due) && row.amount > row.paid).length,
      payablesOutstanding: payableBalances.recognizedOutstanding,
      payablesPendingApproval: payableBalances.pendingApprovalCount,
      payablesPendingApprovalAmount: payableBalances.pendingApprovalAmount,
      outgoingInPeriod: periodOutgoing.reduce((sum, row) => sum + row.amount, 0),
      vehicleCostsInPeriod,
      allocatedVehicleRevenueInPeriod,
      fleetVehicleNetInPeriod: allocatedVehicleRevenueInPeriod - vehicleCostsInPeriod - vehicleProfitability.reduce((sum,row) => sum + row.purchaseInPeriod, 0),
      overduePayables: payableBalances.overdueRecognizedCount,
    },
    maintenance: {
      openedInPeriod: periodMaintenance.length,
      openNow: activeMaintenance.length,
      completedInPeriod: periodMaintenance.filter(row => row.status === "مكتمل").length,
      costInPeriod: maintenanceExpenseTotalInPeriod(periodVehicleExpenses),
      overdueNow: activeMaintenance.filter(row => isCompanyDateBeforeToday(row.expectedReturn || row.due)).length,
    },
    projects: {
      startedInPeriod: periodProjects.length,
      totalNow: projectRows.length,
      activeNow: projectRows.filter(row => row.status === "نشط").length,
      requiredVehicles: projectRows.filter(row => row.status === "نشط").reduce((sum, row) => sum + row.requiredVehicles, 0),
      assignedVehicles: vehicleRows.filter(row => row.projectId !== null).length,
    },
    documents: {
      expiringInPeriod: periodDocuments.length,
      expiredNow: documentRows.filter(row => isCompanyDateBeforeToday(row.expiry)).length,
      expiringNext30Days: documentRows.filter(row => isWithinUpcomingDays(row.expiry, 30)).length,
    },
    people: {
      employees: employeeRows.length,
      activeEmployees: employeeRows.filter(row => row.status === "نشط").length,
      drivers: driverRows.length,
      availableDrivers: driverRows.filter(row => row.status === "متاح").length,
    },
    details: {
      payments: incomingPaymentRowsForReport(periodIncoming, claimRows, historicalContractRows, clientRows),
      receivablesAging: outstandingClaims.map(row => ({
        id: row.id,
        ref: row.ref,
        client: row.client,
        status: row.status,
        amount: Number(row.amount || 0),
        paid: Number(row.paid || 0),
        outstanding: outstandingClaimAmount(row),
        due: row.due,
        ...receivableAging(row.due),
      })),
      claims: periodClaims.map(row => ({ id: row.id, ref: row.ref, client: row.client, status: row.status, amount: row.amount, paidInPeriod: incomingByClaimInPeriod.get(row.id) ?? 0, outstandingNow: outstandingClaimAmount(row), due: row.due })),
      contracts: periodContracts.map(row => ({ id: row.id, ref: row.ref, client: row.client, status: row.status, total: row.total, collectedInPeriod: incomingByContractInPeriod.get(row.id) ?? 0, startDate: row.startDate, expiry: row.expiry })),
      payables: activePayables.filter(row => inRange(row.issueDate)).map(row => ({ id: row.id, ref: row.ref, supplier: row.supplier, status: row.status, amount: row.amount, paidInPeriod: outgoingByPayableInPeriod.get(row.id) ?? 0, remainingNow: isPayableExpensePosted(row.status) ? Math.max(0, row.amount - row.paid) : 0, pendingApprovalAmount: row.status === "جديدة" ? Math.max(0, Number(row.amount || 0)) : 0, issueDate: row.issueDate, dueDate: row.dueDate, vehicleId: row.vehicleId, maintenanceRequestId: row.maintenanceRequestId })),
      documentSummaryRows: documentRows.map(row => {
        return {
          entityType: row.entityType || "",
          entityId: row.entityId,
          expiringInPeriod: inRange(row.expiry),
          expiredNow: isCompanyDateBeforeToday(row.expiry),
          expiringNext30Days: isWithinUpcomingDays(row.expiry, 30),
        };
      }),
      payableSummaryRows: activePayables.map(row => {
        const awaitingApproval = row.status === "جديدة";
        const recognized = isPayableExpensePosted(row.status);
        return {
          id: row.id,
          remainingNow: recognized ? Math.max(0, row.amount - row.paid) : 0,
          pendingApproval: awaitingApproval,
          pendingApprovalAmount: awaitingApproval ? Math.max(0, Number(row.amount || 0)) : 0,
          paidInPeriod: outgoingByPayableInPeriod.get(row.id) ?? 0,
          overdue: recognized && isCompanyDateBeforeToday(row.dueDate) && row.amount > row.paid,
          vehicleId: row.vehicleId,
          maintenanceRequestId: row.maintenanceRequestId,
        };
      }),
      maintenance: periodMaintenance.map(row => {
        const linkedInvoices = activePayables.filter(invoice => invoice.maintenanceRequestId === row.id);
        const estimatedCost = Math.max(0, Number(row.estimatedCost || 0)) + Math.max(0, Number(row.quotedPartsCost || 0));
        const postedInvoices = linkedInvoices.filter(invoice => isPayableExpensePosted(invoice.status));
        const invoicedCost = maintenanceInvoiceTotal(linkedInvoices);
        return {
          id: row.id,
          ref: row.ref,
          vehicle: row.vehicle,
          status: row.status,
          cost: row.cost,
          estimatedCost,
          invoicedCost,
          costVariance: postedInvoices.length ? invoicedCost - estimatedCost : null,
          invoiceCount: postedInvoices.length,
          start: row.start,
          expectedReturn: row.expectedReturn,
        };
      }),
      operatingExpenses: periodVehicleExpenses.map(row => {
        const vehicle = vehiclesById.get(row.vehicleId);
        const payable = row.payableId ? payableRows.find(item => item.id === row.payableId) : null;
        return {
          id: row.id,
          vehicleId: row.vehicleId,
          vehicle: vehicle?.plate ?? `مركبة #${row.vehicleId}`,
          category: row.category,
          description: row.description,
          vendor: row.vendor,
          amount: Number(row.amount || 0),
          spentAt: row.spentAt,
          projectId: row.projectId,
          projectName: row.projectName,
          clientId: row.clientId,
          clientName: row.clientName,
          maintenanceRequestId: row.maintenanceRequestId,
          payableId: row.payableId,
          payableVehicleId: payable?.vehicleId ?? null,
          payableMaintenanceRequestId: payable?.maintenanceRequestId ?? null,
        };
      }),
      vehicleProfitability,
      projectProfitability,
      clientProfitability,
      employees: employeeRows.map(row => ({ id: row.id, employeeNo: row.employeeNo, name: row.name, department: row.department, jobTitle: row.jobTitle, hireDate: row.hireDate, status: row.status })),
      drivers: driverRows.map(row => ({ id: row.id, name: row.name, status: row.status, vehicle: row.vehicle, renewal: row.renewal, renewalStatus: resolveRenewalStatus(row.renewal) })),
    },
  };
}

type DbExecutor = any;
async function lockPaymentReferences(db: DbExecutor, ...inputs: Array<{ contractId?: number | null; claimId?: number | null }>) {
  const contractIds = Array.from(new Set(inputs.map(input => input.contractId).filter((id): id is number => Boolean(id)))).sort((a, b) => a - b);
  const claimIds = Array.from(new Set(inputs.map(input => input.claimId).filter((id): id is number => Boolean(id)))).sort((a, b) => a - b);
  for (const id of contractIds) await db.execute(sql`SELECT id FROM contracts WHERE id = ${id} FOR UPDATE`);
  for (const id of claimIds) await db.execute(sql`SELECT id FROM claims WHERE id = ${id} FOR UPDATE`);
}
async function normalizePaymentReferences(db: DbExecutor, input: { contractId?: number | null; claimId?: number | null; clientId?: number | null; amount?: number }) {
  const claim = input.claimId
    ? (await db.select({ contractId: claims.contractId, clientId: claims.clientId }).from(claims).where(and(eq(claims.id, input.claimId), isNull(claims.archivedAt))).limit(1))[0]
    : undefined;
  const contractId = input.contractId ?? claim?.contractId ?? null;
  const contract = contractId
    ? (await db.select({ clientId: contracts.clientId }).from(contracts).where(and(eq(contracts.id, contractId), isNull(contracts.archivedAt))).limit(1))[0]
    : undefined;
  return { ...input, contractId, clientId: input.clientId ?? claim?.clientId ?? contract?.clientId ?? null };
}
async function validatePaymentReferences(db: DbExecutor, input: { contractId?: number | null; claimId?: number | null; clientId?: number | null; amount?: number }) {
  if (!input.contractId && !input.claimId && !input.clientId) throw new Error("يجب ربط الدفعة بعقد أو مطالبة أو عميل");
  if (input.contractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!contract) throw new Error("العقد المرتبط بالدفعة غير موجود");
    if (input.amount !== undefined && !canAcceptContractPayment({ total: Number(contract.total), collected: Number(contract.collected), amount: Number(input.amount) })) throw new Error("قيمة الدفعة تتجاوز الرصيد المتبقي من العقد");
    const claim = input.claimId ? (await db.select().from(claims).where(and(eq(claims.id, input.claimId), isNull(claims.archivedAt))).limit(1).for("update"))[0] : undefined;
    validatePaymentLinkConsistency({ paymentClientId: input.clientId, contractClientId: contract.clientId, claimClientId: claim?.clientId, paymentContractId: input.contractId, claimContractId: claim?.contractId });
  }
  if (input.claimId) {
    const claim = (await db.select().from(claims).where(and(eq(claims.id, input.claimId), isNull(claims.archivedAt))).limit(1).for("update"))[0];
    if (!claim) throw new Error("المطالبة المرتبطة بالدفعة غير موجودة");
    if (claim.status !== "تم اعتمادها" && claim.status !== "تم صرفها") throw new Error("لا يمكن تسجيل دفعة قبل اعتماد المطالبة");
    const contract = input.contractId ? (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1).for("update"))[0] : undefined;
    validatePaymentLinkConsistency({ paymentClientId: input.clientId, contractClientId: contract?.clientId, claimClientId: claim.clientId, paymentContractId: input.contractId, claimContractId: claim.contractId });
    if (Number(input.amount ?? 0) > claim.amount - claim.paid) throw new Error("قيمة الدفعة تتجاوز المتبقي من المطالبة");
  }
  if (input.clientId) {
    const client = (await db.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0];
    if (!client) throw new Error("العميل المرتبط بالدفعة غير موجود");
  }
}
async function applyPaymentImpact(db: DbExecutor, input: { contractId?: number | null; claimId?: number | null; amount?: number }, direction: 1 | -1) {
  const amount = Number(input.amount ?? 0) * direction;
  if (input.contractId && amount) await db.update(contracts).set({ collected: sql`GREATEST(0, ${contracts.collected} + ${amount})` }).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt)));
  if (input.claimId && amount) {
    const claim = (await db.select().from(claims).where(and(eq(claims.id, input.claimId), isNull(claims.archivedAt))).limit(1).for("update"))[0];
    if (claim) {
      const paid = Math.max(0, claim.paid + amount);
      const status = paid >= claim.amount ? "تم صرفها" : claim.status === "تم صرفها" ? "تم اعتمادها" : claim.status;
      await db.update(claims).set({ paid, status }).where(eq(claims.id, input.claimId));
    }
  }
}
export async function createPayment(input: typeof payments.$inferInsert, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const normalized = await normalizePaymentReferences(tx, input);
    await lockPaymentReferences(tx, normalized);
    await validatePaymentReferences(tx, normalized);
    const result = await tx.insert(payments).values(normalized);
    const paymentId = Number(result[0].insertId);
    await applyPaymentImpact(tx, normalized, 1);
    const payment = (await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1))[0] ?? null;
    if (payment) await recordAuditInTransaction(tx, actor, "payments.create", "payments", paymentId, "تم تسجيل دفعة واردة");
    return payment;
  });
}
export async function updatePayment(id: number, input: Partial<typeof payments.$inferInsert>, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(payments).where(and(eq(payments.id, id), isNull(payments.archivedAt))).limit(1))[0];
    if (!current) return null;
    const next = await normalizePaymentReferences(tx, { ...current, ...input });
    await lockPaymentReferences(tx, current, next);
    const allocations = await tx.select({ amount: vehicleRevenues.amount }).from(vehicleRevenues).where(and(eq(vehicleRevenues.paymentId, id), isNull(vehicleRevenues.archivedAt)));
    const allocated = allocations.reduce((total, row) => total + Number(row.amount || 0), 0);
    if (input.amount !== undefined && Number(next.amount) < allocated) throw new Error(`لا يمكن خفض الدفعة عن الإيرادات المخصصة للباصات (${allocated} SAR)`);
    if (allocations.length && ((input.contractId !== undefined && input.contractId !== current.contractId) || (input.claimId !== undefined && input.claimId !== current.claimId))) throw new Error("لا يمكن نقل الدفعة إلى عقد أو مطالبة أخرى بعد تخصيص جزء منها لباص");
    await applyPaymentImpact(tx, current, -1);
    await validatePaymentReferences(tx, next);
    await tx.update(payments).set({ ...input, contractId: next.contractId, clientId: next.clientId }).where(eq(payments.id, id));
    await applyPaymentImpact(tx, next, 1);
    const payment = (await tx.select().from(payments).where(eq(payments.id, id)).limit(1))[0] ?? null;
    if (payment && Object.keys(input).length) await recordAuditInTransaction(tx, actor, "payments.update", "payments", id, "تم تعديل دفعة واردة");
    return payment;
  });
}
export async function archivePayment(id: number, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(payments).where(and(eq(payments.id, id), isNull(payments.archivedAt))).limit(1))[0];
    if (!current) return false;
    const allocations = await tx.select({ id: vehicleRevenues.id }).from(vehicleRevenues).where(and(eq(vehicleRevenues.paymentId, id), isNull(vehicleRevenues.archivedAt))).limit(1);
    if (allocations.length) throw new Error("لا يمكن إلغاء هذه الدفعة قبل إلغاء تخصيص إيرادات الباص المرتبطة بها");
    await applyPaymentImpact(tx, current, -1);
    await tx.update(payments).set({ archivedAt: new Date() }).where(eq(payments.id, id));
    await recordAuditInTransaction(tx, actor, "payments.archive", "payments", id, "تم إلغاء دفعة واردة وعكس أثرها");
    return true;
  });
}

export async function listInventoryItems(): Promise<InventoryItem[] | null> {
  const db = await getDb();
  return db ? db.select().from(inventoryItems).where(isNull(inventoryItems.archivedAt)).orderBy(inventoryItems.name) : null;
}
export async function listInventoryMovements(itemId?: number): Promise<InventoryMovement[] | null> {
  const db = await getDb();
  if (!db) return null;
  return itemId === undefined
    ? db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(500)
    : db.select().from(inventoryMovements).where(eq(inventoryMovements.itemId, itemId)).orderBy(desc(inventoryMovements.createdAt)).limit(200);
}
export async function createInventoryItem(input: InsertInventoryItem, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const result = await tx.insert(inventoryItems).values({ ...input, onHand: 0 });
    const id = Number(result[0].insertId);
    await recordAuditInTransaction(tx, actor, "inventory.create", "inventory_item", id, `إضافة صنف مخزون ${input.sku}`);
    return (await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1))[0] ?? null;
  });
}
export async function updateInventoryItem(id: number, input: Partial<Pick<InsertInventoryItem, "sku" | "name" | "category" | "unit" | "reorderLevel" | "location" | "notes">>, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${id} AND archivedAt IS NULL FOR UPDATE`);
    const current = (await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), isNull(inventoryItems.archivedAt))).limit(1))[0];
    if (!current) return null;
    await tx.update(inventoryItems).set(input).where(eq(inventoryItems.id, id));
    if (Object.keys(input).length) await recordAuditInTransaction(tx, actor, "inventory.update", "inventory_item", id, `تعديل الصنف ${current.sku}`);
    return (await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1))[0] ?? null;
  });
}
export async function recordInventoryMovement(input: { itemId: number; direction: InventoryDirection; quantity: number; reference?: string; recipient?: string; notes?: string }, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${input.itemId} AND archivedAt IS NULL FOR UPDATE`);
    const item = (await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, input.itemId), isNull(inventoryItems.archivedAt))).limit(1))[0];
    if (!item) return null;
    const resultingBalance = nextInventoryBalance(item.onHand, input.direction as InventoryDirection, input.quantity);
    await tx.update(inventoryItems).set({ onHand: resultingBalance }).where(eq(inventoryItems.id, item.id));
    const [inserted] = await tx.insert(inventoryMovements).values({ ...input, resultingBalance, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    const movementId = Number(inserted.insertId);
    await recordAuditInTransaction(tx, actor, `inventory.${input.direction === "استلام" ? "receive" : "issue"}`, "inventory_item", item.id, `${input.direction} ${input.quantity} ${item.unit} من ${item.sku} · الرصيد ${resultingBalance}`);
    return (await tx.select().from(inventoryMovements).where(eq(inventoryMovements.id, movementId)).limit(1))[0] ?? null;
  });
}
export async function archiveInventoryItem(id: number, actor: LedgerActor = {}) {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${id} AND archivedAt IS NULL FOR UPDATE`);
    const item = (await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), isNull(inventoryItems.archivedAt))).limit(1))[0];
    if (!item) return false;
    if (item.onHand !== 0) throw new Error("لا يمكن أرشفة صنف له رصيد متبقٍ؛ سجّل الصرف أو التسوية أولًا");
    await tx.update(inventoryItems).set({ archivedAt: new Date() }).where(eq(inventoryItems.id, id));
    await recordAuditInTransaction(tx, actor, "inventory.archive", "inventory_item", id, `أرشفة الصنف ${item.sku}`);
    return true;
  });
}
export async function listInventoryRequests(): Promise<Array<InventoryRequest & { items: Array<{ id: number; itemId: number; itemName: string; sku: string; unit: string; requestedQuantity: number; approvedQuantity: number; issuedQuantity: number }> }> | null> {
  const db = await getDb();
  if (!db) return null;
  const requests = await db.select().from(inventoryRequests).orderBy(desc(inventoryRequests.createdAt));
  const lines = await db.select().from(inventoryRequestItems).orderBy(inventoryRequestItems.id);
  const grouped = new Map<number, typeof lines>();
  for (const line of lines) grouped.set(line.requestId, [...(grouped.get(line.requestId) ?? []), line]);
  return requests.map(request => ({ ...request, items: grouped.get(request.id) ?? [] }));
}
export async function createInventoryRequest(input: { ref: string; purpose: string; items: Array<{ itemId: number; quantity: number }> }, actor: LedgerActor & { name: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const selectedItems = [] as InventoryItem[];
    for (const itemId of Array.from(new Set(input.items.map(line => line.itemId))).sort((a, b) => a - b)) {
      await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${itemId} AND archivedAt IS NULL FOR UPDATE`);
      const item = (await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), isNull(inventoryItems.archivedAt))).limit(1))[0];
      if (!item) throw new Error("يوجد صنف غير موجود أو مؤرشف في الطلب");
      selectedItems.push(item);
    }
    const byId = new Map(selectedItems.map(item => [item.id, item]));
    const [inserted] = await tx.insert(inventoryRequests).values({ ref: input.ref, purpose: input.purpose, requestedByUserId: actor.id ?? null, requestedByName: actor.name });
    const id = Number(inserted.insertId);
    await tx.insert(inventoryRequestItems).values(input.items.map(line => {
      const item = byId.get(line.itemId)!;
      return { requestId: id, itemId: item.id, itemName: item.name, sku: item.sku, unit: item.unit, requestedQuantity: line.quantity };
    }));
    await recordAuditInTransaction(tx, actor, "inventory.request.create", "inventory_request", id, `إنشاء طلب صرف ${input.ref} · ${input.items.length} أصناف`);
    const request = (await tx.select().from(inventoryRequests).where(eq(inventoryRequests.id, id)).limit(1))[0]!;
    const lines = await tx.select().from(inventoryRequestItems).where(eq(inventoryRequestItems.requestId, id));
    return { ...request, items: lines };
  });
}
export async function decideInventoryRequest(id: number, approved: boolean, notes: string | undefined, actor: LedgerActor & { name: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM inventory_requests WHERE id = ${id} FOR UPDATE`);
    const request = (await tx.select().from(inventoryRequests).where(eq(inventoryRequests.id, id)).limit(1))[0];
    if (!request) return null;
    const nextStatus = nextInventoryRequestStatus(request.status, approved ? "اعتماد" : "رفض");
    const lines = await tx.select().from(inventoryRequestItems).where(eq(inventoryRequestItems.requestId, id));
    if (approved) {
      const balances = new Map<number, number>();
      for (const itemId of Array.from(new Set(lines.map(line => line.itemId))).sort((a, b) => a - b)) {
        await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${itemId} AND archivedAt IS NULL FOR UPDATE`);
        const item = (await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), isNull(inventoryItems.archivedAt))).limit(1))[0];
        if (item) balances.set(itemId, item.onHand);
      }
      validateInventoryRequestAvailability(lines.map(line => ({ itemId: line.itemId, itemName: line.itemName, requestedQuantity: line.requestedQuantity })), balances);
      for (const line of lines) await tx.update(inventoryRequestItems).set({ approvedQuantity: line.requestedQuantity }).where(eq(inventoryRequestItems.id, line.id));
    }
    await tx.update(inventoryRequests).set({ status: nextStatus, approvalNotes: notes ?? null, approvedByUserId: actor.id ?? null, approvedByName: actor.name, approvedAt: new Date() }).where(eq(inventoryRequests.id, id));
    await recordAuditInTransaction(tx, actor, approved ? "inventory.request.approve" : "inventory.request.reject", "inventory_request", id, `${approved ? "اعتماد" : "رفض"} طلب الصرف ${request.ref}${notes ? ` · ${notes}` : ""}`);
    const updated = (await tx.select().from(inventoryRequests).where(eq(inventoryRequests.id, id)).limit(1))[0]!;
    return { ...updated, items: await tx.select().from(inventoryRequestItems).where(eq(inventoryRequestItems.requestId, id)) };
  });
}
export async function issueInventoryRequest(id: number, actor: LedgerActor & { name: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM inventory_requests WHERE id = ${id} FOR UPDATE`);
    const request = (await tx.select().from(inventoryRequests).where(eq(inventoryRequests.id, id)).limit(1))[0];
    if (!request) return null;
    const nextStatus = nextInventoryRequestStatus(request.status, "صرف");
    const lines = await tx.select().from(inventoryRequestItems).where(eq(inventoryRequestItems.requestId, id));
    const items = new Map<number, InventoryItem>();
    for (const itemId of Array.from(new Set(lines.map(line => line.itemId))).sort((a, b) => a - b)) {
      await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${itemId} AND archivedAt IS NULL FOR UPDATE`);
      const item = (await tx.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), isNull(inventoryItems.archivedAt))).limit(1))[0];
      if (!item) throw new Error("تعذر الصرف؛ أحد الأصناف مؤرشف أو غير موجود");
      items.set(itemId, item);
    }
    for (const line of lines) {
      const item = items.get(line.itemId)!;
      const resultingBalance = nextInventoryBalance(item.onHand, "صرف", line.approvedQuantity);
      await tx.update(inventoryItems).set({ onHand: resultingBalance }).where(eq(inventoryItems.id, item.id));
      await tx.insert(inventoryMovements).values({ itemId: item.id, direction: "صرف", quantity: line.approvedQuantity, resultingBalance, reference: request.ref, recipient: request.requestedByName, notes: request.purpose, actorUserId: actor.id ?? null, actorName: actor.name });
      await tx.update(inventoryRequestItems).set({ issuedQuantity: line.approvedQuantity }).where(eq(inventoryRequestItems.id, line.id));
      item.onHand = resultingBalance;
    }
    await tx.update(inventoryRequests).set({ status: nextStatus, issuedAt: new Date() }).where(eq(inventoryRequests.id, id));
    await recordAuditInTransaction(tx, actor, "inventory.request.issue", "inventory_request", id, `صرف طلب ${request.ref} إلى ${request.requestedByName}`);
    const updated = (await tx.select().from(inventoryRequests).where(eq(inventoryRequests.id, id)).limit(1))[0]!;
    return { ...updated, items: await tx.select().from(inventoryRequestItems).where(eq(inventoryRequestItems.requestId, id)) };
  });
}
export async function listAccidents(): Promise<Array<Omit<Accident, "najmReportUrl"> & { hasNajmReport: boolean }> | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(accidents).where(isNull(accidents.archivedAt)).orderBy(desc(accidents.occurredAt), desc(accidents.createdAt));
  return rows.map(({ najmReportUrl, ...row }) => ({ ...row, hasNajmReport: Boolean(najmReportUrl) }));
}
export async function getAccident(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(accidents).where(and(eq(accidents.id, id), isNull(accidents.archivedAt))).limit(1))[0] ?? null;
}
export async function listAccidentEvents(id: number): Promise<AccidentEvent[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(accidentEvents).where(eq(accidentEvents.accidentId, id)).orderBy(desc(accidentEvents.createdAt));
}
export async function createAccident(input: Omit<InsertAccident, "id" | "workflowStage" | "reportedByUserId" | "reportedByName" | "closedAt">, actor: LedgerActor & { name: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const [inserted] = await tx.insert(accidents).values({ ...input, workflowStage: "بلاغ", reportedByUserId: actor.id ?? null, reportedByName: actor.name });
    const id = Number(inserted.insertId);
    await tx.insert(accidentEvents).values({ accidentId: id, fromStage: null, toStage: "بلاغ", details: "إنشاء بلاغ حادث", actorUserId: actor.id ?? null, actorName: actor.name });
    await recordAuditInTransaction(tx, actor, "accident.create", "accident", id, `إنشاء بلاغ حادث ${input.ref} للمركبة ${input.vehiclePlate}`);
    return (await tx.select().from(accidents).where(eq(accidents.id, id)).limit(1))[0] ?? null;
  });
}
export async function updateAccident(id: number, input: Partial<Pick<InsertAccident, "occurredAt" | "location" | "description" | "najmReportNo" | "najmReportName" | "najmReportUrl" | "faultPercent" | "estimatedRepairCost" | "insurerName" | "insurerClaimRef" | "insurerClaimStatus" | "settlementAmount" | "resolutionNotes">>, actor: LedgerActor & { name: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM accidents WHERE id = ${id} AND archivedAt IS NULL FOR UPDATE`);
    const current = (await tx.select().from(accidents).where(and(eq(accidents.id, id), isNull(accidents.archivedAt))).limit(1))[0];
    if (!current) return null;
    if (["مغلق", "ملغي"].includes(current.workflowStage)) throw new Error("لا يمكن تعديل حادث مغلق أو ملغي");
    await tx.update(accidents).set(input).where(eq(accidents.id, id));
    if (Object.keys(input).length) await recordAuditInTransaction(tx, actor, "accident.update", "accident", id, `تعديل بلاغ الحادث ${current.ref}`);
    return (await tx.select().from(accidents).where(eq(accidents.id, id)).limit(1))[0] ?? null;
  });
}
export async function advanceAccident(id: number, target: AccidentStage, input: Partial<Pick<InsertAccident, "faultPercent" | "estimatedRepairCost" | "insurerName" | "insurerClaimRef" | "insurerClaimStatus" | "settlementAmount" | "resolutionNotes">>, actor: LedgerActor & { name: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM accidents WHERE id = ${id} AND archivedAt IS NULL FOR UPDATE`);
    const current = (await tx.select().from(accidents).where(and(eq(accidents.id, id), isNull(accidents.archivedAt))).limit(1))[0];
    if (!current) return null;
    const data = { ...current, ...input };
    const nextStage = nextAccidentStage(current.workflowStage as AccidentStage, target, data);
    await tx.update(accidents).set({ ...input, workflowStage: nextStage, ...(nextStage === "مغلق" ? { closedAt: new Date() } : {}) }).where(eq(accidents.id, id));
    await tx.insert(accidentEvents).values({ accidentId: id, fromStage: current.workflowStage, toStage: nextStage, details: input.resolutionNotes ?? input.insurerClaimRef ?? null, actorUserId: actor.id ?? null, actorName: actor.name });
    await recordAuditInTransaction(tx, actor, "accident.advance", "accident", id, `نقل الحادث ${current.ref} من ${current.workflowStage} إلى ${nextStage}`);
    return (await tx.select().from(accidents).where(eq(accidents.id, id)).limit(1))[0] ?? null;
  });
}
export async function updateSetting(id: number, input: Partial<typeof settingCatalog.$inferInsert>) { const db = await getDb(); if (!db) return null; await db.update(settingCatalog).set(input).where(eq(settingCatalog.id, id)); return (await db.select().from(settingCatalog).where(eq(settingCatalog.id, id)).limit(1))[0] ?? null; }
export async function archiveSetting(id: number) { const db = await getDb(); if (!db) return false; await db.update(settingCatalog).set({ active: 0 }).where(eq(settingCatalog.id, id)); return true; }
export async function listRepresentatives(clientId: number) { const db = await getDb(); return db ? db.select().from(clientRepresentatives).where(and(eq(clientRepresentatives.clientId, clientId), isNull(clientRepresentatives.archivedAt))) : null; }
export async function createRepresentative(input: typeof clientRepresentatives.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(clientRepresentatives).values(input); const rows = await db.select().from(clientRepresentatives).where(eq(clientRepresentatives.id, Number(result[0].insertId))).limit(1); return rows[0] ?? null; }
export async function listUsers() { const db = await getDb(); return db ? db.select({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, permissions: users.permissions, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt)) : null; }
export class LastActiveAdminDemotionError extends Error {
  constructor() { super("لا يمكن تخفيض صلاحية آخر مدير نشط في النظام"); this.name = "LastActiveAdminDemotionError"; }
}
export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    // Lock users in a stable order so simultaneous demotions cannot both pass
    // a stale administrator count and leave the system without an active admin.
    const lockedUsers = await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).orderBy(users.id).for("update");
    const current = lockedUsers.find(user => user.id === id);
    if (!current) return null;
    const activeAdminCount = lockedUsers.filter(user => user.role === "admin" && user.isActive === 1).length;
    if (isProtectedLastAdminDemotion({ targetRole: current.role, targetActive: current.isActive, nextRole: role, activeAdminCount })) throw new LastActiveAdminDemotionError();
    await tx.update(users).set({ role }).where(eq(users.id, id));
    return (await tx.select({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, permissions: users.permissions, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, id)).limit(1))[0] ?? null;
  });
}
export async function updateUserAccess(id: number, input: { permissions?: string[]; password?: string }) {
  const db = await getDb();
  if (!db) return null;
  const data: Partial<typeof users.$inferInsert> = {};
  if (input.permissions) data.permissions = JSON.stringify(input.permissions);
  if (input.password) data.passwordHash = hashPassword(input.password);
  if (Object.keys(data).length) await db.update(users).set(data).where(eq(users.id, id));
  return (await db.select({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, permissions: users.permissions, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, id)).limit(1))[0] ?? null;
}
export async function listSettings(category?: string) { const db = await getDb(); if (!db) return null; return category ? db.select().from(settingCatalog).where(eq(settingCatalog.category, category)) : db.select().from(settingCatalog); }
export async function upsertSetting(input: typeof settingCatalog.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(settingCatalog).values(input); return Number(result[0].insertId); }
export async function deleteSetting(id: number) { const db = await getDb(); if (!db) return false; await db.delete(settingCatalog).where(eq(settingCatalog.id, id)); return true; }
export async function listAuditLogs() {
  const db = await getDb();
  return db ? db.select({ id: auditLogs.id, userId: auditLogs.userId, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt, actorName: users.name, actorUsername: users.username })
    .from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(200) : null;
}
export async function createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLog | null> { const db = await getDb(); if (!db) return null; const result = await db.insert(auditLogs).values(input); const rows = await db.select().from(auditLogs).where(eq(auditLogs.id, Number(result[0].insertId))).limit(1); return rows[0] ?? null; }
