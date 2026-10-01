import { int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  plate: varchar("plate", { length: 32 }).notNull().unique(),
  brand: varchar("brand", { length: 80 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  year: varchar("year", { length: 8 }).notNull(),
  color: varchar("color", { length: 48 }).notNull(),
  mileage: varchar("mileage", { length: 32 }).notNull(),
  driverId: int("driverId"),
  driver: varchar("driver", { length: 120 }).notNull().default("—"),
  status: mysqlEnum("status", ["متاحة", "مؤجرة", "مشغولة", "في الصيانة", "قيد التجهيز"]).notNull().default("متاحة"),
  clientId: int("clientId"),
  client: varchar("client", { length: 160 }).notNull().default("—"),
  contractId: int("contractId"),
  contract: varchar("contract", { length: 80 }).notNull().default("—"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  ref: varchar("ref", { length: 40 }).notNull().unique(),
  client: varchar("client", { length: 160 }).notNull(),
  clientId: int("clientId"),
  type: varchar("type", { length: 120 }).notNull(),
  startDate: varchar("startDate", { length: 32 }).notNull(),
  expiry: varchar("expiry", { length: 32 }).notNull(),
  total: int("total").notNull().default(0),
  collected: int("collected").notNull().default(0),
  status: mysqlEnum("status", ["قائم", "مكتمل", "عرض سعر", "ملغي"]).notNull().default("قائم"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const contractItems = mysqlTable("contract_items", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  vehicleId: int("vehicleId"),
  vehiclePlate: varchar("vehiclePlate", { length: 32 }).notNull().default("—"),
  quantity: int("quantity").notNull().default(1),
  driver: varchar("driver", { length: 120 }).notNull().default("—"),
  coverage: mysqlEnum("coverage", ["مركبة وسائق", "سائق فقط", "مركبة فقط"]).notNull().default("مركبة وسائق"),
  description: varchar("description", { length: 240 }).notNull().default("خدمة تشغيل"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const claims = mysqlTable("claims", {
  id: int("id").autoincrement().primaryKey(),
  ref: varchar("ref", { length: 40 }).notNull().unique(),
  client: varchar("client", { length: 160 }).notNull(),
  clientId: int("clientId"),
  contract: varchar("contract", { length: 40 }).notNull(),
  contractId: int("contractId"),
  amount: int("amount").notNull().default(0),
  due: varchar("due", { length: 32 }).notNull().default("—"),
  paid: int("paid").notNull().default(0),
  status: mysqlEnum("status", ["مستحقة", "مدفوعة", "متأخرة", "ملغاة"]).notNull().default("مستحقة"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default("—"),
  idNo: varchar("idNo", { length: 64 }).notNull().default("—"),
  status: mysqlEnum("status", ["متاح", "مشغول", "موقوف"]).notNull().default("متاح"),
  vehicleId: int("vehicleId"),
  vehicle: varchar("vehicle", { length: 32 }).notNull().default("—"),
  license: varchar("license", { length: 80 }).notNull().default("خصوصي"),
  renewal: varchar("renewal", { length: 32 }).notNull().default("—"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const maintenanceRequests = mysqlTable("maintenance_requests", {
  id: int("id").autoincrement().primaryKey(),
  ref: varchar("ref", { length: 40 }).notNull().unique(),
  vehicleId: int("vehicleId"),
  vehicle: varchar("vehicle", { length: 80 }).notNull(),
  type: varchar("type", { length: 160 }).notNull(),
  manager: varchar("manager", { length: 160 }).notNull().default("—"),
  start: varchar("start", { length: 32 }).notNull().default("—"),
  due: varchar("due", { length: 32 }).notNull().default("—"),
  status: mysqlEnum("status", ["جديد", "جاري العمل", "مكتمل", "متوقف"]).notNull().default("جديد"),
  cost: varchar("cost", { length: 40 }).notNull().default("0 ر.س"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  entityId: int("entityId"),
  entity: varchar("entity", { length: 160 }).notNull().default("—"),
  type: varchar("type", { length: 80 }).notNull().default("مركبة"),
  expiry: varchar("expiry", { length: 32 }).notNull().default("—"),
  status: mysqlEnum("status", ["ساري", "قريبًا", "متأخر", "منتهي"]).notNull().default("ساري"),
  owner: varchar("owner", { length: 160 }).notNull().default("—"),
  fileName: varchar("fileName", { length: 255 }),
  fileUrl: mediumtext("fileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 120 }).notNull().default("—"),
  vat: varchar("vat", { length: 80 }).notNull().default("—"),
  commercial: varchar("commercial", { length: 80 }).notNull().default("—"),
  contact: varchar("contact", { length: 160 }).notNull().default("—"),
  phone: varchar("phone", { length: 40 }).notNull().default("—"),
  contracts: int("contracts").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const clientRepresentatives = mysqlTable("client_representatives", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default("—"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId"),
  claimId: int("claimId"),
  clientId: int("clientId"),
  amount: int("amount").notNull().default(0),
  paidAt: varchar("paidAt", { length: 32 }).notNull().default("—"),
  method: varchar("method", { length: 80 }).notNull().default("تحويل بنكي"),
  reference: varchar("reference", { length: 80 }).notNull().default("—"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  dueAt: varchar("dueAt", { length: 32 }).notNull().default("—"),
  status: mysqlEnum("status", ["مفتوحة", "مكتملة", "ملغاة"]).notNull().default("مفتوحة"),
  assignee: varchar("assignee", { length: 160 }).notNull().default("—"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 60 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 60 }),
  entityId: int("entityId"),
  severity: mysqlEnum("severity", ["معلومة", "تنبيه", "حرج"]).notNull().default("معلومة"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const settingCatalog = mysqlTable("setting_catalog", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 80 }).notNull(),
  key: varchar("key", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId"),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;
export type ContractItem = typeof contractItems.$inferSelect;
export type InsertContractItem = typeof contractItems.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type InsertClaim = typeof claims.$inferInsert;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type InsertMaintenanceRequest = typeof maintenanceRequests.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type ClientRepresentative = typeof clientRepresentatives.$inferSelect;
export type InsertClientRepresentative = typeof clientRepresentatives.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type SettingCatalog = typeof settingCatalog.$inferSelect;
export type InsertSettingCatalog = typeof settingCatalog.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
