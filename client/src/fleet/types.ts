import type { MaintenanceStage } from "@shared/maintenance-domain";
import type { TaskRelatedEntityType } from "@shared/task-relations";
import type { WorkTask } from "@/lib/task-queue";

export type ModuleKey =
  | "dashboard"
  | "vehicles"
  | "projects"
  | "maintenance"
  | "accidents"
  | "procurement"
  | "accounting"
  | "invoices"
  | "documents"
  | "drivers"
  | "employees"
  | "clients"
  | "finance"
  | "payables"
  | "custody"
  | "inventory"
  | "reports"
  | "settings"
  | "self_service";

export type Row = Record<string, any> & { id: number };

export type Vehicle = Row & {
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  mileage: string;
  driver: string;
  status: string;
  client: string;
  contract: string;
  purchasePrice?: number;
  purchaseDate?: string;
  inServiceDate?: string;
  expenseTotal?: number;
  revenueTotal?: number;
  netOperatingReturn?: number;
};

export type ProjectRow = Row & {
  ref: string;
  name: string;
  client: string;
  contract: string;
  manager: string;
  startDate: string;
  endDate: string;
  requiredVehicles: number;
  actualVehicles: number | null;
  status: string;
};

export type Driver = Row & {
  name: string;
  phone: string;
  idNo: string;
  status: string;
  vehicle: string;
  license: string;
  renewal: string;
};

export type Client = Row & {
  name: string;
  location: string;
  vat: string;
  commercial: string;
  contact: string;
  phone: string;
  contracts: number;
};

export type Maintenance = Row & {
  ref: string;
  vehicle: string;
  type: string;
  manager: string;
  start: string;
  due: string;
  status: string;
  priority?: string;
  workflowStage?: MaintenanceStage;
  approvalStatus?: string;
  estimatedCost?: number;
  quotedPartsCost?: number;
  reportedBy?: string;
  diagnosis?: string;
  technician?: string;
  workshop?: string;
  warrantyUntil?: string;
  cost?: string;
  quoteName?: string;
  quoteUrl?: string;
  advanceStatus?: string;
  fundingType?: string;
  advanceSettlementReference?: string;
  fundingReference?: string;
  fundingAmount?: number;
  fundingRecipient?: string;
  approvedByName?: string;
  approvedAt?: string | Date | null;
  approvalNotes?: string;
};

export type Document = Row & {
  name: string;
  entity: string;
  entityType?: string | null;
  entityId?: number | string | null;
  type: string;
  expiry: string;
  status: string;
  owner: string;
  hasFile?: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
};

export type Contract = Row & {
  ref: string;
  client: string;
  type: string;
  total: number;
  collected: number;
  expiry: string;
  status: string;
  clientId?: number | null;
  startDate?: string;
  items?: any[];
  notes?: string;
};

export type Claim = Row & {
  ref: string;
  client: string;
  contract: string;
  amount: number;
  due: string;
  paid: number;
  status: string;
  clientId?: number | null;
  contractId?: number | null;
  submittedAt?: string;
  followUpAt?: string;
  notes?: string;
};

export type PaymentRow = Row & {
  amount: number;
  paidAt: string;
  method: string;
  reference: string;
  contractId?: number | null;
  claimId?: number | null;
  clientId?: number | null;
  notes?: string;
};

export type PayableRow = Row & {
  ref: string;
  supplier: string;
  description: string;
  amount: number;
  paid: number;
  remaining: number;
  issueDate: string;
  dueDate: string;
  status: string;
  overdue: boolean;
  vehicleId?: number | null;
  maintenanceRequestId?: number | null;
  vehicleCategory?: string | null;
  receiptName?: string | null;
  receiptUrl?: string | null;
  hasReceipt?: boolean;
  payments: Array<{ id: number; amount: number; paidAt: string; method: string; reference: string }>;
};

export type EmployeeRow = Row & {
  employeeNo: string;
  name: string;
  nationalId: string;
  phone: string;
  email: string;
  department: string;
  jobTitle: string;
  hireDate: string;
  status: string;
  userId?: number | null;
  driverId?: number | null;
  notes?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowance?: number;
  contractType?: string;
  residencyExpiry?: string;
  insuranceExpiry?: string;
  shiftName?: string;
  shiftStart?: string;
  shiftEnd?: string;
  gracePeriodMinutes?: number;
};

