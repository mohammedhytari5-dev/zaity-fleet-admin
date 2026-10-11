/**
 * Workforce Domain Model (Object-Oriented Architecture)
 * ----------------------------------------------------
 * Applies OOP principles (Encapsulation, Polymorphism, Abstraction, Inheritance)
 * to manage employees, drivers, compensations, payrolls, and compliance.
 */

import { formatCompanyDate, resolveRenewalStatus } from "./date-utils";

export type ComplianceUrgency = "expired" | "critical" | "warning" | "valid" | "unknown";
export type WorkforceStatus = "نشط" | "إجازة" | "في إجازة" | "موقوف" | "منتهي الخدمة" | "متاح" | "مشغول";
export type PayrollStatus = "مسودة" | "معتمد" | "تم الصرف";
export type LeaveStatus = "قيد المراجعة" | "معتمد" | "مرفوض";
export type LeaveType = "سنوية" | "مرضية" | "طارئة" | "بدون راتب";

/**
 * Value Object: SalaryCompensation
 * Encapsulates salary breakdown and gross calculations.
 */
export class SalaryCompensation {
  readonly basicSalary: number;
  readonly housingAllowance: number;
  readonly transportAllowance: number;
  readonly otherAllowance: number;

  constructor(
    basicSalary: number = 0,
    housingAllowance: number = 0,
    transportAllowance: number = 0,
    otherAllowance: number = 0
  ) {
    this.basicSalary = Math.max(0, Number(basicSalary || 0));
    this.housingAllowance = Math.max(0, Number(housingAllowance || 0));
    this.transportAllowance = Math.max(0, Number(transportAllowance || 0));
    this.otherAllowance = Math.max(0, Number(otherAllowance || 0));
  }

  get totalAllowances(): number {
    return this.housingAllowance + this.transportAllowance + this.otherAllowance;
  }

  get grossSalary(): number {
    return this.basicSalary + this.totalAllowances;
  }

  static fromRecord(record: {
    basicSalary?: number | null;
    housingAllowance?: number | null;
    transportAllowance?: number | null;
    otherAllowance?: number | null;
  }): SalaryCompensation {
    return new SalaryCompensation(
      record.basicSalary ?? 0,
      record.housingAllowance ?? 0,
      record.transportAllowance ?? 0,
      record.otherAllowance ?? 0
    );
  }

  toJSON() {
    return {
      basicSalary: this.basicSalary,
      housingAllowance: this.housingAllowance,
      transportAllowance: this.transportAllowance,
      otherAllowance: this.otherAllowance,
      totalAllowances: this.totalAllowances,
      grossSalary: this.grossSalary,
    };
  }
}

/**
 * Base Domain Entity: WorkforceMember
 * Encapsulates core workforce attributes, compliance queries, and search matching.
 */
export class WorkforceMember {
  readonly id: number;
  readonly employeeNo: string;
  readonly name: string;
  readonly nationalId: string;
  readonly phone: string;
  readonly email: string;
  readonly department: string;
  readonly jobTitle: string;
  readonly status: string;
  readonly hireDate: string;
  readonly contractType: string;
  readonly residencyExpiry: string;
  readonly insuranceExpiry: string;
  readonly userId: number | null;
  readonly notes?: string;
  readonly compensation: SalaryCompensation;

  constructor(props: {
    id: number;
    employeeNo: string;
    name: string;
    nationalId?: string;
    phone?: string;
    email?: string;
    department?: string;
    jobTitle?: string;
    status?: string;
    hireDate?: string;
    contractType?: string;
    residencyExpiry?: string;
    insuranceExpiry?: string;
    userId?: number | null;
    notes?: string;
    compensation?: SalaryCompensation;
  }) {
    this.id = props.id;
    this.employeeNo = props.employeeNo;
    this.name = props.name;
    this.nationalId = props.nationalId || "—";
    this.phone = props.phone || "—";
    this.email = props.email || "—";
    this.department = props.department || "الإدارة";
    this.jobTitle = props.jobTitle || "موظف";
    this.status = props.status || "نشط";
    this.hireDate = props.hireDate || "—";
    this.contractType = props.contractType || "دوام كامل";
    this.residencyExpiry = props.residencyExpiry || "—";
    this.insuranceExpiry = props.insuranceExpiry || "—";
    this.userId = props.userId ?? null;
    this.notes = props.notes;
    this.compensation = props.compensation || new SalaryCompensation();
  }

