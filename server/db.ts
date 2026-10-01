import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { AuditLog, Claim, Client, Contract, ContractItem, Document, Driver, InsertClaim, InsertClient, InsertContract, InsertContractItem, InsertDocument, InsertDriver, InsertMaintenanceRequest, InsertUser, InsertVehicle, MaintenanceRequest, User, Vehicle, auditLogs, claims, clientRepresentatives, clients, contractItems, contracts, documents, drivers, maintenanceRequests, notifications, payments, settingCatalog, tasks, users, vehicles } from "../drizzle/schema";
import { ENV } from './_core/env';

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
      _db = drizzle(process.env.DATABASE_URL);
      _authSchemaReady = ensureAuthSchema(_db).catch(error => {
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

export async function createVehicle(input: InsertVehicle): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(vehicles).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return created[0] ?? null;
}

export async function updateVehicle(id: number, input: Partial<InsertVehicle>): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(vehicles).set(input).where(and(eq(vehicles.id, id), isNull(vehicles.archivedAt)));
  const updated = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return updated[0] ?? null;
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

export async function listMaintenanceRequests(): Promise<MaintenanceRequest[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(maintenanceRequests).where(isNull(maintenanceRequests.archivedAt)).orderBy(desc(maintenanceRequests.createdAt));
}

export async function createMaintenanceRequest(input: InsertMaintenanceRequest): Promise<MaintenanceRequest | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const result = await tx.insert(maintenanceRequests).values(input);
    const id = Number(result[0].insertId);
    if (input.vehicleId && input.status !== "مكتمل") await tx.update(vehicles).set({ status: "في الصيانة" }).where(eq(vehicles.id, input.vehicleId));
    return (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
  });
}

export async function updateMaintenanceRequest(id: number, input: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return null;
    await tx.update(maintenanceRequests).set(input).where(eq(maintenanceRequests.id, id));
    const vehicleId = input.vehicleId ?? current.vehicleId;
    if (vehicleId) await tx.update(vehicles).set({ status: (input.status ?? current.status) === "مكتمل" ? "متاحة" : "في الصيانة" }).where(eq(vehicles.id, vehicleId));
    if (input.vehicleId && current.vehicleId && input.vehicleId !== current.vehicleId) await tx.update(vehicles).set({ status: "متاحة" }).where(eq(vehicles.id, current.vehicleId));
    return (await tx.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1))[0] ?? null;
  });
}

export async function archiveMaintenanceRequest(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const current = (await tx.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.id, id), isNull(maintenanceRequests.archivedAt))).limit(1))[0];
    if (!current) return false;
    await tx.update(maintenanceRequests).set({ archivedAt: new Date() }).where(eq(maintenanceRequests.id, id));
    if (current.vehicleId) await tx.update(vehicles).set({ status: "متاحة" }).where(eq(vehicles.id, current.vehicleId));
    return true;
  });
}

export async function listDocuments(): Promise<Document[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(documents).where(isNull(documents.archivedAt)).orderBy(desc(documents.createdAt));
}

export async function createDocument(input: InsertDocument): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(documents).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return created[0] ?? null;
}

export async function updateDocument(id: number, input: Partial<InsertDocument>): Promise<Document | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(documents).set(input).where(and(eq(documents.id, id), isNull(documents.archivedAt)));
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
  await db.update(clients).set({ archivedAt: new Date() }).where(eq(clients.id, id));
  return true;
}

export async function listClaims(): Promise<Claim[] | null> {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(claims).where(isNull(claims.archivedAt)).orderBy(desc(claims.createdAt));
}

export async function createClaim(input: InsertClaim): Promise<Claim | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(claims).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  return created[0] ?? null;
}

export async function updateClaim(id: number, input: Partial<InsertClaim>): Promise<Claim | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(claims).set(input).where(and(eq(claims.id, id), isNull(claims.archivedAt)));
  const updated = await db.select().from(claims).where(eq(claims.id, id)).limit(1);
  return updated[0] ?? null;
}

export async function archiveClaim(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(claims).set({ archivedAt: new Date() }).where(eq(claims.id, id));
  return true;
}

export async function listContracts(): Promise<Array<Contract & { items: ContractItem[] }> | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(contracts).where(isNull(contracts.archivedAt)).orderBy(desc(contracts.createdAt));
  const items = await db.select().from(contractItems);
  return rows.map(contract => ({ ...contract, items: items.filter(item => item.contractId === contract.id) }));
}