export type PayrollRow = Row & {
  employeeId: number;
  employeeName: string;
  month: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "مسودة" | "معتمد" | "تم الصرف";
  paidAt?: string | null;
  notes?: string | null;
  createdAt?: string | Date;
};

export type LeaveRow = Row & {
  employeeId: number;
  employeeName: string;
  type: "سنوية" | "مرضية" | "طارئة" | "بدون راتب";
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: "قيد المراجعة" | "معتمدة" | "مرفوضة";
  approvedBy?: string | null;
  notes?: string | null;
  createdAt?: string | Date;
};

export type AttendanceRow = Row & {
  employeeId?: number | null;
  employeeName: string;
  employeeCode: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workHours?: number | null;
  delayMinutes?: number | null;
  earlyExitMinutes?: number | null;
  overtimeHours?: number | null;
  status: "حاضر" | "تأخير" | "غياب" | "إجازة" | "استئذان" | "عطلة";
  source: "جهاز بصمة" | "يدوي" | "تطبيق" | "ملف";
  deviceIp?: string | null;
  deviceName?: string | null;
  shiftName?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  notes?: string | null;
  createdAt?: string | Date;
};

export type BiometricDeviceRow = Row & {
  name: string;
  ip: string;
  port: number;
  commKey?: string | null;
  location?: string | null;
  model?: string | null;
  status: "متصل" | "غير متصل" | "جاري المزامنة";
  lastSyncAt?: string | Date | null;
  autoSync: number;
  notes?: string | null;
};

export type ImportConfig = {
  label: string;
  columns: { key: string; header: string; required?: boolean; hint?: string }[];
  mapRow: (raw: Record<string, string>) => Record<string, any>;
  sampleFilename: string;
};

export type VehicleInspectionRow = Row & {
  driverId?: number | null;
  driverName: string;
  vehicleId?: number | null;
  vehiclePlate: string;
  odometer: number;
  oilStatus: "سليم" | "ناقص" | "يحتاج تغيير";
  waterStatus: "سليم" | "ناقص";
  tiresStatus: "ممتاز" | "يحتاج هواء" | "متضرر";
  cleanlinessStatus: "نظيف" | "متوسط" | "يحتاج غسيل";
  lightsStatus: "سليم" | "عطلان";
  brakesStatus: "سليم" | "يحتاج فحص";
  acStatus: "سليم" | "ضعيف" | "عطلان";
  safetyKitStatus: "متوفر" | "ناقص";
  oilPhotoUrl?: string | null;
  waterPhotoUrl?: string | null;
  odometerPhotoUrl?: string | null;
  exteriorPhotoUrl?: string | null;
  hasIssue: number;
  issueSummary?: string | null;
  notes?: string | null;
  status: "جديد" | "تمت المراجعة" | "تم تحويله للصيانة";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | Date;
};

export type EmployeeRequestRow = Row & {
  employeeId?: number | null;
  driverId?: number | null;
  personName: string;
  personRole: "سائق" | "موظف";
  department?: string | null;
  requestType: "إجازة" | "نقل كفالة" | "خروج نهائي" | "خروج وعودة" | "سلفة راتب" | "تعريف بالراتب" | "أخرى";
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  days?: number | null;
  amount?: number | null;
  reason?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: "قيد المراجعة" | "معتمدة" | "مرفوضة" | "ملغاة";
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt?: string | Date;
};

export type ClientPortalRequestRow = Row & {
  requestType: string;
  clientType: "عميل جديد" | "عميل حالي" | string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string | null;
  city: string;
  busType?: string | null;
  busesCount: number;
  duration?: string | null;
  startDate?: string | null;
  workNature?: string | null;
  dailyEstimatedKm?: number | null;
  withDriver: number;
  withFuel: number;
  currentContractNo?: string | null;
  busPlateNumber?: string | null;
  driverName?: string | null;
  details?: string | null;
  status: "جديد" | "قيد التواصل" | "تم الاتفاق والتنفيذ" | "مرفوض" | "ملغى" | string;
  assignedTo?: string | null;
  responseNotes?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};