  /**
   * Polymorphic indicator overridden by DriverWorkforceMember
   */
  isDriver(): boolean {
    return Boolean(this.jobTitle?.includes("سائق"));
  }

  isActive(): boolean {
    return this.status === "نشط" || this.status === "متاح" || this.status === "مشغول";
  }

  isArchived(): boolean {
    return this.status === "منتهي الخدمة" || this.status === "موقوف";
  }

  daysUntilResidencyExpiry(asOf: Date = new Date()): number | null {
    if (!this.residencyExpiry || this.residencyExpiry === "—") return null;
    const expiryTime = new Date(this.residencyExpiry).getTime();
    if (isNaN(expiryTime)) return null;
    return Math.ceil((expiryTime - asOf.getTime()) / (1000 * 60 * 60 * 24));
  }

  getResidencyUrgency(asOf: Date = new Date()): ComplianceUrgency {
    const days = this.daysUntilResidencyExpiry(asOf);
    if (days === null) return "unknown";
    if (days <= 0) return "expired";
    if (days <= 30) return "critical";
    if (days <= 60) return "warning";
    return "valid";
  }

  getResidencyBadge(asOf: Date = new Date()): { label: string; tone: "critical" | "warning" | "success" | "neutral" } {
    const urgency = this.getResidencyUrgency(asOf);
    const days = this.daysUntilResidencyExpiry(asOf);

    switch (urgency) {
      case "expired":
        return { label: `منتهية منذ ${Math.abs(days || 0)} يوم`, tone: "critical" };
      case "critical":
        return { label: `تنتهي خلال ${days} يوم ⚠️`, tone: "critical" };
      case "warning":
        return { label: `تنتهي خلال ${days} يوم`, tone: "warning" };
      case "valid":
        return { label: `سارية (${days} يوم)`, tone: "success" };
      default:
        return { label: "غير محدد", tone: "neutral" };
    }
  }

  matchesSearch(term: string): boolean {
    if (!term || !term.trim()) return true;
    const q = term.toLowerCase().trim();
    return (
      this.name.toLowerCase().includes(q) ||
      this.employeeNo.toLowerCase().includes(q) ||
      this.nationalId.toLowerCase().includes(q) ||
      this.phone.toLowerCase().includes(q) ||
      this.department.toLowerCase().includes(q) ||
      this.jobTitle.toLowerCase().includes(q)
    );
  }
}

/**
 * Derived Domain Entity: DriverWorkforceMember
 * Implements Polymorphism & Inheritance for fleet drivers with specialized attributes.
 */
export class DriverWorkforceMember extends WorkforceMember {
  readonly driverId: number;
  readonly licenseNumber: string;
  readonly licenseType: string;
  readonly licenseRenewal: string;
  readonly assignedVehicleId: number | null;
  readonly assignedVehiclePlate: string | null;
  readonly isSyntheticDriver: boolean;

  constructor(props: {
    id: number;
    employeeNo: string;
    name: string;
    nationalId?: string;
    phone?: string;
    email?: string;
    department?: string;
    jobTitle?: string;
    status?: string;
    hireDate?: string;
    contractType?: string;
    residencyExpiry?: string;
    insuranceExpiry?: string;
    userId?: number | null;
    notes?: string;
    compensation?: SalaryCompensation;
    driverId: number;
    licenseNumber?: string;
    licenseType?: string;
    licenseRenewal?: string;
    assignedVehicleId?: number | null;
    assignedVehiclePlate?: string | null;
    isSyntheticDriver?: boolean;
  }) {
    super(props);
    this.driverId = props.driverId;
    this.licenseNumber = props.licenseNumber || props.nationalId || "—";
    this.licenseType = props.licenseType || "خصوصي";
    this.licenseRenewal = props.licenseRenewal || "—";
    this.assignedVehicleId = props.assignedVehicleId ?? null;
    this.assignedVehiclePlate = props.assignedVehiclePlate ?? null;
    this.isSyntheticDriver = Boolean(props.isSyntheticDriver);
  }

