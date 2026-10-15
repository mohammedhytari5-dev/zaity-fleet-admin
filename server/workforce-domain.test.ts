import { describe, expect, it } from "vitest";
import {
  SalaryCompensation,
  WorkforceMember,
  DriverWorkforceMember,
  WorkforceFactory,
  PayrollRecord,
  LeaveRecord,
  WorkforceComplianceInspector,
  PayrollAuditService,
} from "@shared/workforce-domain";

describe("SalaryCompensation (Value Object)", () => {
  it("encapsulates allowances and computes gross salary correctly", () => {
    const comp = new SalaryCompensation(5000, 1000, 500, 300);
    expect(comp.basicSalary).toBe(5000);
    expect(comp.housingAllowance).toBe(1000);
    expect(comp.transportAllowance).toBe(500);
    expect(comp.otherAllowance).toBe(300);
    expect(comp.totalAllowances).toBe(1800);
    expect(comp.grossSalary).toBe(6800);
  });

  it("handles empty or negative inputs gracefully", () => {
    const comp = new SalaryCompensation(-100, 0, undefined as any);
    expect(comp.basicSalary).toBe(0);
    expect(comp.totalAllowances).toBe(0);
    expect(comp.grossSalary).toBe(0);
  });
});

describe("WorkforceMember & DriverWorkforceMember (OOP & Polymorphism)", () => {
  it("creates standard workforce member and evaluates methods correctly", () => {
    const emp = new WorkforceMember({
      id: 1,
      employeeNo: "EMP-001",
      name: "أحمد المهندس",
      department: "الهندسة",
      jobTitle: "مهندس برمجيات",
      status: "نشط",
      residencyExpiry: "2026-12-01",
      compensation: new SalaryCompensation(9000, 2000, 1000, 0),
    });

    expect(emp.isDriver()).toBe(false);
    expect(emp.isActive()).toBe(true);
    expect(emp.isArchived()).toBe(false);
    expect(emp.compensation.grossSalary).toBe(12000);
    expect(emp.matchesSearch("أحمد")).toBe(true);
    expect(emp.matchesSearch("سائق")).toBe(false);
  });

  it("implements polymorphic behavior for DriverWorkforceMember", () => {
    const driver = new DriverWorkforceMember({
      id: 2,
      employeeNo: "EMP-002",
      name: "سالم السائق",
      jobTitle: "سائق أسطول",
      status: "نشط",
      driverId: 88,
      licenseType: "عمومي",
      licenseRenewal: "2026-11-15",
      assignedVehiclePlate: "أ ب ج 1234",
    });

    // Polymorphism: isDriver() returns true for DriverWorkforceMember
    expect(driver.isDriver()).toBe(true);
    expect(driver.hasVehicle()).toBe(true);
    expect(driver.matchesSearch("1234")).toBe(true);
    expect(driver.matchesSearch("عمومي")).toBe(true);
    expect(driver.getLicenseBadge()).toBeDefined();
  });

  it("creates instances via WorkforceFactory", () => {
    const regular = WorkforceFactory.create({
      id: 10,
      name: "خالد المحاسب",
      jobTitle: "محاسب",
      basicSalary: 6000,
    });
    expect(regular instanceof WorkforceMember).toBe(true);
    expect(regular instanceof DriverWorkforceMember).toBe(false);
    expect(regular.isDriver()).toBe(false);

    const driverMember = WorkforceFactory.create(
      { id: 11, name: "عمر الكابتن", jobTitle: "سائق توصيل" },
      { id: 99, license: "نقل ثقيل", renewal: "2026-10-30" },
      { id: 50, plate: "ط ط ط 9999" }
    );
    expect(driverMember instanceof DriverWorkforceMember).toBe(true);
    expect(driverMember.isDriver()).toBe(true);
    expect((driverMember as DriverWorkforceMember).assignedVehiclePlate).toBe("ط ط ط 9999");
  });
});

