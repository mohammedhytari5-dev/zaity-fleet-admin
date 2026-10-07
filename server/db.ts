import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { getMysqlConnectionOptions } from "./db-connection";
import { AuditLog, Claim, Client, Contract, ContractItem, Document, Driver, Employee, InsertEmployee, InsertClaim, InsertClient, InsertContract, InsertContractItem, InsertDocument, InsertDriver, InsertMaintenanceRequest, InsertUser, InsertVehicle, InsertVehicleExpense, VehicleExpense, InsertVehicleRevenue, VehicleRevenue, MaintenanceRequest, User, Vehicle, auditLogs, claims, clientRepresentatives, clients, contractItems, contracts, documents, drivers, employees, maintenanceEvents, maintenanceRequests, notifications, payments, vehicleExpenses, vehicleRevenues, settingCatalog, tasks, users, vehicles } from "../drizzle/schema";
import { canAdvanceMaintenance, statusForMaintenanceStage, type MaintenanceStage } from "../shared/maintenance-domain";
import { InsertProject, Project, projects } from "../drizzle/schema";
import { InsertPayable, Payable, PayablePayment, InsertPayablePayment, payables, payablePayments } from "../drizzle/schema";
import { ENV } from './_core/env';
import { summarizeMaintenanceItems } from "./vehicle-maintenance-summary";
import { canUpdateClaim, validatePaymentLinkConsistency } from "./finance-domain";
import { isPayableExpensePosted } from "./payable-expense-policy";
import { maintenanceInvoiceTotal } from "./maintenance-invoice-total";
import { isProtectedLastAdminDemotion } from "./user-role-domain";

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
  const autoLinkedPayments = paymentRows.flatMap(payment => {
    const contractId = payment.contractId ?? (payment.claimId ? claimById.get(payment.claimId)?.contractId : null);
    if (!contractId) return [];
    const contract = contractById.get(contractId);
    if (!contract) return [];
    const items = contractItemRows.filter(item => item.contractId === contractId);
    const linkedVehicleIds = Array.from(new Set(items.map(item => item.vehicleId).filter((id): id is number => id !== null)));
    const linkedToThisVehicle = items.length ? items.some(item => item.vehicleId === vehicleId) : vehicle.contractId === contractId;
    const isSingleVehicleContract = items.length ? linkedVehicleIds.length === 1 && linkedVehicleIds[0] === vehicleId : vehicle.contractId === contractId;
    if (!linkedToThisVehicle || !isSingleVehicleContract) return [];
    const allocated = usedByPayment.get(payment.id) ?? 0;
    const remaining = Math.max(0, Number(payment.amount || 0) - allocated);
    if (!remaining) return [];
    const client = clientRows.find(row => row.id === (payment.clientId ?? contract.clientId));
    return [{ id: -payment.id, vehicleId, paymentId: payment.id, projectId: vehicle.projectId ?? null, projectName: vehicle.project || "—", clientId: client?.id ?? contract.clientId ?? null, clientName: client?.name ?? contract.client ?? "—", amount: remaining, receiptName: null, notes: "دفعة مرتبطة تلقائيًا بعقد بباص واحد", createdByName: "تلقائي", hasReceipt: false, autoLinked: true, paidAt: payment.paidAt, method: payment.method, reference: payment.reference, contractRef: contract.ref, client: client?.name ?? contract.client ?? "—" }];
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
export async function archiveEmployee(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const employee = (await tx.select().from(employees).where(and(eq(employees.id, id), isNull(employees.archivedAt))).limit(1))[0];
    if (!employee) return false;
    await tx.update(vehicles).set({ employeeId: null }).where(eq(vehicles.employeeId, id));
    await tx.update(projects).set({ managerEmployeeId: null }).where(eq(projects.managerEmployeeId, id));
    await tx.update(employees).set({ status: "منتهي الخدمة", archivedAt: new Date() }).where(eq(employees.id, id));
    return true;
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
  if (nextClientId && nextContractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, nextContractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!contract || (contract.clientId && contract.clientId !== nextClientId)) return null;
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
  await db.update(drivers).set(input).where(and(eq(drivers.id, id), isNull(drivers.archivedAt)));
  const updated = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return updated[0] ?? null;
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
function parseRiyalAmount(value: unknown) {
  const arabicDigits: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  const normalized = String(value ?? "").replace(/[٠-٩]/g, digit => arabicDigits[digit]).replace(/[٬,]/g, "").replace(/[^0-9.\-]/g, "");
  return Math.max(0, Math.round(Number(normalized) || 0));
}
async function syncMaintenanceExpense(tx: DbExecutor, request: MaintenanceRequest, actor: LedgerActor = {}) {
  if (!request.vehicleId) return;
  const linkedPayables = await tx.select({ amount: payables.amount, status: payables.status }).from(payables).where(and(eq(payables.maintenanceRequestId, request.id), isNull(payables.archivedAt)));
  const linkedInvoiceTotal = maintenanceInvoiceTotal(linkedPayables);
  const amount = linkedPayables.length ? linkedInvoiceTotal : parseRiyalAmount(request.cost);
  const existing = (await tx.select().from(vehicleExpenses).where(eq(vehicleExpenses.maintenanceRequestId, request.id)).limit(1))[0];
  const vehicle = (await tx.select().from(vehicles).where(eq(vehicles.id, request.vehicleId)).limit(1))[0];
  if (!vehicle) return;
  if (linkedPayables.length) {
    await tx.update(maintenanceRequests).set({ cost: `${amount} SAR` }).where(eq(maintenanceRequests.id, request.id));
    if (existing && !existing.archivedAt) await tx.update(vehicleExpenses).set({ archivedAt: new Date(), archivedByUserId: actor.id ?? null, archivedByName: actor.name || "—" }).where(eq(vehicleExpenses.id, existing.id));
    return;
  }
  const reason = [request.type, request.reason !== "—" ? request.reason : ""].filter(Boolean).join(" · ").slice(0, 300) || "تكلفة أمر صيانة";
  const sameVehicle = existing?.vehicleId === request.vehicleId;
  const snapshot = {
    vehicleId: request.vehicleId, projectId: sameVehicle ? existing?.projectId ?? null : vehicle.projectId ?? null, projectName: sameVehicle ? existing?.projectName || vehicle.project || "—" : vehicle.project || "—", clientId: sameVehicle ? existing?.clientId ?? null : vehicle.clientId ?? null, clientName: sameVehicle ? existing?.clientName || vehicle.client || "—" : vehicle.client || "—",
    category: "صيانة" as const, amount, spentAt: request.start && request.start !== "—" ? request.start : new Date().toISOString().slice(0, 10), description: reason,
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
    if (toStage === "مغلق" && current.approvalStatus === "معتمد" && parseRiyalAmount(current.cost) <= 0) throw new Error("أدخل التكلفة الفعلية قبل إغلاق طلب الصيانة");
    if (!canAdvanceMaintenance({ from: current.workflowStage as MaintenanceStage, to: toStage, approvalStatus: current.approvalStatus })) throw new Error("لا يمكن نقل الطلب إلى هذه المرحلة قبل استكمال المرحلة الحالية أو اعتماد التكلفة");
    const status = statusForMaintenanceStage(toStage);
    await tx.update(maintenanceRequests).set({ workflowStage: toStage, status, ...(toStage === "اعتماد" ? { approvalStatus: "بانتظار الاعتماد" as const } : {}), ...(toStage === "مغلق" ? { closedAt: new Date() } : {}) }).where(eq(maintenanceRequests.id, id));
    await tx.insert(maintenanceEvents).values({ maintenanceRequestId: id, eventType: "تغيير المرحلة", fromStage: current.workflowStage, toStage, actorUserId: actor.id ?? null, actorName: actor.name || "—" });
    if (current.vehicleId) await refreshVehicleMaintenanceStatus(tx, current.vehicleId);
    return (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
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
    return (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
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
    return (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
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
    if (quoteChanged && current.approvalStatus !== "بانتظار الاعتماد") throw new Error("لا يمكن تغيير عرض السعر بعد اعتماد المالية");
    const linkedInvoices = await tx.select({ id: payables.id }).from(payables).where(and(eq(payables.maintenanceRequestId, id), isNull(payables.archivedAt)));
    if (linkedInvoices.length && (input.cost !== undefined || input.laborCost !== undefined || input.partsCost !== undefined || input.receiptName !== undefined || input.receiptUrl !== undefined)) throw new Error("التكلفة والفواتير الفعلية لهذا الطلب تُحسب من فواتير المورد المرتبطة به");
    if (linkedInvoices.length && input.vehicleId !== undefined && input.vehicleId !== current.vehicleId) throw new Error("لا يمكن تغيير مركبة طلب الصيانة بعد ربط فواتير مورد به");
    if ((input.cost !== undefined || input.laborCost !== undefined || input.partsCost !== undefined || input.receiptUrl !== undefined) && (current.approvalStatus !== "معتمد" || !["تنفيذ", "فحص بعد الإصلاح"].includes(current.workflowStage))) throw new Error("يجب اعتماد الطلب وبدء التنفيذ قبل تسجيل المصروف الفعلي");
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
    return updated ? (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null : null;
  });
}

export async function archiveMaintenanceRequest(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return false;
    const linkedInvoices = await tx.select({ id: payables.id }).from(payables).where(and(eq(payables.maintenanceRequestId, id), isNull(payables.archivedAt)));
    if (linkedInvoices.length) throw new Error("لا يمكن أرشفة طلب صيانة مرتبط بفواتير؛ ألغ الفواتير أو احتفظ بالطلب كسجل مالي");
    await tx.update(maintenanceRequests).set({ archivedAt: new Date() }).where(eq(maintenanceRequests.id, id));
    if (current.vehicleId) await refreshVehicleMaintenanceStatus(tx, current.vehicleId);
    return true;
  });
}

export async function listDocuments(): Promise<Document[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(documents).where(isNull(documents.archivedAt)).orderBy(desc(documents.createdAt));
}

export async function getDocument(id: number): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(documents).where(and(eq(documents.id, id), isNull(documents.archivedAt))).limit(1))[0] ?? null;
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

export async function createClaim(input: InsertClaim): Promise<Claim | null> {
  const db = await getDb();
  if (!db) return null;
  if (input.status !== "غير مرفوعة" && input.status !== "جديدة") return null;
  const result = await db.insert(claims).values({ ...input, paid: 0 });
  const id = Number(result[0].insertId);
  const created = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  return created[0] ?? null;
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
    await tx.update(claims).set(input).where(and(eq(claims.id, id), isNull(claims.archivedAt)));
    return (await tx.select().from(claims).where(eq(claims.id, id)).limit(1))[0] ?? null;
  });
}

export async function archiveClaim(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM claims WHERE id = ${id} FOR UPDATE`);
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

async function ensureCollectedPayment(tx: DbExecutor, contractId: number, targetCollected: number, clientId: number | null | undefined, ref: string, paidAt: string) {
  const current = (await tx.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.contractId, contractId), isNull(payments.archivedAt))).limit(1))[0];
  const gap = Math.max(0, Math.round(targetCollected) - Number(current?.total || 0));
  if (!gap) return;
  await tx.insert(payments).values({ contractId, clientId: clientId ?? null, amount: gap, paidAt: paidAt || new Date().toISOString().slice(0, 10), method: "تحويل بنكي", reference: `تحصيل العقد ${ref}`, notes: "دفعة تلقائية من خانة المحصل في العقد" });
}

export async function createContract(input: InsertContract, items: Omit<InsertContractItem, "contractId">[]): Promise<(Contract & { items: ContractItem[] }) | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    if (input.clientId && !(await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.archivedAt))).limit(1))[0]) return null;
    const vehicleIds = items.map(item => item.vehicleId).filter((value): value is number => value !== null);
    if (new Set(vehicleIds).size !== vehicleIds.length) return null;
    for (const vehicleId of vehicleIds) {
      const vehicle = (await tx.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
      if (!vehicle || (vehicle.contractId && vehicle.contractId !== 0)) return null;
      if (vehicle.clientId && input.clientId && vehicle.clientId !== input.clientId) return null;
      if (vehicle.projectId) {
        const project = (await tx.select().from(projects).where(and(eq(projects.id, vehicle.projectId), isNull(projects.archivedAt))).limit(1))[0];
        if (!project || project.contractId) return null;
        if (project.clientId && input.clientId && project.clientId !== input.clientId) return null;
      }
    }
    const result = await tx.insert(contracts).values(input);
    const id = Number(result[0].insertId);
    if (items.length) await tx.insert(contractItems).values(items.map(item => ({ ...item, contractId: id })));
    if (input.clientId) await tx.update(clients).set({ contracts: sql`${clients.contracts} + 1` }).where(eq(clients.id, input.clientId));
    await ensureCollectedPayment(tx, id, Number(input.collected || 0), input.clientId, input.ref, input.startDate);
    for (const item of items) {
      if (!item.vehicleId) continue;
      const vehicleStatus = item.coverage === "سائق فقط" ? "متاحة" : "مؤجرة";
      await tx.update(vehicles).set({ contract: input.ref, client: input.client, clientId: input.clientId ?? null, contractId: id, status: vehicleStatus }).where(eq(vehicles.id, item.vehicleId));
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
    if (nextClientId && !(await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, nextClientId), isNull(clients.archivedAt))).limit(1))[0]) return null;
    if (input.collected !== undefined) {
      const currentPayments = (await tx.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.contractId, id), isNull(payments.archivedAt))).limit(1))[0];
      if (input.collected < Number(currentPayments?.total || 0)) return null;
    }
    if (items) {
      const vehicleIds = items.map(item => item.vehicleId).filter((value): value is number => value !== null);
      if (new Set(vehicleIds).size !== vehicleIds.length) return null;
      for (const vehicleId of vehicleIds) {
        const vehicle = (await tx.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), isNull(vehicles.archivedAt))).limit(1))[0];
        if (!vehicle || (vehicle.contractId && vehicle.contractId !== id)) return null;
        if (vehicle.clientId && nextClientId && vehicle.clientId !== nextClientId) return null;
        if (vehicle.projectId) {
          const project = (await tx.select().from(projects).where(and(eq(projects.id, vehicle.projectId), isNull(projects.archivedAt))).limit(1))[0];
          if (!project || (project.contractId && project.contractId !== id) || (project.clientId && nextClientId && project.clientId !== nextClientId)) return null;
        }
      }
    }
    await tx.update(contracts).set(input).where(eq(contracts.id, id));
    if (items) {
      await tx.delete(contractItems).where(eq(contractItems.contractId, id));
      if (items.length) await tx.insert(contractItems).values(items.map(item => ({ ...item, contractId: id })));
      const nextVehicleIds = new Set(items.map(item => item.vehicleId).filter((value): value is number => Boolean(value)));
      for (const item of oldItems) if (item.vehicleId && !nextVehicleIds.has(item.vehicleId)) await tx.update(vehicles).set({ contract: "—", contractId: null, client: "—", clientId: null, status: "متاحة" }).where(eq(vehicles.id, item.vehicleId));
      const nextClient = input.client ?? current.client;
      const nextRef = input.ref ?? current.ref;
      for (const item of items) if (item.vehicleId) await tx.update(vehicles).set({ contract: nextRef, contractId: id, client: nextClient, clientId: nextClientId ?? null, status: item.coverage === "سائق فقط" ? "متاحة" : "مؤجرة" }).where(eq(vehicles.id, item.vehicleId));
    }
    if (!items && (input.ref !== undefined || input.client !== undefined || input.clientId !== undefined)) {
      await tx.update(vehicles).set({
        ...(input.ref !== undefined ? { contract: input.ref } : {}),
        ...(input.client !== undefined ? { client: input.client } : {}),
        ...(input.clientId !== undefined ? { clientId: input.clientId, client: input.client ?? current.client } : {}),
      }).where(and(eq(vehicles.contractId, id), isNull(vehicles.archivedAt)));
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
    const items = await tx.select().from(contractItems).where(eq(contractItems.contractId, id));
    for (const item of items) if (item.vehicleId) await tx.update(vehicles).set({ contract: "—", contractId: null, client: "—", clientId: null, status: "متاحة" }).where(eq(vehicles.id, item.vehicleId));
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

export async function listTasks() { const db = await getDb(); return db ? db.select().from(tasks).where(isNull(tasks.archivedAt)).orderBy(desc(tasks.createdAt)) : null; }
export async function createTask(input: typeof tasks.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(tasks).values(input); const rows = await db.select().from(tasks).where(eq(tasks.id, Number(result[0].insertId))).limit(1); return rows[0] ?? null; }
export async function updateTask(id: number, input: Partial<typeof tasks.$inferInsert>) { const db = await getDb(); if (!db) return null; await db.update(tasks).set(input).where(eq(tasks.id, id)); const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1); return rows[0] ?? null; }
export async function listNotifications() { const db = await getDb(); return db ? db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100) : null; }
export async function markNotificationRead(id: number) { const db = await getDb(); if (!db) return false; await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id)); return true; }
export async function createNotification(input: typeof notifications.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(notifications).values(input); return Number(result[0].insertId); }
export async function listPayments() { const db = await getDb(); return db ? db.select().from(payments).where(isNull(payments.archivedAt)).orderBy(desc(payments.createdAt)) : null; }

export async function listPayables(): Promise<(Omit<Payable, "receiptUrl"> & { hasReceipt: boolean; remaining: number; overdue: boolean; payments: PayablePayment[] })[] | null> {
  const db = await getDb();
  if (!db) return null;
  const [records, ledger] = await Promise.all([
    db.select().from(payables).where(isNull(payables.archivedAt)).orderBy(desc(payables.createdAt)),
    db.select().from(payablePayments).orderBy(desc(payablePayments.createdAt)),
  ]);
  const now = Date.now();
  return records.map(record => {
    const entries = ledger.filter(payment => payment.payableId === record.id);
    const remaining = Math.max(0, record.amount - record.paid);
    const due = record.dueDate !== "—" ? Date.parse(`${record.dueDate}T23:59:59`) : NaN;
    const { receiptUrl, ...safeRecord } = record;
    return { ...safeRecord, hasReceipt: Boolean(receiptUrl), remaining, overdue: remaining > 0 && record.status !== "ملغاة" && Number.isFinite(due) && due < now, payments: entries };
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
  const [documentRows, maintenanceRows, expenseRows, revenueRows, payableRows] = await Promise.all([
    db.select({ id: documents.id }).from(documents).where(and(eq(documents.fileUrl, url), isNull(documents.archivedAt))).limit(1),
    db.select({ id: maintenanceRequests.id }).from(maintenanceRequests).where(and(eq(maintenanceRequests.receiptUrl, url), isNull(maintenanceRequests.archivedAt))).limit(1),
    db.select({ id: vehicleExpenses.id }).from(vehicleExpenses).where(and(eq(vehicleExpenses.receiptUrl, url), isNull(vehicleExpenses.archivedAt))).limit(1),
    db.select({ id: vehicleRevenues.id }).from(vehicleRevenues).where(and(eq(vehicleRevenues.receiptUrl, url), isNull(vehicleRevenues.archivedAt))).limit(1),
    db.select({ vehicleId: payables.vehicleId, maintenanceRequestId: payables.maintenanceRequestId }).from(payables).where(and(eq(payables.receiptUrl, url), isNull(payables.archivedAt))).limit(1),
  ]);
  const permissions = new Set<string>();
  if (documentRows.length) permissions.add("documents");
  if (maintenanceRows.length) { permissions.add("maintenance"); permissions.add("finance"); }
  if (expenseRows.length || revenueRows.length) { permissions.add("vehicles"); permissions.add("finance"); }
  if (payableRows.length) {
    permissions.add("payables");
    if (payableRows.some(row => row.vehicleId !== null)) { permissions.add("vehicles"); permissions.add("finance"); }
    if (payableRows.some(row => row.maintenanceRequestId !== null)) { permissions.add("maintenance"); permissions.add("finance"); }
  }
  return permissions.size ? Array.from(permissions) : [];
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

async function syncLinkedMaintenanceRequest(tx: DbExecutor, requestId: number | null | undefined, actor: LedgerActor) {
  if (!requestId) return;
  const request = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, requestId), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
  if (request) await syncMaintenanceExpense(tx, request, actor);
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
    await validateMaintenancePayableLink(tx, input);
    const result = await tx.insert(payables).values({ ...input, paid: 0, status: "جديدة" });
    const id = Number(result[0].insertId);
    const payable = (await tx.select().from(payables).where(eq(payables.id, id)).limit(1))[0] ?? null;
    if (payable?.vehicleId) await syncPayableVehicleExpense(tx, payable, actor);
    await syncLinkedMaintenanceRequest(tx, payable?.maintenanceRequestId, actor);
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
    const current = (await tx.select().from(payables).where(and(eq(payables.id, id), isNull(payables.archivedAt))).limit(1))[0];
    if (!current || Number(input.amount ?? current.amount) < current.paid) return null;
    if (current.vehicleId && current.paid > 0 && (input.vehicleId !== undefined && input.vehicleId !== current.vehicleId || input.vehicleCategory !== undefined && input.vehicleCategory !== current.vehicleCategory)) throw new Error("لا يمكن نقل فاتورة باص أو تغيير فئتها بعد تسجيل دفعة عليها");
    const nextVehicleId = input.vehicleId !== undefined ? input.vehicleId : current.vehicleId;
    const nextMaintenanceRequestId = input.maintenanceRequestId !== undefined ? input.maintenanceRequestId : current.maintenanceRequestId;
    await validateMaintenancePayableLink(tx, { vehicleId: nextVehicleId, maintenanceRequestId: nextMaintenanceRequestId, vehicleCategory: input.vehicleCategory ?? current.vehicleCategory, description: input.description ?? current.description }, current);
    if (current.maintenanceRequestId && current.maintenanceRequestId !== nextMaintenanceRequestId) throw new Error("لا يمكن فك فاتورة مورد مرتبطة بطلب صيانة؛ ألغ الفاتورة واترك الربط التاريخي محفوظًا");
    await tx.update(payables).set(input).where(eq(payables.id, id));
    const updated = (await tx.select().from(payables).where(eq(payables.id, id)).limit(1))[0] ?? null;
    if (updated && (current.vehicleId || updated.vehicleId)) await syncPayableVehicleExpense(tx, updated, actor);
    await syncLinkedMaintenanceRequest(tx, current.maintenanceRequestId, actor);
    if (updated?.maintenanceRequestId !== current.maintenanceRequestId) await syncLinkedMaintenanceRequest(tx, updated?.maintenanceRequestId, actor);
    return updated;
  });
}
export async function updatePayableStatus(id: number, status: Payable["status"], actor: LedgerActor = {}): Promise<Payable | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    // Status changes (especially cancellation/approval) must not race a payment.
    await tx.execute(sql`SELECT id FROM payables WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(payables).where(and(eq(payables.id, id), isNull(payables.archivedAt))).limit(1))[0];
    if (!current) return null;
    const allowed: Record<Payable["status"], Payable["status"][]> = { "جديدة": ["معتمدة", "ملغاة"], "معتمدة": ["ملغاة"], "مدفوعة جزئيًا": ["ملغاة"], "مدفوعة": [], "ملغاة": [] };
    if (status !== current.status && !allowed[current.status].includes(status)) return null;
    if (status === "ملغاة" && current.vehicleId && current.paid > 0) throw new Error("لا يمكن إلغاء فاتورة مرتبطة بباص بعد تسجيل دفعة عليها؛ عالجها بإشعار دائن لتبقى تكلفة الباص دقيقة");
    if (status === "مدفوعة" && current.paid < current.amount) return null;
    await tx.update(payables).set({ status }).where(eq(payables.id, id));
    const updated = (await tx.select().from(payables).where(eq(payables.id, id)).limit(1))[0] ?? null;
    if (updated?.vehicleId) await syncPayableVehicleExpense(tx, updated, actor);
    await syncLinkedMaintenanceRequest(tx, updated?.maintenanceRequestId, actor);
    return updated;
  });
}
export async function registerPayablePayment(input: InsertPayablePayment): Promise<PayablePayment | null> {
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
    return (await tx.select().from(payablePayments).where(eq(payablePayments.id, id)).limit(1))[0] ?? null;
  });
}