  override isDriver(): boolean {
    return true;
  }

  hasVehicle(): boolean {
    return Boolean(this.assignedVehicleId || (this.assignedVehiclePlate && this.assignedVehiclePlate !== "—"));
  }

  daysUntilLicenseExpiry(asOf: Date = new Date()): number | null {
    if (!this.licenseRenewal || this.licenseRenewal === "—") return null;
    const expiryTime = new Date(this.licenseRenewal).getTime();
    if (isNaN(expiryTime)) return null;
    return Math.ceil((expiryTime - asOf.getTime()) / (1000 * 60 * 60 * 24));
  }

  getLicenseUrgency(asOf: Date = new Date()): ComplianceUrgency {
    const days = this.daysUntilLicenseExpiry(asOf);
    if (days === null) {
      const standardStatus = resolveRenewalStatus(this.licenseRenewal);
      if (standardStatus === "منتهية") return "expired";
      if (standardStatus === "قريبة") return "warning";
      if (standardStatus === "سارية") return "valid";
      return "unknown";
    }
    if (days <= 0) return "expired";
    if (days <= 30) return "critical";
    if (days <= 60) return "warning";
    return "valid";
  }

  getLicenseBadge(asOf: Date = new Date()): { label: string; tone: "critical" | "warning" | "success" | "neutral" } {
    const urgency = this.getLicenseUrgency(asOf);
    const days = this.daysUntilLicenseExpiry(asOf);

    switch (urgency) {
      case "expired":
        return { label: `رخصة منتهية (${Math.abs(days || 0)} يوم)`, tone: "critical" };
      case "critical":
        return { label: `رخصة تنتهي قريباً (${days} يوم) ⚠️`, tone: "critical" };
      case "warning":
        return { label: `رخصة تنتهي (${days} يوم)`, tone: "warning" };
      case "valid":
        return { label: `رخصة سارية (${days ?? ""} يوم)`, tone: "success" };
      default:
        return { label: "رخصة سارية", tone: "neutral" };
    }
  }

  override matchesSearch(term: string): boolean {
    if (super.matchesSearch(term)) return true;
    if (!term || !term.trim()) return true;
    const q = term.toLowerCase().trim();
    return (
      (this.assignedVehiclePlate?.toLowerCase().includes(q) ?? false) ||
      this.licenseType.toLowerCase().includes(q) ||
      this.licenseNumber.toLowerCase().includes(q)
    );
  }
}

/**
 * Factory Pattern: WorkforceFactory
 * Instantiates the appropriate domain subclass polymorphically.
 */
