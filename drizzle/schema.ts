import { sql } from "drizzle-orm";
import {
  date,
  decimal,
  foreignKey,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  // Required for the mutually-referencing pairs below (vehicles <-> drivers and
  // purchase requests <-> quotes): without an explicit return type TypeScript
  // cannot infer the table types and every dependent type becomes `any`.
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";

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
  // Bumped whenever the account's security state changes (password, role,
  // permissions, deactivation). Session tokens carry the value they were issued
  // with, so incrementing this revokes every outstanding token for that user
  // instead of leaving a stolen one valid for its full lifetime.
  sessionVersion: int("sessionVersion").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const branches = mysqlTable(
  "branches",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    address: varchar("address", { length: 300 }).notNull().default("—"),
    phone: varchar("phone", { length: 40 }).notNull().default("—"),
    vatNumber: varchar("vatNumber", { length: 64 }).notNull().default("—"),
    isActive: int("isActive").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("branches_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
  ]
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    client: varchar("client", { length: 200 }).notNull().default("—"),
    contractId: int("contractId").references(() => contracts.id, {
      onDelete: "set null",
    }),
    contract: varchar("contract", { length: 40 }).notNull().default("—"),
    managerEmployeeId: int("managerEmployeeId"),
    manager: varchar("manager", { length: 160 }).notNull().default("—"),
    startDate: date("startDate", { mode: "string" }),
    endDate: date("endDate", { mode: "string" }),
    requiredVehicles: int("requiredVehicles").notNull().default(0),
    status: mysqlEnum("status", ["مخطط", "نشط", "موقوف", "مكتمل", "ملغي"])
      .notNull()
      .default("مخطط"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("projects_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("projects_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
    index("projects_client_archived_idx").on(table.clientId, table.archivedAt),
    index("projects_contract_archived_idx").on(
      table.contractId,
      table.archivedAt
    ),
    index("projects_manager_idx").on(table.managerEmployeeId),
  ]
);

export const vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    plate: varchar("plate", { length: 32 }).notNull(),
    brand: varchar("brand", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    year: varchar("year", { length: 8 }).notNull(),
    color: varchar("color", { length: 48 }).notNull(),
    mileage: varchar("mileage", { length: 32 }).notNull(),
    purchasePrice: decimal("purchasePrice", {
      precision: 15,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    purchaseDate: date("purchaseDate", { mode: "string" }),
    inServiceDate: date("inServiceDate", { mode: "string" }),
    // Every linked identifier is a real reference. These were plain integers
    // with no constraint, so a deleted project/driver/client could leave a
    // vehicle pointing at a record that no longer exists.
    projectId: int("projectId").references(() => projects.id, {
      onDelete: "set null",
    }),
    project: varchar("project", { length: 200 }).notNull().default("—"),
    driverId: int("driverId").references((): AnyMySqlColumn => drivers.id, {
      onDelete: "set null",
    }),
    driver: varchar("driver", { length: 120 }).notNull().default("—"),
    employeeId: int("employeeId").references(() => employees.id, {
      onDelete: "set null",
    }),
    employee: varchar("employee", { length: 160 }).notNull().default("—"),
    status: mysqlEnum("status", [
      "متاحة",
      "مؤجرة",
      "مشغولة",
      "في الصيانة",
      "قيد التجهيز",
      "متوقفة",
    ])
      .notNull()
      .default("متاحة"),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    client: varchar("client", { length: 160 }).notNull().default("—"),
    contractId: int("contractId").references(() => contracts.id, {
      onDelete: "set null",
    }),
    contract: varchar("contract", { length: 80 }).notNull().default("—"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
    activePlate: varchar("activePlate", { length: 32 }).generatedAlwaysAs(
      sql`CASE WHEN archivedAt IS NULL THEN plate ELSE NULL END`,
      { mode: "stored" }
    ),
  },
  table => [
    index("vehicles_branch_archived_idx").on(table.branchId, table.archivedAt),
    uniqueIndex("vehicles_active_plate_unique").on(table.activePlate),
    // The list view filters on archivedAt and orders by createdAt; the linked
    // identifiers are dereferenced by the vehicle financial profile.
    index("vehicles_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
    index("vehicles_project_idx").on(table.projectId),
    index("vehicles_driver_idx").on(table.driverId),
    index("vehicles_employee_idx").on(table.employeeId),
    index("vehicles_client_idx").on(table.clientId),
    index("vehicles_contract_idx").on(table.contractId),
  ]
);

export const contracts = mysqlTable(
  "contracts",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 40 }).notNull().unique(),
    client: varchar("client", { length: 160 }).notNull(),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 120 }).notNull(),
    startDate: date("startDate", { mode: "string" }),
    expiry: date("expiry", { mode: "string" }),
    total: decimal("total", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    collected: decimal("collected", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    status: mysqlEnum("status", ["قائم", "مكتمل", "عرض سعر", "ملغي"])
      .notNull()
      .default("قائم"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("contracts_branch_archived_idx").on(table.branchId, table.archivedAt),
    // Client-scoped lookups, and the list view's archivedAt + createdAt order.
    // `(clientId, archivedAt, createdAt)` also serves plain clientId filtering,
    // so a shorter clientId-only index would be redundant.
    index("contracts_client_archived_created_idx").on(
      table.clientId,
      table.archivedAt,
      table.createdAt
    ),
    index("contracts_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
  ]
);

export const contractItems = mysqlTable(
  "contract_items",
  {
    id: int("id").autoincrement().primaryKey(),
    contractId: int("contractId")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    vehicleId: int("vehicleId").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    vehiclePlate: varchar("vehiclePlate", { length: 32 })
      .notNull()
      .default("—"),
    quantity: int("quantity").notNull().default(1),
    driver: varchar("driver", { length: 120 }).notNull().default("—"),
    coverage: mysqlEnum("coverage", ["مركبة وسائق", "سائق فقط", "مركبة فقط"])
      .notNull()
      .default("مركبة وسائق"),
    description: varchar("description", { length: 240 })
      .notNull()
      .default("خدمة تشغيل"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  // This table previously had no secondary index at all, so every contract
  // detail read and vehicle-in-contract check scanned it in full.
  table => [
    index("contract_items_contract_idx").on(table.contractId),
    index("contract_items_vehicle_idx").on(table.vehicleId),
  ]
);

export const claims = mysqlTable(
  "claims",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 40 }).notNull().unique(),
    client: varchar("client", { length: 160 }).notNull(),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    contract: varchar("contract", { length: 40 }).notNull(),
    contractId: int("contractId").references(() => contracts.id, {
      onDelete: "set null",
    }),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    due: date("due", { mode: "string" }),
    paid: decimal("paid", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    submittedAt: date("submittedAt", { mode: "string" }),
    followUpAt: date("followUpAt", { mode: "string" }),
    notes: text("notes"),
    status: mysqlEnum("status", [
      "غير مرفوعة",
      "جديدة",
      "تحت الإجراء",
      "تم اعتمادها",
      "تم صرفها",
      "مرفوضة",
      "ملغاة",
    ])
      .notNull()
      .default("جديدة"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("claims_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("claims_contract_archived_idx").on(
      table.contractId,
      table.archivedAt
    ),
    index("claims_client_archived_idx").on(table.clientId, table.archivedAt),
    index("claims_archived_created_idx").on(table.archivedAt, table.createdAt),
  ]
);

export const drivers = mysqlTable(
  "drivers",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull().default("—"),
    idNo: varchar("idNo", { length: 64 }).notNull().default("—"),
    status: mysqlEnum("status", ["متاح", "مشغول", "موقوف"])
      .notNull()
      .default("متاح"),
    vehicleId: int("vehicleId").references((): AnyMySqlColumn => vehicles.id, {
      onDelete: "set null",
    }),
    vehicle: varchar("vehicle", { length: 32 }).notNull().default("—"),
    license: varchar("license", { length: 80 }).notNull().default("خصوصي"),
    renewal: date("renewal", { mode: "string" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("drivers_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("drivers_archived_created_idx").on(table.archivedAt, table.createdAt),
    index("drivers_vehicle_idx").on(table.vehicleId),
  ]
);

export const employees = mysqlTable(
  "employees",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    employeeNo: varchar("employeeNo", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    nationalId: varchar("nationalId", { length: 64 }).notNull().default("—"),
    phone: varchar("phone", { length: 40 }).notNull().default("—"),
    email: varchar("email", { length: 320 }).notNull().default("—"),
    department: varchar("department", { length: 120 })
      .notNull()
      .default("الإدارة"),
    jobTitle: varchar("jobTitle", { length: 120 }).notNull().default("موظف"),
    hireDate: date("hireDate", { mode: "string" }),
    status: mysqlEnum("status", ["نشط", "إجازة", "موقوف", "منتهي الخدمة"])
      .notNull()
      .default("نشط"),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    empNo: varchar("empNo", { length: 40 }),
    driverId: int("driverId").references((): AnyMySqlColumn => drivers.id, {
      onDelete: "set null",
    }),
    basicSalary: int("basicSalary").notNull().default(0),
    housingAllowance: int("housingAllowance").notNull().default(0),
    transportAllowance: int("transportAllowance").notNull().default(0),
    otherAllowance: int("otherAllowance").notNull().default(0),
    contractType: varchar("contractType", { length: 80 }).notNull().default("دوام كامل"),
    residencyExpiry: varchar("residencyExpiry", { length: 32 }).notNull().default("—"),
    insuranceExpiry: varchar("insuranceExpiry", { length: 32 }).notNull().default("—"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("employees_branch_archived_idx").on(table.branchId, table.archivedAt),
    uniqueIndex("employees_user_id_unique").on(table.userId),
    index("employees_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
    index("employees_department_idx").on(table.department),
    index("employees_driver_idx").on(table.driverId),
  ]
);

export const payroll = mysqlTable("payroll", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 160 }).notNull(),
  month: varchar("month", { length: 20 }).notNull(),
  basicSalary: int("basicSalary").notNull().default(0),
  allowances: int("allowances").notNull().default(0),
  deductions: int("deductions").notNull().default(0),
  netSalary: int("netSalary").notNull().default(0),
  status: mysqlEnum("status", ["مسودة", "معتمد", "تم الصرف"]).notNull().default("مسودة"),
  paidAt: varchar("paidAt", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leaves = mysqlTable("leaves", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  employeeName: varchar("employeeName", { length: 160 }).notNull(),
  type: mysqlEnum("type", ["سنوية", "مرضية", "طارئة", "بدون راتب"]).notNull().default("سنوية"),
  startDate: varchar("startDate", { length: 32 }).notNull(),
  endDate: varchar("endDate", { length: 32 }).notNull(),
  days: int("days").notNull().default(1),
  reason: varchar("reason", { length: 255 }).default("—"),
  status: mysqlEnum("status", ["قيد المراجعة", "معتمدة", "مرفوضة"]).notNull().default("قيد المراجعة"),
  approvedBy: varchar("approvedBy", { length: 160 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const maintenanceRequests = mysqlTable(
  "maintenance_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 40 }).notNull().unique(),
    vehicleId: int("vehicleId").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    vehicleStatusBefore: mysqlEnum("vehicleStatusBefore", [
      "متاحة",
      "مؤجرة",
      "مشغولة",
      "في الصيانة",
      "قيد التجهيز",
      "متوقفة",
    ]),
    // Assignment snapshot taken when the request is raised (migration 0037).
    // Declared here to match the applied database, which already has these
    // columns: omitting them made `drizzle-kit generate` emit DROP COLUMN.
    projectIdAtRequest: int("projectIdAtRequest"),
    projectNameAtRequest: varchar("projectNameAtRequest", { length: 200 }),
    clientIdAtRequest: int("clientIdAtRequest"),
    clientNameAtRequest: varchar("clientNameAtRequest", { length: 200 }),
    vehicle: varchar("vehicle", { length: 80 }).notNull(),
    type: varchar("type", { length: 160 }).notNull(),
    priority: mysqlEnum("priority", ["طارئ", "عاجل", "متوسط", "عادي"])
      .notNull()
      .default("متوسط"),
    workflowStage: mysqlEnum("workflowStage", [
      "بلاغ",
      "فحص",
      "تشخيص",
      "تقدير تكلفة",
      "اعتماد",
      "تنفيذ",
      "فحص بعد الإصلاح",
      "مغلق",
      "مرفوض",
    ])
      .notNull()
      .default("بلاغ"),
    reportedBy: varchar("reportedBy", { length: 160 }).notNull().default("—"),
    reason: varchar("reason", { length: 500 }).notNull().default("—"),
    diagnosis: text("diagnosis"),
    workDone: text("workDone"),
    parts: text("parts"),
    technician: varchar("technician", { length: 160 }).notNull().default("—"),
    workshop: varchar("workshop", { length: 200 }).notNull().default("—"),
    manager: varchar("manager", { length: 160 }).notNull().default("—"),
    start: date("start", { mode: "string" }),
    due: date("due", { mode: "string" }),
    expectedReturn: date("expectedReturn", { mode: "string" }),
    status: mysqlEnum("status", [
      "جديد",
      "جاري العمل",
      "بانتظار الفحص",
      "مكتمل",
      "متوقف",
    ])
      .notNull()
      .default("جديد"),
    // Legacy display string. Historically this was the only place the actual
    // maintenance cost was stored, as free text such as "1,250 SAR" or
    // "0 ر.س", which had to be parsed back with string surgery before any
    // arithmetic and silently became 0 for unrecognised formats. `costAmount`
    // is now the numeric source of truth; this column is written alongside it
    // only so existing screens keep rendering.
    cost: varchar("cost", { length: 40 }).notNull().default("0 ر.س"),
    costAmount: decimal("costAmount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }),
    estimatedCost: decimal("estimatedCost", {
      precision: 15,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    quotedPartsCost: decimal("quotedPartsCost", {
      precision: 15,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    quoteName: varchar("quoteName", { length: 255 }),
    quoteUrl: mediumtext("quoteUrl"),
    laborCost: decimal("laborCost", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    partsCost: decimal("partsCost", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    approvalStatus: mysqlEnum("approvalStatus", [
      "غير مطلوب",
      "بانتظار الاعتماد",
      "معتمد",
      "مرفوض",
    ])
      .notNull()
      .default("غير مطلوب"),
    approvedByUserId: int("approvedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByName: varchar("approvedByName", { length: 160 }),
    approvedAt: timestamp("approvedAt"),
    approvalNotes: text("approvalNotes"),
    fundingType: mysqlEnum("fundingType", ["عهدة", "تحويل مباشر"]),
    fundingReference: varchar("fundingReference", { length: 120 }),
    fundingAmount: decimal("fundingAmount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }),
    fundingRecipient: varchar("fundingRecipient", { length: 160 }),
    advanceStatus: mysqlEnum("advanceStatus", ["مفتوحة", "مسواة"]),
    advanceSettledAt: timestamp("advanceSettledAt"),
    advanceSettlementReference: varchar("advanceSettlementReference", {
      length: 120,
    }),
    // Advance reconciliation figures (migration 0036). Declared here to match the
    // applied database, which already has these columns: omitting them made
    // `drizzle-kit generate` emit DROP COLUMN.
    advanceInvoiceTotal: decimal("advanceInvoiceTotal", {
      precision: 15,
      scale: 2,
      mode: "number",
    }),
    advanceVariance: decimal("advanceVariance", {
      precision: 15,
      scale: 2,
      mode: "number",
    }),
    fundingIssuedAt: timestamp("fundingIssuedAt"),
    fundingIssuedByUserId: int("fundingIssuedByUserId").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    fundingIssuedByName: varchar("fundingIssuedByName", { length: 160 }),
    warrantyUntil: date("warrantyUntil", { mode: "string" }),
    closedAt: timestamp("closedAt"),
    receiptName: varchar("receiptName", { length: 255 }),
    receiptUrl: mediumtext("receiptUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("maintenance_requests_branch_archived_idx").on(
      table.branchId,
      table.archivedAt
    ),
    // Previously had zero non-unique indexes: the maintenance list (archivedAt
    // + createdAt) and every per-vehicle lookup scanned the whole table.
    index("maintenance_requests_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
    index("maintenance_requests_vehicle_created_idx").on(
      table.vehicleId,
      table.createdAt
    ),
    index("maintenance_requests_stage_created_idx").on(
      table.workflowStage,
      table.createdAt
    ),
    index("maintenance_requests_status_idx").on(table.status),
    index("maintenance_requests_approval_idx").on(
      table.approvalStatus,
      table.archivedAt
    ),
  ]
);

export const maintenanceEvents = mysqlTable(
  "maintenance_events",
  {
    id: int("id").autoincrement().primaryKey(),
    maintenanceRequestId: int("maintenanceRequestId").notNull(),
    eventType: varchar("eventType", { length: 60 }).notNull(),
    fromStage: varchar("fromStage", { length: 80 }),
    toStage: varchar("toStage", { length: 80 }),
    details: text("details"),
    actorUserId: int("actorUserId"),
    actorName: varchar("actorName", { length: 160 }).notNull().default("—"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  // The request timeline filters and orders by these two columns on every view.
  table => [
    index("maintenance_events_request_created_idx").on(
      table.maintenanceRequestId,
      table.createdAt
    ),
    // Explicit short constraint name: the derived name
    // (maintenance_events_maintenanceRequestId_maintenance_requests_id_fk) is
    // 66 characters, over MySQL's 64-character identifier limit - the same
    // defect that made migration 0038 impossible to apply.
    foreignKey({
      name: "maintenance_events_request_fk",
      columns: [table.maintenanceRequestId],
      foreignColumns: [maintenanceRequests.id],
    }).onDelete("cascade"),
  ]
);

export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    entityId: int("entityId"),
    entity: varchar("entity", { length: 160 }).notNull().default("—"),
    entityType: varchar("entityType", { length: 40 })
      .notNull()
      .default("مركبة"),
    type: varchar("type", { length: 80 }).notNull().default("مركبة"),
    expiry: date("expiry", { mode: "string" }),
    status: mysqlEnum("status", ["ساري", "قريبًا", "متأخر", "منتهي"])
      .notNull()
      .default("ساري"),
    owner: varchar("owner", { length: 160 }).notNull().default("—"),
    fileName: varchar("fileName", { length: 255 }),
    fileUrl: mediumtext("fileUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  // This table previously had no index at all, including on the polymorphic
  // link used to find a record's documents and to authorise stored files.
  table => [
    index("documents_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("documents_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
    index("documents_archived_expiry_idx").on(table.archivedAt, table.expiry),
    index("documents_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const clients = mysqlTable(
  "clients",
  {
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
  },
  table => [
    index("clients_archived_created_idx").on(table.archivedAt, table.createdAt),
    index("clients_name_idx").on(table.name),
  ]
);

export const clientRepresentatives = mysqlTable(
  "client_representatives",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull().default("—"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("client_representatives_client_idx").on(
      table.clientId,
      table.archivedAt
    ),
  ]
);

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    contractId: int("contractId").references(() => contracts.id, {
      onDelete: "set null",
    }),
    claimId: int("claimId").references(() => claims.id, {
      onDelete: "set null",
    }),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    paidAt: date("paidAt", { mode: "string" }),
    method: varchar("method", { length: 80 }).notNull().default("تحويل بنكي"),
    reference: varchar("reference", { length: 80 }).notNull().default("—"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("payments_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("payments_archived_paid_idx").on(table.archivedAt, table.paidAt),
    // Receipt allocation resolves payments by contract, claim and client.
    index("payments_contract_archived_idx").on(
      table.contractId,
      table.archivedAt
    ),
    index("payments_claim_idx").on(table.claimId),
    index("payments_client_idx").on(table.clientId),
  ]
);

export const vehicleExpenses = mysqlTable(
  "vehicle_expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    vehicleId: int("vehicleId")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    maintenanceRequestId: int("maintenanceRequestId").unique(),
    payableId: int("payableId")
      .unique()
      .references(() => payables.id, { onDelete: "set null" }),
    projectId: int("projectId").references(() => projects.id, {
      onDelete: "set null",
    }),
    projectName: varchar("projectName", { length: 200 }).notNull().default("—"),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    clientName: varchar("clientName", { length: 200 }).notNull().default("—"),
    category: mysqlEnum("category", [
      "صيانة",
      "قطع غيار",
      "زيوت وفلاتر",
      "إطارات",
      "إصلاحات وأعطال",
      "تأمين",
      "فحص واستمارة",
      "مخالفات",
      "أخرى",
    ]).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    spentAt: date("spentAt", { mode: "string" }),
    description: varchar("description", { length: 300 }).notNull(),
    vendor: varchar("vendor", { length: 160 }).notNull().default("—"),
    receiptName: varchar("receiptName", { length: 255 }),
    receiptUrl: mediumtext("receiptUrl"),
    notes: text("notes"),
    createdByUserId: int("createdByUserId"),
    createdByName: varchar("createdByName", { length: 160 })
      .notNull()
      .default("—"),
    updatedByUserId: int("updatedByUserId"),
    updatedByName: varchar("updatedByName", { length: 160 })
      .notNull()
      .default("—"),
    archivedByUserId: int("archivedByUserId"),
    archivedByName: varchar("archivedByName", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("vehicle_expenses_branch_archived_idx").on(
      table.branchId,
      table.archivedAt
    ),
    index("vehicle_expenses_archived_spent_idx").on(
      table.archivedAt,
      table.spentAt
    ),
    // The vehicle financial profile and per-vehicle expense summary filter by
    // vehicleId, which the archivedAt/spentAt index cannot serve.
    index("vehicle_expenses_vehicle_archived_idx").on(
      table.vehicleId,
      table.archivedAt
    ),
    foreignKey({
      name: "vehicle_expenses_maintenance_request_fk",
      columns: [table.maintenanceRequestId],
      foreignColumns: [maintenanceRequests.id],
    }).onDelete("set null"),
  ]
);

export const vehicleRevenues = mysqlTable(
  "vehicle_revenues",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    vehicleId: int("vehicleId")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    paymentId: int("paymentId")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    projectId: int("projectId").references(() => projects.id, {
      onDelete: "set null",
    }),
    projectName: varchar("projectName", { length: 200 }).notNull().default("—"),
    clientId: int("clientId").references(() => clients.id, {
      onDelete: "set null",
    }),
    clientName: varchar("clientName", { length: 200 }).notNull().default("—"),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    receiptName: varchar("receiptName", { length: 255 }),
    receiptUrl: mediumtext("receiptUrl"),
    notes: text("notes"),
    createdByUserId: int("createdByUserId"),
    createdByName: varchar("createdByName", { length: 160 })
      .notNull()
      .default("—"),
    archivedByUserId: int("archivedByUserId"),
    archivedByName: varchar("archivedByName", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("vehicle_revenues_branch_archived_idx").on(
      table.branchId,
      table.archivedAt
    ),
    index("vehicle_revenues_payment_archived_idx").on(
      table.paymentId,
      table.archivedAt
    ),
    // Revenue allocation is read per vehicle, not per payment.
    index("vehicle_revenues_vehicle_archived_idx").on(
      table.vehicleId,
      table.archivedAt
    ),
  ]
);

export const payables = mysqlTable(
  "payables",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 40 }).notNull().unique(),
    supplier: varchar("supplier", { length: 200 }).notNull(),
    description: varchar("description", { length: 300 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    paid: decimal("paid", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    issueDate: date("issueDate", { mode: "string" }),
    dueDate: date("dueDate", { mode: "string" }),
    status: mysqlEnum("status", [
      "جديدة",
      "معتمدة",
      "مدفوعة جزئيًا",
      "مدفوعة",
      "ملغاة",
    ])
      .notNull()
      .default("جديدة"),
    notes: text("notes"),
    vehicleId: int("vehicleId").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    maintenanceRequestId: int("maintenanceRequestId").references(
      () => maintenanceRequests.id,
      { onDelete: "set null" }
    ),
    vehicleCategory: mysqlEnum("vehicleCategory", [
      "صيانة",
      "قطع غيار",
      "زيوت وفلاتر",
      "إطارات",
      "إصلاحات وأعطال",
      "تأمين",
      "فحص واستمارة",
      "مخالفات",
      "أخرى",
    ]),
    receiptName: varchar("receiptName", { length: 255 }),
    receiptUrl: mediumtext("receiptUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("payables_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("payables_maintenance_request_idx").on(table.maintenanceRequestId),
    // Vehicle cost reporting and the payables list/status views filter here.
    index("payables_vehicle_archived_idx").on(
      table.vehicleId,
      table.archivedAt
    ),
    index("payables_archived_status_idx").on(table.archivedAt, table.status),
    index("payables_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
  ]
);

export const payablePayments = mysqlTable(
  "payable_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    payableId: int("payableId")
      .notNull()
      .references(() => payables.id, { onDelete: "restrict" }),
    amount: decimal("amount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).notNull(),
    paidAt: date("paidAt", { mode: "string" }),
    method: varchar("method", { length: 80 }).notNull().default("تحويل بنكي"),
    reference: varchar("reference", { length: 80 }).notNull().default("—"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("payable_payments_branch_created_idx").on(
      table.branchId,
      table.createdAt
    ),
    index("payable_payments_paid_idx").on(table.paidAt),
    // Every payable balance read resolves its payments by payableId.
    index("payable_payments_payable_idx").on(table.payableId),
  ]
);

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    dueAt: date("dueAt", { mode: "string" }),
    status: mysqlEnum("status", ["مفتوحة", "مكتملة", "ملغاة"])
      .notNull()
      .default("مفتوحة"),
    assignee: varchar("assignee", { length: 160 }).notNull().default("—"),
    assigneeUserId: int("assigneeUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    relatedEntityType: varchar("relatedEntityType", { length: 40 }),
    relatedEntityId: int("relatedEntityId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("tasks_branch_archived_idx").on(table.branchId, table.archivedAt),
    index("tasks_related_entity_idx").on(
      table.relatedEntityType,
      table.relatedEntityId
    ),
    // The task list filters by archivedAt and scopes to an assignee.
    index("tasks_archived_assignee_created_idx").on(
      table.archivedAt,
      table.assigneeUserId,
      table.createdAt
    ),
  ]
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entityType", { length: 60 }),
    entityId: int("entityId"),
    severity: mysqlEnum("severity", ["معلومة", "تنبيه", "حرج"])
      .notNull()
      .default("معلومة"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  // The notification centre always reads the newest rows first.
  table => [
    index("notifications_created_idx").on(table.createdAt),
    index("notifications_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const notificationReads = mysqlTable(
  "notification_reads",
  {
    id: int("id").autoincrement().primaryKey(),
    notificationId: int("notificationId")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("readAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("notification_reads_user_notification_unique").on(
      table.userId,
      table.notificationId
    ),
  ]
);

export const settingCatalog = mysqlTable(
  "setting_catalog",
  {
    id: int("id").autoincrement().primaryKey(),
    category: varchar("category", { length: 80 }).notNull(),
    key: varchar("key", { length: 80 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    value: varchar("value", { length: 255 }).notNull(),
    active: int("active").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("setting_catalog_category_idx").on(table.category, table.active),
  ]
);

export const inventoryItems = mysqlTable(
  "inventory_items",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    unit: varchar("unit", { length: 40 }).notNull().default("قطعة"),
    onHand: int("onHand").notNull().default(0),
    reorderLevel: int("reorderLevel").notNull().default(0),
    location: varchar("location", { length: 160 }).notNull().default("—"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("inventory_items_branch_archived_idx").on(
      table.branchId,
      table.archivedAt
    ),
    index("inventory_items_archived_created_idx").on(
      table.archivedAt,
      table.createdAt
    ),
    index("inventory_items_category_idx").on(table.category),
  ]
);

export const inventoryMovements = mysqlTable(
  "inventory_movements",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    itemId: int("itemId")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    direction: mysqlEnum("direction", ["استلام", "صرف"]).notNull(),
    quantity: int("quantity").notNull(),
    resultingBalance: int("resultingBalance").notNull(),
    reference: varchar("reference", { length: 120 }).notNull().default("—"),
    recipient: varchar("recipient", { length: 160 }).notNull().default("—"),
    notes: text("notes"),
    actorUserId: int("actorUserId"),
    actorName: varchar("actorName", { length: 160 }).notNull().default("—"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("inventory_movements_branch_created_idx").on(
      table.branchId,
      table.createdAt
    ),
    index("inventory_movements_item_created_idx").on(
      table.itemId,
      table.createdAt
    ),
  ]
);

export const inventoryRequests = mysqlTable(
  "inventory_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 48 }).notNull().unique(),
    requestedByUserId: int("requestedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    requestedByName: varchar("requestedByName", { length: 160 }).notNull(),
    purpose: varchar("purpose", { length: 500 }).notNull(),
    // The foreign key is declared at table level with an explicit short name.
    // Drizzle would otherwise derive
    // `inventory_requests_maintenanceRequestId_maintenance_requests_id_fk`
    // (66 characters), which exceeds MySQL's 64-character identifier limit, so
    // migration 0038 failed with ER_TOO_LONG_IDENT and was never applied.
    maintenanceRequestId: int("maintenanceRequestId"),
    status: mysqlEnum("status", [
      "بانتظار الاعتماد",
      "معتمد",
      "معتمد جزئيًا",
      "مرفوض",
      "مصروف",
    ])
      .notNull()
      .default("بانتظار الاعتماد"),
    approvalNotes: text("approvalNotes"),
    approvedByUserId: int("approvedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByName: varchar("approvedByName", { length: 160 }),
    approvedAt: timestamp("approvedAt"),
    issuedAt: timestamp("issuedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("inventory_requests_branch_created_idx").on(
      table.branchId,
      table.createdAt
    ),
    index("inventory_requests_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    index("inventory_requests_maintenance_idx").on(
      table.maintenanceRequestId,
      table.createdAt
    ),
    foreignKey({
      name: "inventory_requests_maintenance_request_fk",
      columns: [table.maintenanceRequestId],
      foreignColumns: [maintenanceRequests.id],
    }).onDelete("set null"),
  ]
);

export const inventoryRequestItems = mysqlTable(
  "inventory_request_items",
  {
    id: int("id").autoincrement().primaryKey(),
    requestId: int("requestId")
      .notNull()
      .references(() => inventoryRequests.id, { onDelete: "cascade" }),
    itemId: int("itemId")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    itemName: varchar("itemName", { length: 180 }).notNull(),
    sku: varchar("sku", { length: 64 }).notNull(),
    unit: varchar("unit", { length: 40 }).notNull(),
    requestedQuantity: int("requestedQuantity").notNull(),
    approvedQuantity: int("approvedQuantity").notNull().default(0),
    issuedQuantity: int("issuedQuantity").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("inventory_request_items_request_idx").on(table.requestId),
    index("inventory_request_items_item_idx").on(table.itemId),
  ]
);

export const accidents = mysqlTable(
  "accidents",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 48 }).notNull().unique(),
    vehicleId: int("vehicleId").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    vehiclePlate: varchar("vehiclePlate", { length: 32 }).notNull(),
    driverId: int("driverId").references(() => drivers.id, {
      onDelete: "set null",
    }),
    driverName: varchar("driverName", { length: 160 }).notNull().default("—"),
    occurredAt: date("occurredAt", { mode: "string" }),
    location: varchar("location", { length: 240 }).notNull().default("—"),
    description: text("description").notNull(),
    najmReportNo: varchar("najmReportNo", { length: 120 }),
    najmReportName: varchar("najmReportName", { length: 255 }),
    najmReportUrl: mediumtext("najmReportUrl"),
    workflowStage: mysqlEnum("workflowStage", [
      "بلاغ",
      "تحديد المسؤولية",
      "تقدير الإصلاح",
      "مطالبة التأمين",
      "التسوية",
      "مغلق",
      "ملغي",
    ])
      .notNull()
      .default("بلاغ"),
    faultPercent: int("faultPercent"),
    estimatedRepairCost: decimal("estimatedRepairCost", {
      precision: 15,
      scale: 2,
      mode: "number",
    }),
    insurerName: varchar("insurerName", { length: 180 }),
    insurerClaimRef: varchar("insurerClaimRef", { length: 120 }),
    insurerClaimStatus: mysqlEnum("insurerClaimStatus", [
      "غير مرفوعة",
      "مرفوعة",
      "مقبولة",
      "مرفوضة",
      "مصروفة",
    ])
      .notNull()
      .default("غير مرفوعة"),
    settlementAmount: decimal("settlementAmount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }),
    resolutionNotes: text("resolutionNotes"),
    reportedByUserId: int("reportedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    reportedByName: varchar("reportedByName", { length: 160 }).notNull(),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("accidents_branch_archived_idx").on(table.branchId, table.archivedAt),
    uniqueIndex("accidents_najm_report_unique").on(table.najmReportNo),
    index("accidents_vehicle_occurred_idx").on(
      table.vehicleId,
      table.occurredAt
    ),
    index("accidents_stage_created_idx").on(
      table.workflowStage,
      table.createdAt
    ),
    // The list view filters archivedAt and orders by occurredAt, which neither
    // existing index can serve.
    index("accidents_archived_occurred_idx").on(
      table.archivedAt,
      table.occurredAt
    ),
  ]
);

export const accidentEvents = mysqlTable(
  "accident_events",
  {
    id: int("id").autoincrement().primaryKey(),
    accidentId: int("accidentId")
      .notNull()
      .references(() => accidents.id, { onDelete: "cascade" }),
    fromStage: varchar("fromStage", { length: 60 }),
    toStage: varchar("toStage", { length: 60 }).notNull(),
    details: text("details"),
    actorUserId: int("actorUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    actorName: varchar("actorName", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("accident_events_accident_created_idx").on(
      table.accidentId,
      table.createdAt
    ),
  ]
);

export const purchaseRequests = mysqlTable(
  "purchase_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    ref: varchar("ref", { length: 48 }).notNull().unique(),
    department: varchar("department", { length: 100 })
      .notNull()
      .default("الصيانة"),
    category: varchar("category", { length: 100 })
      .notNull()
      .default("قطع غيار"),
    purpose: varchar("purpose", { length: 500 }).notNull(),
    priority: mysqlEnum("priority", ["عادي", "متوسط", "عاجل", "طارئ"])
      .notNull()
      .default("عادي"),
    estimatedBudget: decimal("estimatedBudget", {
      precision: 15,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    status: mysqlEnum("status", [
      "جديد",
      "بانتظار العروض",
      "قيد المقارنة",
      "معتمد",
      "أمر شراء صادر",
      "مرفوض",
      "مكتمل",
    ])
      .notNull()
      .default("جديد"),
    requestedByUserId: int("requestedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    requestedByName: varchar("requestedByName", { length: 160 }).notNull(),
    selectedQuoteId: int("selectedQuoteId").references(
      (): AnyMySqlColumn => purchaseQuotes.id,
      { onDelete: "set null" }
    ),
    approvalNotes: text("approvalNotes"),
    approvedByUserId: int("approvedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByName: varchar("approvedByName", { length: 160 }),
    approvedAt: timestamp("approvedAt"),
    rejectionReason: text("rejectionReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("purchase_requests_branch_archived_idx").on(
      table.branchId,
      table.archivedAt
    ),
    index("purchase_requests_status_idx").on(table.status, table.createdAt),
    index("purchase_requests_dept_idx").on(table.department, table.createdAt),
  ]
);

export const purchaseQuotes = mysqlTable(
  "purchase_quotes",
  {
    id: int("id").autoincrement().primaryKey(),
    // The branch this record belongs to. Defaulted to the seeded main branch
    // (id 1) only so in-flight inserts keep working until the data layer
    // threads the acting branch; the default is to be removed afterwards.
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    requestId: int("requestId")
      .notNull()
      .references((): AnyMySqlColumn => purchaseRequests.id, {
        onDelete: "cascade",
      }),
    supplierName: varchar("supplierName", { length: 200 }).notNull(),
    supplierVat: varchar("supplierVat", { length: 64 }),
    supplierPhone: varchar("supplierPhone", { length: 64 }),
    itemDescription: varchar("itemDescription", { length: 300 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    unitPrice: decimal("unitPrice", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    taxAmount: decimal("taxAmount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    totalAmount: decimal("totalAmount", {
      precision: 15,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    deliveryDays: int("deliveryDays").notNull().default(3),
    warrantyPeriod: varchar("warrantyPeriod", { length: 100 })
      .notNull()
      .default("لا يوجد"),
    supplierRating: int("supplierRating").notNull().default(4),
    quoteFileUrl: mediumtext("quoteFileUrl"),
    quoteFileName: varchar("quoteFileName", { length: 255 }),
    notes: text("notes"),
    isSelected: int("isSelected").notNull().default(0),
    selectionReason: varchar("selectionReason", { length: 300 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("purchase_quotes_request_idx").on(table.requestId),
    index("purchase_quotes_branch_created_idx").on(
      table.branchId,
      table.createdAt
    ),
  ]
);

export const accounts = mysqlTable(
  "accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    type: mysqlEnum("type", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
    normalBalance: mysqlEnum("normalBalance", ["debit", "credit"]).notNull(),
    parentId: int("parentId"),
    level: int("level").notNull().default(1),
    isActive: int("isActive").notNull().default(1),
    branchId: int("branchId").references(() => branches.id, { onDelete: "restrict" }),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("accounts_code_idx").on(table.code),
    index("accounts_parent_idx").on(table.parentId),
    index("accounts_type_idx").on(table.type),
    index("accounts_branch_idx").on(table.branchId),
    index("accounts_archived_idx").on(table.archivedAt),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "accounts_parentId_accounts_id_fk",
    }).onDelete("restrict"),
  ]
);

export const fiscalPeriods = mysqlTable(
  "fiscal_periods",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    startDate: date("startDate", { mode: "string" }).notNull(),
    endDate: date("endDate", { mode: "string" }).notNull(),
    status: mysqlEnum("status", ["open", "closed"]).notNull().default("open"),
    closedAt: timestamp("closedAt"),
    closedBy: int("closedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    archivedAt: timestamp("archivedAt"),
  },
  table => [
    index("fiscal_periods_dates_idx").on(table.startDate, table.endDate),
    index("fiscal_periods_status_idx").on(table.status),
  ]
);

export const journalEntries = mysqlTable(
  "journal_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    entryNumber: varchar("entryNumber", { length: 64 }).notNull().unique(),
    entryDate: date("entryDate", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    reference: varchar("reference", { length: 120 }).notNull().default("—"),
    sourceType: varchar("sourceType", { length: 40 }).notNull().default("manual"),
    sourceId: int("sourceId"),
    status: mysqlEnum("status", ["draft", "posted", "reversed"]).notNull().default("posted"),
    isReversed: int("isReversed").notNull().default(0),
    reversedEntryId: int("reversedEntryId"),
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    fiscalPeriodId: int("fiscalPeriodId").references(() => fiscalPeriods.id, {
      onDelete: "set null",
    }),
    totalDebit: decimal("totalDebit", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    totalCredit: decimal("totalCredit", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("postedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("journal_entries_date_branch_idx").on(table.entryDate, table.branchId),
    index("journal_entries_status_idx").on(table.status),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    index("journal_entries_period_idx").on(table.fiscalPeriodId),
    foreignKey({
      columns: [table.reversedEntryId],
      foreignColumns: [table.id],
      name: "journal_entries_reversed_fk",
    }).onDelete("set null"),
  ]
);

export const journalLines = mysqlTable(
  "journal_lines",
  {
    id: int("id").autoincrement().primaryKey(),
    entryId: int("entryId")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: int("accountId")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    debit: decimal("debit", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    credit: decimal("credit", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    description: varchar("description", { length: 300 }),
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    vehicleId: int("vehicleId").references(() => vehicles.id, { onDelete: "set null" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    contractId: int("contractId").references(() => contracts.id, { onDelete: "set null" }),
    driverId: int("driverId").references(() => drivers.id, { onDelete: "set null" }),
    clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
    lineOrder: int("lineOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("journal_lines_entry_idx").on(table.entryId),
    index("journal_lines_account_idx").on(table.accountId),
    index("journal_lines_vehicle_idx").on(table.vehicleId),
    index("journal_lines_project_idx").on(table.projectId),
    index("journal_lines_contract_idx").on(table.contractId),
    index("journal_lines_branch_idx").on(table.branchId),
  ]
);

export const taxInvoices = mysqlTable(
  "tax_invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull().unique(),
    uuid: varchar("uuid", { length: 64 }).notNull().unique(),
    invoiceType: mysqlEnum("invoiceType", ["standard", "simplified"]).notNull().default("simplified"),
    documentType: mysqlEnum("documentType", ["invoice", "credit_note", "debit_note"]).notNull().default("invoice"),
    issueDate: date("issueDate", { mode: "string" }).notNull(),
    issueTime: varchar("issueTime", { length: 16 }).notNull().default("12:00:00"),
    sellerName: varchar("sellerName", { length: 200 }).notNull(),
    sellerVatNumber: varchar("sellerVatNumber", { length: 32 }).notNull(),
    sellerAddress: varchar("sellerAddress", { length: 300 }).notNull().default("—"),
    sellerBuildingNo: varchar("sellerBuildingNo", { length: 16 }),
    sellerPostalCode: varchar("sellerPostalCode", { length: 16 }),
    sellerCity: varchar("sellerCity", { length: 80 }).notNull().default("الرياض"),
    sellerDistrict: varchar("sellerDistrict", { length: 80 }).notNull().default("—"),
    buyerName: varchar("buyerName", { length: 200 }).notNull(),
    buyerVatNumber: varchar("buyerVatNumber", { length: 32 }),
    buyerAddress: varchar("buyerAddress", { length: 300 }),
    buyerCity: varchar("buyerCity", { length: 80 }),
    branchId: int("branchId")
      .notNull()
      .default(1)
      .references(() => branches.id, { onDelete: "restrict" }),
    contractId: int("contractId").references(() => contracts.id, { onDelete: "set null" }),
    clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
    claimId: int("claimId").references(() => claims.id, { onDelete: "set null" }),
    vehicleId: int("vehicleId").references(() => vehicles.id, { onDelete: "set null" }),
    originalInvoiceId: int("originalInvoiceId"),
    totalExcludingVat: decimal("totalExcludingVat", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    totalDiscount: decimal("totalDiscount", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    totalVat: decimal("totalVat", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    totalIncludingVat: decimal("totalIncludingVat", { precision: 15, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    qrCodeData: text("qrCodeData").notNull(),
    invoiceHash: varchar("invoiceHash", { length: 128 }),
    previousInvoiceHash: varchar("previousInvoiceHash", { length: 128 }),
    zatcaStatus: mysqlEnum("zatcaStatus", ["pending", "reported", "cleared", "rejected"]).notNull().default("pending"),
    zatcaResponse: text("zatcaResponse"),
    notes: text("notes"),
    journalEntryId: int("journalEntryId").references(() => journalEntries.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tax_invoices_date_branch_idx").on(table.issueDate, table.branchId),
    index("tax_invoices_status_idx").on(table.zatcaStatus),
    index("tax_invoices_type_idx").on(table.invoiceType, table.documentType),
    index("tax_invoices_client_idx").on(table.clientId),
    index("tax_invoices_contract_idx").on(table.contractId),
    foreignKey({
      columns: [table.originalInvoiceId],
      foreignColumns: [table.id],
      name: "tax_invoices_original_fk",
    }).onDelete("set null"),
  ]
);

export const taxInvoiceLines = mysqlTable(
  "tax_invoice_lines",
  {
    id: int("id").autoincrement().primaryKey(),
    invoiceId: int("invoiceId")
      .notNull()
      .references(() => taxInvoices.id, { onDelete: "cascade" }),
    itemDescription: varchar("itemDescription", { length: 300 }).notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 3, mode: "number" }).notNull().default(1),
    unitPrice: decimal("unitPrice", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
    discount: decimal("discount", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
    subtotal: decimal("subtotal", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
    vatRate: decimal("vatRate", { precision: 5, scale: 2, mode: "number" }).notNull().default(15.0),
    vatAmount: decimal("vatAmount", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
    total: decimal("total", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
    vatCategory: varchar("vatCategory", { length: 10 }).notNull().default("S"),
    lineOrder: int("lineOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("tax_invoice_lines_invoice_idx").on(table.invoiceId),
  ]
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    details: text("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  // Append-only and unbounded: the activity view reads the newest rows first
  // and also filters by record. Without these every read scanned the table.
  table => [
    index("audit_logs_created_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_user_idx").on(table.userId, table.createdAt),
  ]
);

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
export type InsertClientRepresentative =
  typeof clientRepresentatives.$inferInsert;
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
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;
export type InventoryRequest = typeof inventoryRequests.$inferSelect;
export type InsertInventoryRequest = typeof inventoryRequests.$inferInsert;
export type InventoryRequestItem = typeof inventoryRequestItems.$inferSelect;
export type InsertInventoryRequestItem =
  typeof inventoryRequestItems.$inferInsert;
export type Accident = typeof accidents.$inferSelect;
export type InsertAccident = typeof accidents.$inferInsert;
export type AccidentEvent = typeof accidentEvents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = typeof purchaseRequests.$inferInsert;
export type PurchaseQuote = typeof purchaseQuotes.$inferSelect;
export type InsertPurchaseQuote = typeof purchaseQuotes.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type FiscalPeriod = typeof fiscalPeriods.$inferSelect;
export type InsertFiscalPeriod = typeof fiscalPeriods.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
export type JournalLine = typeof journalLines.$inferSelect;
export type InsertJournalLine = typeof journalLines.$inferInsert;
export type TaxInvoice = typeof taxInvoices.$inferSelect;
export type InsertTaxInvoice = typeof taxInvoices.$inferInsert;
export type TaxInvoiceLine = typeof taxInvoiceLines.$inferSelect;
export type InsertTaxInvoiceLine = typeof taxInvoiceLines.$inferInsert;
export type Payroll = typeof payroll.$inferSelect;
export type InsertPayroll = typeof payroll.$inferInsert;
export type Leave = typeof leaves.$inferSelect;
export type InsertLeave = typeof leaves.$inferInsert;