export async function getCompanyReport(from: string, to: string) {
  const db = await getDb();
  if (!db) return null;
  const [vehicleRows, contractRows, claimRows, incomingRows, payableRows, outgoingRows, maintenanceRows, projectRows, documentRows, employeeRows, driverRows, vehicleExpenseRows, vehicleRevenueRows, clientRows, contractItemRows] = await Promise.all([
    db.select().from(vehicles).where(isNull(vehicles.archivedAt)),
    db.select().from(contracts).where(isNull(contracts.archivedAt)),
    db.select().from(claims).where(isNull(claims.archivedAt)),
    db.select().from(payments).where(isNull(payments.archivedAt)),
    db.select().from(payables).where(isNull(payables.archivedAt)),
    db.select().from(payablePayments),
    db.select().from(maintenanceRequests).where(isNull(maintenanceRequests.archivedAt)),
    db.select().from(projects).where(isNull(projects.archivedAt)),
    db.select().from(documents).where(isNull(documents.archivedAt)),
    db.select().from(employees).where(isNull(employees.archivedAt)),
    db.select().from(drivers).where(isNull(drivers.archivedAt)),
    db.select().from(vehicleExpenses).where(isNull(vehicleExpenses.archivedAt)),
    db.select().from(vehicleRevenues).where(isNull(vehicleRevenues.archivedAt)),
    db.select().from(clients).where(isNull(clients.archivedAt)),
    db.select().from(contractItems),
  ]);
  const inRange = (value: unknown) => { const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10); return date >= from && date <= to; };
  const periodClaims = claimRows.filter(row => inRange(row.submittedAt));
  const periodContracts = contractRows.filter(row => inRange(row.startDate));
  const periodIncoming = incomingRows.filter(row => inRange(row.paidAt));
  const periodOutgoing = outgoingRows.filter(row => inRange(row.paidAt));
  const periodMaintenance = maintenanceRows.filter(row => inRange(row.start));
  const periodProjects = projectRows.filter(row => inRange(row.startDate));
  const periodDocuments = documentRows.filter(row => inRange(row.expiry));
  const postedPayableIds = new Set(payableRows.filter(row => isPayableExpensePosted(row.status)).map(row => row.id));
  const periodVehicleExpenses = vehicleExpenseRows.filter(row => inRange(row.spentAt) && (row.payableId === null || postedPayableIds.has(row.payableId)));
  const paymentById = new Map(incomingRows.map(row => [row.id, row]));
  const periodVehicleRevenues = vehicleRevenueRows.filter(row => { const payment = paymentById.get(row.paymentId); return payment ? inRange(payment.paidAt) : false; });
  const outstandingClaims = claimRows.filter(row => !["تم صرفها", "مرفوضة", "ملغاة"].includes(row.status));
  const activePayables = payableRows.filter(row => row.status !== "ملغاة");
  const costNumber = (value: string) => Number(value.replace(/[^0-9.]/g, "")) || 0;
  const dateValue = (value: string) => value && value !== "—" ? Date.parse(`${value.slice(0,10)}T23:59:59`) : NaN;
  const now = Date.now(); const soon = now + 30 * 86400000;
  const activeMaintenance = maintenanceRows.filter(row => row.status !== "مكتمل");
  const vehiclesById = new Map(vehicleRows.map(row => [row.id, row]));
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
  for (const bus of vehicleRows) if (inRange(bus.purchaseDate) && !vehicleProfitabilityIds.has(bus.id)) vehicleProfitabilityBase.push({ id: bus.id, name: `${bus.plate} · ${bus.brand} ${bus.model}`, expense: 0, revenue: 0, netOperatingResult: 0, busCount: 1 });
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
      receivableOutstanding: outstandingClaims.reduce((sum, row) => sum + Math.max(0, row.amount - row.paid), 0),
      unpaidClaims: outstandingClaims.filter(row => row.amount > row.paid).length,
      overdueClaims: outstandingClaims.filter(row => { const due = dateValue(row.due); return Number.isFinite(due) && due < now && row.amount > row.paid; }).length,
      payablesOutstanding: activePayables.reduce((sum, row) => sum + Math.max(0, row.amount - row.paid), 0),
      outgoingInPeriod: periodOutgoing.reduce((sum, row) => sum + row.amount, 0),
      vehicleCostsInPeriod,
      allocatedVehicleRevenueInPeriod,
      fleetVehicleNetInPeriod: allocatedVehicleRevenueInPeriod - vehicleCostsInPeriod - vehicleProfitability.reduce((sum,row) => sum + row.purchaseInPeriod, 0),
      overduePayables: activePayables.filter(row => { const due = dateValue(row.dueDate); return Number.isFinite(due) && due < now && row.amount > row.paid; }).length,
    },
    maintenance: {
      openedInPeriod: periodMaintenance.length,
      openNow: activeMaintenance.length,
      completedInPeriod: periodMaintenance.filter(row => row.status === "مكتمل").length,
      costInPeriod: periodMaintenance.reduce((sum, row) => sum + costNumber(row.cost), 0),
      overdueNow: activeMaintenance.filter(row => { const due = dateValue(row.expectedReturn || row.due); return Number.isFinite(due) && due < now; }).length,
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
      expiredNow: documentRows.filter(row => { const expiry = dateValue(row.expiry); return Number.isFinite(expiry) && expiry < now; }).length,
      expiringNext30Days: documentRows.filter(row => { const expiry = dateValue(row.expiry); return Number.isFinite(expiry) && expiry >= now && expiry <= soon; }).length,
    },
    people: {
      employees: employeeRows.length,
      activeEmployees: employeeRows.filter(row => row.status === "نشط").length,
      drivers: driverRows.length,
      availableDrivers: driverRows.filter(row => row.status === "متاح").length,
    },
    details: {
      claims: periodClaims.map(row => ({ id: row.id, ref: row.ref, client: row.client, status: row.status, amount: row.amount, paid: row.paid, due: row.due })),
      contracts: periodContracts.map(row => ({ id: row.id, ref: row.ref, client: row.client, status: row.status, total: row.total, collected: row.collected, startDate: row.startDate, expiry: row.expiry })),
      payables: activePayables.map(row => ({ id: row.id, ref: row.ref, supplier: row.supplier, status: row.status, amount: row.amount, paid: row.paid, remaining: Math.max(0, row.amount - row.paid), dueDate: row.dueDate })),
      maintenance: periodMaintenance.map(row => ({ id: row.id, ref: row.ref, vehicle: row.vehicle, status: row.status, cost: row.cost, start: row.start, expectedReturn: row.expectedReturn })),
      vehicleProfitability,
      projectProfitability,
      clientProfitability,
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
async function validatePaymentReferences(db: DbExecutor, input: { contractId?: number | null; claimId?: number | null; clientId?: number | null; amount?: number }) {
  if (!input.contractId && !input.claimId && !input.clientId) throw new Error("يجب ربط الدفعة بعقد أو مطالبة أو عميل");
  if (input.contractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!contract) throw new Error("العقد المرتبط بالدفعة غير موجود");
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
export async function createPayment(input: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await lockPaymentReferences(tx, input);
    await validatePaymentReferences(tx, input);
    const result = await tx.insert(payments).values(input);
    const paymentId = Number(result[0].insertId);
    await applyPaymentImpact(tx, input, 1);
    return (await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1))[0] ?? null;
  });
}
export async function updatePayment(id: number, input: Partial<typeof payments.$inferInsert>) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`);
    const current = (await tx.select().from(payments).where(and(eq(payments.id, id), isNull(payments.archivedAt))).limit(1))[0];
    if (!current) return null;
    await lockPaymentReferences(tx, current, input);
    const next = { ...current, ...input };
    const allocations = await tx.select({ amount: vehicleRevenues.amount }).from(vehicleRevenues).where(and(eq(vehicleRevenues.paymentId, id), isNull(vehicleRevenues.archivedAt)));
    const allocated = allocations.reduce((total, row) => total + Number(row.amount || 0), 0);
    if (input.amount !== undefined && Number(next.amount) < allocated) throw new Error(`لا يمكن خفض الدفعة عن الإيرادات المخصصة للباصات (${allocated} SAR)`);
    if (allocations.length && ((input.contractId !== undefined && input.contractId !== current.contractId) || (input.claimId !== undefined && input.claimId !== current.claimId))) throw new Error("لا يمكن نقل الدفعة إلى عقد أو مطالبة أخرى بعد تخصيص جزء منها لباص");
    await applyPaymentImpact(tx, current, -1);
    await validatePaymentReferences(tx, next);
    await tx.update(payments).set(input).where(eq(payments.id, id));
    await applyPaymentImpact(tx, next, 1);
    return (await tx.select().from(payments).where(eq(payments.id, id)).limit(1))[0] ?? null;
  });
}
export async function archivePayment(id: number) {
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
    return true;
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
export async function listAuditLogs() { const db = await getDb(); return db ? db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200) : null; }
export async function createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLog | null> { const db = await getDb(); if (!db) return null; const result = await db.insert(auditLogs).values(input); const rows = await db.select().from(auditLogs).where(eq(auditLogs.id, Number(result[0].insertId))).limit(1); return rows[0] ?? null; }