export class WorkforceFactory {
  static create(
    rawEmployee: any,
    matchedDriver?: any,
    matchedVehicle?: any
  ): WorkforceMember | DriverWorkforceMember {
    const comp = SalaryCompensation.fromRecord(rawEmployee);
    const isDriver = Boolean(rawEmployee.driverId || matchedDriver || rawEmployee.jobTitle?.includes("سائق"));

    if (isDriver) {
      return new DriverWorkforceMember({
        id: rawEmployee.id,
        employeeNo: rawEmployee.employeeNo || `EMP-${rawEmployee.id}`,
        name: rawEmployee.name,
        nationalId: rawEmployee.nationalId || matchedDriver?.idNo,
        phone: rawEmployee.phone || matchedDriver?.phone,
        email: rawEmployee.email,
        department: rawEmployee.department || "الحركة والأسطول",
        jobTitle: rawEmployee.jobTitle || "سائق أسطول",
        status: rawEmployee.status,
        hireDate: rawEmployee.hireDate,
        contractType: rawEmployee.contractType,
        residencyExpiry: rawEmployee.residencyExpiry,
        insuranceExpiry: rawEmployee.insuranceExpiry,
        userId: rawEmployee.userId,
        notes: rawEmployee.notes,
        compensation: comp,
        driverId: rawEmployee.driverId || matchedDriver?.id || 0,
        licenseNumber: matchedDriver?.idNo || rawEmployee.nationalId,
        licenseType: matchedDriver?.license || "خصوصي",
        licenseRenewal: matchedDriver?.renewal || "—",
        assignedVehicleId: matchedVehicle?.id ?? matchedDriver?.vehicleId ?? null,
        assignedVehiclePlate: matchedVehicle?.plate ?? matchedDriver?.vehicle ?? null,
        isSyntheticDriver: Boolean(rawEmployee.isSyntheticDriver),
      });
    }

    return new WorkforceMember({
      id: rawEmployee.id,
      employeeNo: rawEmployee.employeeNo || `EMP-${rawEmployee.id}`,
      name: rawEmployee.name,
      nationalId: rawEmployee.nationalId,
      phone: rawEmployee.phone,
      email: rawEmployee.email,
      department: rawEmployee.department,
      jobTitle: rawEmployee.jobTitle,
      status: rawEmployee.status,
      hireDate: rawEmployee.hireDate,
      contractType: rawEmployee.contractType,
      residencyExpiry: rawEmployee.residencyExpiry,
      insuranceExpiry: rawEmployee.insuranceExpiry,
      userId: rawEmployee.userId,
      notes: rawEmployee.notes,
      compensation: comp,
    });
  }

  static createSyntheticDriver(
    driver: any,
    matchedVehicle?: any
  ): DriverWorkforceMember {
    return new DriverWorkforceMember({
      id: -driver.id,
      employeeNo: `DRV-${driver.id.toString().padStart(4, "0")}`,
      name: driver.name,
      nationalId: driver.idNo || "—",
      phone: driver.phone || "—",
      email: "—",
      department: "الحركة والأسطول",
      jobTitle: "سائق أسطول",
      status: driver.status === "موقوف" ? "موقوف" : "نشط",
      hireDate: "—",
      contractType: "دوام كامل",
      residencyExpiry: "—",
      insuranceExpiry: "—",
      userId: null,
      compensation: new SalaryCompensation(0, 0, 0, 0),
      driverId: driver.id,
      licenseNumber: driver.idNo || "—",
      licenseType: driver.license || "خصوصي",
      licenseRenewal: driver.renewal || "—",
      assignedVehicleId: matchedVehicle?.id ?? driver.vehicleId ?? null,
      assignedVehiclePlate: matchedVehicle?.plate ?? driver.vehicle ?? null,
      isSyntheticDriver: true,
    });
  }
}

/**
 * Domain Entity: PayrollRecord
 * Encapsulates payroll item calculations and state rules.
 */
export class PayrollRecord {
  readonly id: number;
  readonly employeeId: number;
  readonly employeeName: string;
  readonly employeeNo: string;
  readonly month: string;
  readonly basicSalary: number;
  readonly allowances: number;
  readonly deductions: number;
  readonly netSalary: number;
  readonly status: PayrollStatus;
  readonly paymentDate?: string | null;
  readonly paymentMethod?: string | null;
  readonly notes?: string | null;

  constructor(props: {
    id: number;
    employeeId: number;
    employeeName: string;
    employeeNo?: string;
    month: string;
    basicSalary: number;
    allowances: number;
    deductions: number;
    netSalary?: number;
    status: PayrollStatus;
    paymentDate?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
  }) {
    this.id = props.id;
    this.employeeId = props.employeeId;
    this.employeeName = props.employeeName;
    this.employeeNo = props.employeeNo || `EMP-${props.employeeId}`;
    this.month = props.month;
    this.basicSalary = Number(props.basicSalary || 0);
    this.allowances = Number(props.allowances || 0);
    this.deductions = Number(props.deductions || 0);
    this.netSalary = props.netSalary !== undefined
      ? Number(props.netSalary)
      : this.calculateNet();
    this.status = props.status;
    this.paymentDate = props.paymentDate;
    this.paymentMethod = props.paymentMethod;
    this.notes = props.notes;
  }

  calculateNet(): number {
    return Math.max(0, this.basicSalary + this.allowances - this.deductions);
  }

