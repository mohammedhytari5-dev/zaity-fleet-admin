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
  | "inventory"
  | "reports"
  | "settings";

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
  notes?: string;
};

export type ImportConfig = {
  label: string;
  columns: { key: string; header: string; required?: boolean; hint?: string }[];
  mapRow: (raw: Record<string, string>) => Record<string, any>;
  sampleFilename: string;
};
