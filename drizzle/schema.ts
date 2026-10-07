import { sql } from "drizzle-orm";
import { index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  username: varchar("username", { length: 80 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  passwordHash: text("passwordHash"),
  isActive: int("isActive").default(1).notNull(),
  permissions: text("permissions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ref: varchar("ref", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  clientId: int("clientId"),
  client: varchar("client", { length: 200 }).notNull().default("—"),
  contractId: int("contractId"),
  contract: varchar("contract", { length: 40 }).notNull().default("—"),
  managerEmployeeId: int("managerEmployeeId"),
  manager: varchar("manager", { length: 160 }).notNull().default("—"),
  startDate: varchar("startDate", { length: 32 }).notNull().default("—"),
  endDate: varchar("endDate", { length: 32 }).notNull().default("—"),
  requiredVehicles: int("requiredVehicles").notNull().default(0),
  status: mysqlEnum("status", ["مخطط", "نشط", "موقوف", "مكتمل", "ملغي"]).notNull().default("مخطط"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  plate: varchar("plate", { length: 32 }).notNull(),
  brand: varchar("brand", { length: 80 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  year: varchar("year", { length: 8 }).notNull(),
  color: varchar("color", { length: 48 }).notNull(),
  mileage: varchar("mileage", { length: 32 }).notNull(),
  purchasePrice: int("purchasePrice").notNull().default(0),
  purchaseDate: varchar("purchaseDate", { length: 32 }).notNull().default("—"),
  inServiceDate: varchar("inServiceDate", { length: 32 }).notNull().default("—"),
  projectId: int("projectId"),
  project: varchar("project", { length: 200 }).notNull().default("—"),
  driverId: int("driverId"),
  driver: varchar("driver", { length: 120 }).notNull().default("—"),
  employeeId: int("employeeId"),
  employee: varchar("employee", { length: 160 }).notNull().default("—"),
  status: mysqlEnum("status", ["متاحة", "مؤجرة", "مشغولة", "في الصيانة", "قيد التجهيز", "متوقفة"]).notNull().default("متاحة"),
  clientId: int("clientId"),
  client: varchar("client", { length: 160 }).notNull().default("—"),
  contractId: int("contractId"),
  contract: varchar("contract", { length: 80 }).notNull().default("—"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
  activePlate: varchar("activePlate", { length: 32 }).generatedAlwaysAs(sql`CASE WHEN archivedAt IS NULL THEN plate ELSE NULL END`, { mode: "stored" }),
}, (table) => [uniqueIndex("vehicles_active_plate_unique").on(table.activePlate)]);

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
  submittedAt: varchar("submittedAt", { length: 32 }).notNull().default("—"),
  followUpAt: varchar("followUpAt", { length: 32 }).notNull().default("—"),
  notes: text("notes"),
  status: mysqlEnum("status", ["غير مرفوعة", "جديدة", "تحت الإجراء", "تم اعتمادها", "تم صرفها", "مرفوضة", "ملغاة"]).notNull().default("جديدة"),
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

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  employeeNo: varchar("employeeNo", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  nationalId: varchar("nationalId", { length: 64 }).notNull().default("—"),
  phone: varchar("phone", { length: 40 }).notNull().default("—"),
  email: varchar("email", { length: 320 }).notNull().default("—"),
  department: varchar("department", { length: 120 }).notNull().default("الإدارة"),
  jobTitle: varchar("jobTitle", { length: 120 }).notNull().default("موظف"),
  hireDate: varchar("hireDate", { length: 32 }).notNull().default("—"),
  status: mysqlEnum("status", ["نشط", "إجازة", "موقوف", "منتهي الخدمة"]).notNull().default("نشط"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const maintenanceRequests = mysqlTable("maintenance_requests", {
  id: int("id").autoincrement().primaryKey(),
  ref: varchar("ref", { length: 40 }).notNull().unique(),
  vehicleId: int("vehicleId"),
  vehicleStatusBefore: mysqlEnum("vehicleStatusBefore", ["متاحة", "مؤجرة", "مشغولة", "في الصيانة", "قيد التجهيز", "متوقفة"]),
  vehicle: varchar("vehicle", { length: 80 }).notNull(),
  type: varchar("type", { length: 160 }).notNull(),
  priority: mysqlEnum("priority", ["طارئ", "عاجل", "متوسط", "عادي"]).notNull().default("متوسط"),
  workflowStage: mysqlEnum("workflowStage", ["بلاغ", "فحص", "تشخيص", "تقدير تكلفة", "اعتماد", "تنفيذ", "فحص بعد الإصلاح", "مغلق", "مرفوض"]).notNull().default("بلاغ"),
  reportedBy: varchar("reportedBy", { length: 160 }).notNull().default("—"),
  reason: varchar("reason", { length: 500 }).notNull().default("—"),
  diagnosis: text("diagnosis"),
  workDone: text("workDone"),
  parts: text("parts"),
  technician: varchar("technician", { length: 160 }).notNull().default("—"),
  workshop: varchar("workshop", { length: 200 }).notNull().default("—"),
  manager: varchar("manager", { length: 160 }).notNull().default("—"),
  start: varchar("start", { length: 32 }).notNull().default("—"),
  due: varchar("due", { length: 32 }).notNull().default("—"),
  expectedReturn: varchar("expectedReturn", { length: 32 }).notNull().default("—"),
  status: mysqlEnum("status", ["جديد", "جاري العمل", "بانتظار الفحص", "مكتمل", "متوقف"]).notNull().default("جديد"),
  cost: varchar("cost", { length: 40 }).notNull().default("0 ر.س"),
  estimatedCost: int("estimatedCost").notNull().default(0),
  quotedPartsCost: int("quotedPartsCost").notNull().default(0),
  quoteName: varchar("quoteName", { length: 255 }),
  quoteUrl: mediumtext("quoteUrl"),
  laborCost: int("laborCost").notNull().default(0),
  partsCost: int("partsCost").notNull().default(0),
  approvalStatus: mysqlEnum("approvalStatus", ["غير مطلوب", "بانتظار الاعتماد", "معتمد", "مرفوض"]).notNull().default("غير مطلوب"),
  approvedByUserId: int("approvedByUserId"),
  approvedByName: varchar("approvedByName", { length: 160 }),
  approvedAt: timestamp("approvedAt"),
  approvalNotes: text("approvalNotes"),
  fundingType: mysqlEnum("fundingType", ["عهدة", "تحويل مباشر"]),
  fundingReference: varchar("fundingReference", { length: 120 }),
  fundingAmount: int("fundingAmount"),
  fundingRecipient: varchar("fundingRecipient", { length: 160 }),
  advanceStatus: mysqlEnum("advanceStatus", ["مفتوحة", "مسواة"]),
  advanceSettledAt: timestamp("advanceSettledAt"),
  advanceSettlementReference: varchar("advanceSettlementReference", { length: 120 }),
  fundingIssuedAt: timestamp("fundingIssuedAt"),
  fundingIssuedByUserId: int("fundingIssuedByUserId"),
  fundingIssuedByName: varchar("fundingIssuedByName", { length: 160 }),
  warrantyUntil: varchar("warrantyUntil", { length: 32 }).notNull().default("—"),
  closedAt: timestamp("closedAt"),
  receiptName: varchar("receiptName", { length: 255 }),
  receiptUrl: mediumtext("receiptUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const maintenanceEvents = mysqlTable("maintenance_events", {
  id: int("id").autoincrement().primaryKey(),
  maintenanceRequestId: int("maintenanceRequestId").notNull(),
  eventType: varchar("eventType", { length: 60 }).notNull(),
  fromStage: varchar("fromStage", { length: 80 }),
  toStage: varchar("toStage", { length: 80 }),
  details: text("details"),
  actorUserId: int("actorUserId"),
  actorName: varchar("actorName", { length: 160 }).notNull().default("—"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  entityId: int("entityId"),
  entity: varchar("entity", { length: 160 }).notNull().default("—"),
  entityType: varchar("entityType", { length: 40 }).notNull().default("مركبة"),
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

export const vehicleExpenses = mysqlTable("vehicle_expenses", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicleId").notNull(),
  maintenanceRequestId: int("maintenanceRequestId").unique(),
  payableId: int("payableId").unique(),
  projectId: int("projectId"),
  projectName: varchar("projectName", { length: 200 }).notNull().default("—"),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 200 }).notNull().default("—"),
  category: mysqlEnum("category", ["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"]).notNull(),
  amount: int("amount").notNull().default(0),
  spentAt: varchar("spentAt", { length: 32 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  vendor: varchar("vendor", { length: 160 }).notNull().default("—"),
  receiptName: varchar("receiptName", { length: 255 }),
  receiptUrl: mediumtext("receiptUrl"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdByName: varchar("createdByName", { length: 160 }).notNull().default("—"),
  updatedByUserId: int("updatedByUserId"),
  updatedByName: varchar("updatedByName", { length: 160 }).notNull().default("—"),
  archivedByUserId: int("archivedByUserId"),
  archivedByName: varchar("archivedByName", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const vehicleRevenues = mysqlTable("vehicle_revenues", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicleId").notNull(),
  paymentId: int("paymentId").notNull(),
  projectId: int("projectId"),
  projectName: varchar("projectName", { length: 200 }).notNull().default("—"),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 200 }).notNull().default("—"),
  amount: int("amount").notNull().default(0),
  receiptName: varchar("receiptName", { length: 255 }),
  receiptUrl: mediumtext("receiptUrl"),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdByName: varchar("createdByName", { length: 160 }).notNull().default("—"),
  archivedByUserId: int("archivedByUserId"),
  archivedByName: varchar("archivedByName", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  archivedAt: timestamp("archivedAt"),
});

export const payables = mysqlTable("payables", {
  id: int("id").autoincrement().primaryKey(),
  ref: varchar("ref", { length: 40 }).notNull().unique(),
  supplier: varchar("supplier", { length: 200 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  amount: int("amount").notNull().default(0),
  paid: int("paid").notNull().default(0),
  issueDate: varchar("issueDate", { length: 32 }).notNull().default("—"),
  dueDate: varchar("dueDate", { length: 32 }).notNull().default("—"),
  status: mysqlEnum("status", ["جديدة", "معتمدة", "مدفوعة جزئيًا", "مدفوعة", "ملغاة"]).notNull().default("جديدة"),
  notes: text("notes"),
  vehicleId: int("vehicleId"),
  maintenanceRequestId: int("maintenanceRequestId"),
  vehicleCategory: mysqlEnum("vehicleCategory", ["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"]),
  receiptName: varchar("receiptName", { length: 255 }),
  receiptUrl: mediumtext("receiptUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  archivedAt: timestamp("archivedAt"),
}, (table) => [index("payables_maintenance_request_idx").on(table.maintenanceRequestId)]);

export const payablePayments = mysqlTable("payable_payments", {
  id: int("id").autoincrement().primaryKey(),
  payableId: int("payableId").notNull(),
  amount: int("amount").notNull(),
  paidAt: varchar("paidAt", { length: 32 }).notNull(),
  method: varchar("method", { length: 80 }).notNull().default("تحويل بنكي"),
  reference: varchar("reference", { length: 80 }).notNull().default("—"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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

export const notificationReads = mysqlTable("notification_reads", {
  id: int("id").autoincrement().primaryKey(),
  notificationId: int("notificationId").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("readAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("notification_reads_user_notification_unique").on(table.userId, table.notificationId)]);

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
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type VehicleExpense = typeof vehicleExpenses.$inferSelect;
export type InsertVehicleExpense = typeof vehicleExpenses.$inferInsert;
export type VehicleRevenue = typeof vehicleRevenues.$inferSelect;
export type InsertVehicleRevenue = typeof vehicleRevenues.$inferInsert;
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
export type MaintenanceEvent = typeof maintenanceEvents.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type ClientRepresentative = typeof clientRepresentatives.$inferSelect;
export type InsertClientRepresentative = typeof clientRepresentatives.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
export type Payable = typeof payables.$inferSelect;
export type InsertPayable = typeof payables.$inferInsert;
export type PayablePayment = typeof payablePayments.$inferSelect;
export type InsertPayablePayment = typeof payablePayments.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type SettingCatalog = typeof settingCatalog.$inferSelect;
export type InsertSettingCatalog = typeof settingCatalog.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
