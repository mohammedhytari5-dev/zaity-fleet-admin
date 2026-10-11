import { describe, expect, it } from "vitest";
import { scopeCompanyReport } from "./report-access";

const report = {
  period: { from: "2026-10-01", to: "2026-10-07" },
  fleet: { total: 12, working: 8 },
  finance: { receivableOutstanding: 9500, payablesOutstanding: 1200, payablesPendingApproval: 1, payablesPendingApprovalAmount: 600, overduePayables: 1, outgoingInPeriod: 400, vehicleCostsInPeriod: 700, allocatedVehicleRevenueInPeriod: 1100, fleetVehicleNetInPeriod: 400 },
  maintenance: { openNow: 3, costInPeriod: 700 },
  projects: { activeNow: 4, assignedVehicles: 8 },
  documents: { expiredNow: 2 },
  people: { employees: 10, activeEmployees: 9, drivers: 5, availableDrivers: 3 },
  inventory: { itemCount: 20, lowStockCount: 3, emptyStockCount: 1, receivedMovements: 12, issuedMovements: 8 },
  accidents: { reportedInPeriod: 2, openNow: 1, estimatedRepairCostInPeriod: 5000, settlementAmountInPeriod: 2500 },
  taskSummary: { dueInPeriod: 5, completedInPeriod: 2, openInPeriod: 3, overdueNow: 1 },
  details: {
    payments: [{ id: 2, paidAt: "2026-10-03", clientId: 7, client: "عميل سري", contract: "CN-4", claim: "CL-8", amount: 300, method: "تحويل بنكي", reference: "TX-8" }],
    receivablesAging: [{ id: 8, ref: "CL-8", client: "Client A", status: "New", amount: 1000, paid: 200, outstanding: 800, due: "2026-09-01", daysOverdue: 36, agingBucket: "31–60 يوم" }],
    claims: [{ id: 1, amount: 9500, clientId: 7, client: "عميل سري" }],
    contracts: [{ id: 2, total: 20000, clientId: 7, client: "عميل سري" }],
    payables: [
      { id: 3, amount: 1200 },
      { id: 31, amount: 500, vehicleId: 12, maintenanceRequestId: null },
      { id: 32, amount: 300, vehicleId: null, maintenanceRequestId: 4 },
    ],
    payableSummaryRows: [
      { id: 3, remainingNow: 1200, paidInPeriod: 400, overdue: true },
      { id: 31, remainingNow: 500, paidInPeriod: 10, overdue: true, vehicleId: 12, maintenanceRequestId: null },
      { id: 32, remainingNow: 300, paidInPeriod: 20, overdue: true, vehicleId: null, maintenanceRequestId: 4 },
      { id: 4, remainingNow: 0, pendingApproval: true, pendingApprovalAmount: 600, paidInPeriod: 0, overdue: false },
    ],
    documentSummaryRows: [
      { entityType: "مركبة", entityId: 12, expiringInPeriod: true, expiredNow: true, expiringNext30Days: false },
      { entityType: "عقد", entityId: 2, expiringInPeriod: true, expiredNow: true, expiringNext30Days: false },
      { entityType: "", entityId: null, expiringInPeriod: false, expiredNow: false, expiringNext30Days: true },
    ],
    documents: [
      { id: 1, name: "استمارة", entityType: "مركبة", entityId: 12, hasFile: true, fileUrl: "private-object-key" },
      { id: 2, name: "عقد", entityType: "عقد", entityId: 2, hasFile: false },
      { id: 3, name: "غير مصنف", entityType: "جهة غير معروفة", entityId: 3, hasFile: false },
      { id: 4, name: "مستند عام", entityType: "", entityId: null, hasFile: false },
    ],
    vehicleProfitability: [{ plate: "1234", expense: 700 }],
    projectProfitability: [{ name: "مشروع سري", revenue: 5000 }],
    clientProfitability: [{ name: "عميل سري", revenue: 5000 }],
    maintenance: [{ id: 4, vehicleId: 12, vehicle: "1234", status: "تنفيذ", cost: "700 SAR" }],
    employees: [{ id: 41, employeeNo: "EMP-41", name: "Employee", department: "Operations", jobTitle: "Supervisor", hireDate: "2026-01-01", status: "Active" }],
    drivers: [{ id: 51, name: "Driver", status: "Available", vehicle: "1234", renewal: "2026-12-01" }],
    inventoryMovements: [{ id: 101, direction: "صرف", quantity: 2, itemName: "فلتر" }],
    accidents: [{ id: 61, ref: "AC-61", vehiclePlate: "1234", estimatedRepairCost: 5000, settlementAmount: 2500 }],
    tasks: [{ id: 71, title: "تجهيز المركبة", assignee: "موظف", dueAt: "2026-10-07", status: "مفتوحة" }],
    operatingExpenses: [
      { id: 10, vehicleId: 12, vehicle: "1234", category: "وقود", amount: 100, projectId: 5, projectName: "مشروع سري", clientId: 7, clientName: "عميل سري", maintenanceRequestId: null, payableId: null },
      { id: 11, vehicleId: 12, vehicle: "1234", category: "صيانة", amount: 200, projectId: 5, projectName: "مشروع سري", clientId: 7, clientName: "عميل سري", maintenanceRequestId: null, payableId: 31, payableVehicleId: 12, payableMaintenanceRequestId: null },
      { id: 12, vehicleId: 12, vehicle: "1234", category: "صيانة", amount: 300, projectId: 5, projectName: "مشروع سري", clientId: 7, clientName: "عميل سري", maintenanceRequestId: 4, payableId: 32, payableVehicleId: null, payableMaintenanceRequestId: 4 },
    ],
  },
};