  isPaid(): boolean {
    return this.status === "تم الصرف";
  }

  isDraft(): boolean {
    return this.status === "مسودة";
  }

  isApproved(): boolean {
    return this.status === "معتمد";
  }

  getStatusBadge(): { label: string; tone: "success" | "info" | "neutral" } {
    switch (this.status) {
      case "تم الصرف":
        return { label: "تم الصرف", tone: "success" };
      case "معتمد":
        return { label: "معتمد", tone: "info" };
      default:
        return { label: "مسودة", tone: "neutral" };
    }
  }
}

/**
 * Domain Entity: LeaveRecord
 * Encapsulates employee leave request lifecycle.
 */
export class LeaveRecord {
  readonly id: number;
  readonly employeeId: number;
  readonly employeeName: string;
  readonly type: LeaveType;
  readonly startDate: string;
  readonly endDate: string;
  readonly days: number;
  readonly reason?: string | null;
  readonly status: LeaveStatus;

  constructor(props: {
    id: number;
    employeeId: number;
    employeeName: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    days: number;
    reason?: string | null;
    status: LeaveStatus;
  }) {
    this.id = props.id;
    this.employeeId = props.employeeId;
    this.employeeName = props.employeeName;
    this.type = props.type;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.days = props.days;
    this.reason = props.reason;
    this.status = props.status;
  }

  isPending(): boolean {
    return this.status === "قيد المراجعة";
  }

  isApproved(): boolean {
    return this.status === "معتمد";
  }

  isRejected(): boolean {
    return this.status === "مرفوض";
  }

  getStatusBadge(): { label: string; tone: "warning" | "success" | "critical" } {
    switch (this.status) {
      case "معتمد":
        return { label: "معتمد", tone: "success" };
      case "مرفوض":
        return { label: "مرفوض", tone: "critical" };
      default:
        return { label: "قيد المراجعة", tone: "warning" };
    }
  }
}

/**
 * Domain Service: WorkforceComplianceInspector
 * Aggregates and inspects compliance across all workforce members.
 */
export class WorkforceComplianceInspector {
  static inspect(members: WorkforceMember[], asOf: Date = new Date()) {
    const criticalResidencies: WorkforceMember[] = [];
    const warningResidencies: WorkforceMember[] = [];
    const criticalLicenses: DriverWorkforceMember[] = [];
    const warningLicenses: DriverWorkforceMember[] = [];

    for (const member of members) {
      const resUrgency = member.getResidencyUrgency(asOf);
      if (resUrgency === "expired" || resUrgency === "critical") {
        criticalResidencies.push(member);
      } else if (resUrgency === "warning") {
        warningResidencies.push(member);
      }

      if (member instanceof DriverWorkforceMember) {
        const licUrgency = member.getLicenseUrgency(asOf);
        if (licUrgency === "expired" || licUrgency === "critical") {
          criticalLicenses.push(member);
        } else if (licUrgency === "warning") {
          warningLicenses.push(member);
        }
      }
    }

    return {
      criticalResidencies,
      warningResidencies,
      criticalLicenses,
      warningLicenses,
      totalIssuesCount:
        criticalResidencies.length +
        warningResidencies.length +
        criticalLicenses.length +
        warningLicenses.length,
    };
  }
}

/**
 * Domain Service: PayrollAuditService
 * Aggregates statistics and financial metrics for a payroll batch.
 */
export class PayrollAuditService {
  static calculateTotals(records: PayrollRecord[]) {
    let totalNet = 0;
    let totalBasic = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let paidCount = 0;
    let approvedCount = 0;
    let draftCount = 0;

    for (const r of records) {
      totalNet += r.netSalary;
      totalBasic += r.basicSalary;
      totalAllowances += r.allowances;
      totalDeductions += r.deductions;
      if (r.isPaid()) paidCount++;
      else if (r.isApproved()) approvedCount++;
      else draftCount++;
    }

    return {
      totalCount: records.length,
      totalNet,
      totalBasic,
      totalAllowances,
      totalDeductions,
      paidCount,
      approvedCount,
      draftCount,
    };
  }
}