describe("PayrollRecord & PayrollAuditService", () => {
  it("calculates net salary and status correctly", () => {
    const record = new PayrollRecord({
      id: 1,
      employeeId: 101,
      employeeName: "فهد العتيبي",
      month: "10-2026",
      basicSalary: 5000,
      allowances: 1500,
      deductions: 500,
      status: "معتمد",
    });

    expect(record.calculateNet()).toBe(6000);
    expect(record.isPaid()).toBe(false);
    expect(record.isApproved()).toBe(true);
    expect(record.getStatusBadge().tone).toBe("info");
  });

  it("audits payroll batch totals correctly", () => {
    const p1 = new PayrollRecord({
      id: 1,
      employeeId: 1,
      employeeName: "سالم",
      month: "10-2026",
      basicSalary: 4000,
      allowances: 1000,
      deductions: 200,
      status: "تم الصرف",
    });
    const p2 = new PayrollRecord({
      id: 2,
      employeeId: 2,
      employeeName: "ماجد",
      month: "10-2026",
      basicSalary: 6000,
      allowances: 2000,
      deductions: 500,
      status: "مسودة",
    });

    const totals = PayrollAuditService.calculateTotals([p1, p2]);
    expect(totals.totalCount).toBe(2);
    expect(totals.totalBasic).toBe(10000);
    expect(totals.totalAllowances).toBe(3000);
    expect(totals.totalDeductions).toBe(700);
    expect(totals.totalNet).toBe(12300);
    expect(totals.paidCount).toBe(1);
    expect(totals.draftCount).toBe(1);
  });
});

describe("WorkforceComplianceInspector", () => {
  it("categorizes critical and warning document expirations", () => {
    const today = new Date("2026-10-15");
    const expiringSoonMember = new WorkforceMember({
      id: 1,
      employeeNo: "E1",
      name: "منتهي قريبا",
      residencyExpiry: "2026-10-25", // 10 days away -> critical
    });
    const safeMember = new WorkforceMember({
      id: 2,
      employeeNo: "E2",
      name: "ساري",
      residencyExpiry: "2027-05-01", // safe
    });

    const report = WorkforceComplianceInspector.inspect([expiringSoonMember, safeMember], today);
    expect(report.criticalResidencies).toHaveLength(1);
    expect(report.criticalResidencies[0].name).toBe("منتهي قريبا");
    expect(report.warningResidencies).toHaveLength(0);
  });
});

describe("LeaveRecord (Leave Management Domain)", () => {
  it("recognizes approved and rejected statuses in both masculine and feminine forms", () => {
    const leaveApprovedFeminine = new LeaveRecord({
      id: 1,
      employeeId: 10,
      employeeName: "خالد",
      type: "سنوية",
      startDate: "2026-10-01",
      endDate: "2026-10-10",
      days: 10,
      status: "معتمدة",
    });
    expect(leaveApprovedFeminine.isApproved()).toBe(true);
    expect(leaveApprovedFeminine.isRejected()).toBe(false);
    expect(leaveApprovedFeminine.isPending()).toBe(false);
    expect(leaveApprovedFeminine.getStatusBadge().tone).toBe("success");

    const leaveApprovedMasculine = new LeaveRecord({
      id: 2,
      employeeId: 11,
      employeeName: "سالم",
      type: "مرضية",
      startDate: "2026-10-05",
      endDate: "2026-10-07",
      days: 3,
      status: "معتمد",
    });
    expect(leaveApprovedMasculine.isApproved()).toBe(true);
    expect(leaveApprovedMasculine.getStatusBadge().tone).toBe("success");

    const leaveRejectedFeminine = new LeaveRecord({
      id: 3,
      employeeId: 12,
      employeeName: "عمر",
      type: "طارئة",
      startDate: "2026-10-08",
      endDate: "2026-10-09",
      days: 2,
      status: "مرفوضة",
    });
    expect(leaveRejectedFeminine.isRejected()).toBe(true);
    expect(leaveRejectedFeminine.isApproved()).toBe(false);
    expect(leaveRejectedFeminine.getStatusBadge().tone).toBe("critical");

    const leavePending = new LeaveRecord({
      id: 4,
      employeeId: 13,
      employeeName: "ياسر",
      type: "سنوية",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      days: 5,
      status: "قيد المراجعة",
    });
    expect(leavePending.isPending()).toBe(true);
    expect(leavePending.isApproved()).toBe(false);
    expect(leavePending.isRejected()).toBe(false);
    expect(leavePending.getStatusBadge().tone).toBe("warning");
  });
});