describe("report data access", () => {
  it("returns only explicitly scoped report sections", () => {
    const reportWithUnreviewedSection = {
      ...report,
      details: { ...report.details, futureInternalData: [{ secret: "must not be exposed" }] },
    };
    const result = scopeCompanyReport(reportWithUnreviewedSection, ["reports", "finance"]);

    expect(result.details).not.toHaveProperty("futureInternalData");
    expect(result.details).not.toHaveProperty("payableSummaryRows");
    expect(result.details).not.toHaveProperty("documentSummaryRows");
  });

  it("does not expose finance or maintenance costs to a reports-only user", () => {
    const result = scopeCompanyReport(report, ["reports"]);
    expect(result.finance).toEqual({
      receivableOutstanding: 0,
      payablesOutstanding: 0,
      payablesPendingApproval: 0,
      payablesPendingApprovalAmount: 0,
      overduePayables: 0,
      outgoingInPeriod: 0,
      vehicleCostsInPeriod: 0,
      allocatedVehicleRevenueInPeriod: 0,
      fleetVehicleNetInPeriod: 0,
    });
    expect(result.details.claims).toEqual([]);
    expect(result.details.payments).toEqual([]);
    expect(result.details.receivablesAging).toEqual([]);
    expect(result.details.payables).toEqual([]);
    expect(result.details.maintenance).toEqual([]);
    expect(result.maintenance.costInPeriod).toBe(0);
    expect(result.inventory).toEqual({ itemCount: 0, lowStockCount: 0, emptyStockCount: 0, receivedMovements: 0, issuedMovements: 0 });
    expect(result.details.inventoryMovements).toEqual([]);
    expect(result.accidents).toEqual({ reportedInPeriod: 0, openNow: 0, estimatedRepairCostInPeriod: 0, settlementAmountInPeriod: 0 });
    expect(result.details.accidents).toEqual([]);
    expect(result.taskSummary).toEqual({ dueInPeriod: 0, completedInPeriod: 0, openInPeriod: 0, overdueNow: 0 });
    expect(result.details.tasks).toEqual([]);
  });

  it("scopes each report section to its module and strips costs without finance permission", () => {
    const result = scopeCompanyReport(report, ["reports", "maintenance", "vehicles", "employees"]);
    expect(result.fleet.total).toBe(12);
    expect(result.maintenance.openNow).toBe(3);
    expect(result.maintenance.costInPeriod).toBe(0);
    expect(result.details.maintenance[0]).toEqual({ id: 4, vehicleId: 12, vehicle: "1234", status: "تنفيذ" });
    expect(result.projects.activeNow).toBe(0);
    expect(result.people.activeEmployees).toBe(9);
    expect(result.people.drivers).toBe(0);
  });

  it("returns financial detail only when finance permission is present", () => {
    const result = scopeCompanyReport(report, ["reports", "finance"]);
    expect(result.finance.receivableOutstanding).toBe(9500);
    expect(result.details.claims).toHaveLength(1);
    expect(result.details.claims[0]).toMatchObject({ client: "—", clientId: null });
    expect(result.details.payments[0]).toMatchObject({ client: "—", clientId: null, amount: 300, reference: "TX-8" });
    expect(result.details.receivablesAging[0]).toMatchObject({ client: "—", outstanding: 800, agingBucket: "31–60 يوم" });
    expect(result.finance.payablesOutstanding).toBe(0);
    expect(result.finance.overduePayables).toBe(0);
    expect(result.finance.outgoingInPeriod).toBe(0);
    expect(result.finance.vehicleCostsInPeriod).toBe(0);
    expect(result.finance.allocatedVehicleRevenueInPeriod).toBe(0);
    expect(result.finance.fleetVehicleNetInPeriod).toBe(0);
    expect(result.details.payables).toEqual([]);
    expect(result.details.maintenance).toEqual([]);
  });

  it("scopes profitability details to their operational modules", () => {
    const result = scopeCompanyReport(report, ["reports", "finance", "vehicles", "clients", "payables"]);
    expect(result.details.vehicleProfitability).toHaveLength(1);
    expect(result.details.clientProfitability).toHaveLength(1);
    expect(result.details.projectProfitability).toEqual([]);
    expect(result.details.payables.map((row: any) => row.id)).toEqual([3, 31]);
    expect(result.details.payables[1]).not.toHaveProperty("vehicleId");
    expect(result.finance.payablesOutstanding).toBe(1700);
    expect(result.finance.payablesPendingApproval).toBe(1);
    expect(result.finance.payablesPendingApprovalAmount).toBe(600);
    expect(result.finance.overduePayables).toBe(2);
    expect(result.finance.outgoingInPeriod).toBe(410);
  });

  it("scopes the detailed operating expense ledger to finance, vehicle, payable, and maintenance permissions", () => {
    const vehicleFinance = scopeCompanyReport(report, ["reports", "finance", "vehicles"]);
    expect(vehicleFinance.details.operatingExpenses.map((row: any) => row.id)).toEqual([10]);
    expect(vehicleFinance.details.operatingExpenses[0]).toMatchObject({ vehicle: "1234", clientName: "—", projectName: "—" });

    const financeWithPayables = scopeCompanyReport(report, ["reports", "finance", "vehicles", "payables"]);
    expect(financeWithPayables.details.operatingExpenses.map((row: any) => row.id)).toEqual([10, 11]);
    expect(financeWithPayables.details.operatingExpenses[1]).not.toHaveProperty("payableId");

    const allRelevantModules = scopeCompanyReport(report, ["reports", "finance", "vehicles", "payables", "maintenance", "projects", "clients"]);
    expect(allRelevantModules.details.operatingExpenses.map((row: any) => row.id)).toEqual([10, 11, 12]);
    expect(allRelevantModules.details.operatingExpenses[2]).toMatchObject({ clientName: "عميل سري", projectName: "مشروع سري", maintenanceRequestId: 4 });
  });

  it("allows payables-only users to see general bills but not linked bills or finance totals", () => {
    const result = scopeCompanyReport(report, ["reports", "payables"]);
    expect(result.finance.receivableOutstanding).toBe(0);
    expect(result.finance.payablesOutstanding).toBe(1200);
    expect(result.finance.payablesPendingApproval).toBe(1);
    expect(result.finance.payablesPendingApprovalAmount).toBe(600);
    expect(result.finance.outgoingInPeriod).toBe(400);
    expect(result.finance.overduePayables).toBe(1);
    expect(result.details.payables).toEqual([{ id: 3, amount: 1200 }]);
  });

  it("scopes document expiry totals to linked modules and hides internal summary rows", () => {
    const result = scopeCompanyReport(report, ["reports", "documents", "vehicles"]);
    expect(result.documents).toEqual({ expiringInPeriod: 1, expiredNow: 1, expiringNext30Days: 1 });
    expect(result.details).not.toHaveProperty("documentSummaryRows");
    expect(result.details.documents.map((row: any) => row.id)).toEqual([1, 4]);
    expect(result.details.documents[0]).not.toHaveProperty("entityId");
    expect(result.details.documents[0]).not.toHaveProperty("fileUrl");
    expect(scopeCompanyReport(report, ["reports"]).details.documents).toEqual([]);
  });

  it("does not reveal assigned vehicle counts to project-only users", () => {
    const result = scopeCompanyReport(report, ["reports", "projects"]);
    expect(result.projects.activeNow).toBe(4);
    expect(result.projects.assignedVehicles).toBe(0);
  });

  it("exposes people report rows only to their matching HR modules", () => {
    const employeeOnly = scopeCompanyReport(report, ["reports", "employees"]);
    expect(employeeOnly.details.employees).toHaveLength(1);
    expect(employeeOnly.details.drivers).toEqual([]);
    const driverOnly = scopeCompanyReport(report, ["reports", "drivers"]);
    expect(driverOnly.details.employees).toEqual([]);
    expect(driverOnly.details.drivers).toHaveLength(1);
    const reportsOnly = scopeCompanyReport(report, ["reports"]);
    expect(reportsOnly.details.employees).toEqual([]);
    expect(reportsOnly.details.drivers).toEqual([]);
  });

  it("exposes inventory report details only to inventory users", () => {
    const inventoryOnly = scopeCompanyReport(report, ["reports", "inventory"]);
    expect(inventoryOnly.inventory).toMatchObject({ itemCount: 20, lowStockCount: 3, receivedMovements: 12, issuedMovements: 8 });
    expect(inventoryOnly.details.inventoryMovements).toHaveLength(1);
    const reportsOnly = scopeCompanyReport(report, ["reports"]);
    expect(reportsOnly.inventory.receivedMovements).toBe(0);
    expect(reportsOnly.details.inventoryMovements).toEqual([]);
  });

  it("scopes accident reports to accident access and redacts financial values without finance access", () => {
    const operationsOnly = scopeCompanyReport(report, ["reports", "accidents"]);
    expect(operationsOnly.accidents).toMatchObject({ reportedInPeriod: 2, openNow: 1, estimatedRepairCostInPeriod: 0, settlementAmountInPeriod: 0 });
    expect(operationsOnly.details.accidents[0]).toMatchObject({ ref: "AC-61", vehiclePlate: "1234" });
    expect(operationsOnly.details.accidents[0]).not.toHaveProperty("estimatedRepairCost");
    expect(operationsOnly.details.accidents[0]).not.toHaveProperty("settlementAmount");
    const finance = scopeCompanyReport(report, ["reports", "accidents", "finance"]);
    expect(finance.accidents.estimatedRepairCostInPeriod).toBe(5000);
    expect(finance.details.accidents[0].settlementAmount).toBe(2500);
  });

  it("exposes team task reports only to administrator scope", () => {
    const workerReport = scopeCompanyReport(report, ["reports", "dashboard"]);
    expect(workerReport.taskSummary.overdueNow).toBe(0);
    expect(workerReport.details.tasks).toEqual([]);
    const adminReport = scopeCompanyReport(report, ["reports", "dashboard"], { canViewTeamTasks: true });
    expect(adminReport.taskSummary).toMatchObject({ dueInPeriod: 5, overdueNow: 1 });
    expect(adminReport.details.tasks).toHaveLength(1);
  });
});