export async function createContract(input: InsertContract, items: Omit<InsertContractItem, "contractId">[]): Promise<(Contract & { items: ContractItem[] }) | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const result = await tx.insert(contracts).values(input);
    const id = Number(result[0].insertId);
    if (items.length) await tx.insert(contractItems).values(items.map(item => ({ ...item, contractId: id })));
    if (input.clientId) await tx.update(clients).set({ contracts: sql`${clients.contracts} + 1` }).where(eq(clients.id, input.clientId));
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
    const current = (await tx.select().from(contracts).where(and(eq(contracts.id, id), isNull(contracts.archivedAt))).limit(1))[0];
    if (!current) return null;
    const oldItems = await tx.select().from(contractItems).where(eq(contractItems.contractId, id));
    await tx.update(contracts).set(input).where(eq(contracts.id, id));
    if (items) {
      await tx.delete(contractItems).where(eq(contractItems.contractId, id));
      if (items.length) await tx.insert(contractItems).values(items.map(item => ({ ...item, contractId: id })));
      const nextVehicleIds = new Set(items.map(item => item.vehicleId).filter((value): value is number => Boolean(value)));
      for (const item of oldItems) if (item.vehicleId && !nextVehicleIds.has(item.vehicleId)) await tx.update(vehicles).set({ contract: "—", contractId: null, client: "—", clientId: null, status: "متاحة" }).where(eq(vehicles.id, item.vehicleId));
      const nextClient = input.client ?? current.client;
      const nextClientId = input.clientId ?? current.clientId;
      for (const item of items) if (item.vehicleId) await tx.update(vehicles).set({ contract: current.ref, contractId: id, client: nextClient, clientId: nextClientId ?? null, status: item.coverage === "سائق فقط" ? "متاحة" : "مؤجرة" }).where(eq(vehicles.id, item.vehicleId));
    }
    if (input.clientId && input.clientId !== current.clientId) {
      if (current.clientId) await tx.update(clients).set({ contracts: sql`GREATEST(0, ${clients.contracts} - 1)` }).where(eq(clients.id, current.clientId));
      await tx.update(clients).set({ contracts: sql`${clients.contracts} + 1` }).where(eq(clients.id, input.clientId));
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
  await db.update(contracts).set({ status }).where(and(eq(contracts.id, id), isNull(contracts.archivedAt)));
  const updated = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
  return updated[0] ?? null;
}

export async function listTasks() { const db = await getDb(); return db ? db.select().from(tasks).where(isNull(tasks.archivedAt)).orderBy(desc(tasks.createdAt)) : null; }
export async function createTask(input: typeof tasks.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(tasks).values(input); const rows = await db.select().from(tasks).where(eq(tasks.id, Number(result[0].insertId))).limit(1); return rows[0] ?? null; }
export async function updateTask(id: number, input: Partial<typeof tasks.$inferInsert>) { const db = await getDb(); if (!db) return null; await db.update(tasks).set(input).where(eq(tasks.id, id)); const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1); return rows[0] ?? null; }
export async function listNotifications() { const db = await getDb(); return db ? db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100) : null; }
export async function markNotificationRead(id: number) { const db = await getDb(); if (!db) return false; await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id)); return true; }
export async function createNotification(input: typeof notifications.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(notifications).values(input); return Number(result[0].insertId); }
export async function listPayments() { const db = await getDb(); return db ? db.select().from(payments).where(isNull(payments.archivedAt)).orderBy(desc(payments.createdAt)) : null; }

type DbExecutor = any;
async function validatePaymentReferences(db: DbExecutor, input: { contractId?: number | null; claimId?: number | null; clientId?: number | null; amount?: number }) {
  if (!input.contractId && !input.claimId && !input.clientId) throw new Error("يجب ربط الدفعة بعقد أو مطالبة أو عميل");
  if (input.contractId) {
    const contract = (await db.select().from(contracts).where(and(eq(contracts.id, input.contractId), isNull(contracts.archivedAt))).limit(1))[0];
    if (!contract) throw new Error("العقد المرتبط بالدفعة غير موجود");
  }
  if (input.claimId) {
    const claim = (await db.select().from(claims).where(and(eq(claims.id, input.claimId), isNull(claims.archivedAt))).limit(1))[0];
    if (!claim) throw new Error("المطالبة المرتبطة بالدفعة غير موجودة");
    if (input.contractId && claim.contractId && input.contractId !== claim.contractId) throw new Error("المطالبة لا تتبع العقد المحدد");
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
    const claim = (await db.select().from(claims).where(and(eq(claims.id, input.claimId), isNull(claims.archivedAt))).limit(1))[0];
    if (claim) {
      const paid = Math.max(0, claim.paid + amount);
      await db.update(claims).set({ paid, status: paid >= claim.amount ? "مدفوعة" : "مستحقة" }).where(eq(claims.id, input.claimId));
    }
  }
}
export async function createPayment(input: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
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
    const current = (await tx.select().from(payments).where(and(eq(payments.id, id), isNull(payments.archivedAt))).limit(1))[0];
    if (!current) return null;
    const next = { ...current, ...input };
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
    const current = (await tx.select().from(payments).where(and(eq(payments.id, id), isNull(payments.archivedAt))).limit(1))[0];
    if (!current) return false;
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
export async function countAdmins() { const db = await getDb(); if (!db) return null; const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")); return rows.length; }
export async function updateUserRole(id: number, role: "user" | "admin") { const db = await getDb(); if (!db) return null; await db.update(users).set({ role }).where(eq(users.id, id)); return (await db.select({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, permissions: users.permissions, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, id)).limit(1))[0] ?? null; }
export async function listSettings(category?: string) { const db = await getDb(); if (!db) return null; return category ? db.select().from(settingCatalog).where(eq(settingCatalog.category, category)) : db.select().from(settingCatalog); }
export async function upsertSetting(input: typeof settingCatalog.$inferInsert) { const db = await getDb(); if (!db) return null; const result = await db.insert(settingCatalog).values(input); return Number(result[0].insertId); }
export async function deleteSetting(id: number) { const db = await getDb(); if (!db) return false; await db.delete(settingCatalog).where(eq(settingCatalog.id, id)); return true; }
export async function listAuditLogs() { const db = await getDb(); return db ? db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200) : null; }
export async function createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLog | null> { const db = await getDb(); if (!db) return null; const result = await db.insert(auditLogs).values(input); const rows = await db.select().from(auditLogs).where(eq(auditLogs.id, Number(result[0].insertId))).limit(1); return rows[0] ?? null; }
