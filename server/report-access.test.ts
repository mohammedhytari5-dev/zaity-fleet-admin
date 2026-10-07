import { describe, expect, it } from "vitest";
import { scopeCompanyReport } from "./report-access";

const report = {
  period: { from: "2026-10-01", to: "2026-10-07" },
  fleet: { total: 12, working: 8 },
  finance: { receivableOutstanding: 9500, payablesOutstanding: 1200 },
  maintenance: { openNow: 3, costInPeriod: 700 },
  projects: { activeNow: 4 },
  documents: { expiredNow: 2 },
  people: { employees: 10, activeEmployees: 9, drivers: 5, availableDrivers: 3 },
  details: {
    claims: [{ id: 1, amount: 9500 }],
    contracts: [{ id: 2, total: 20000 }],
    payables: [{ id: 3, amount: 1200 }],
    vehicleProfitability: [{ plate: "1234", expense: 700 }],
    projectProfitability: [{ name: "مشروع سري", revenue: 5000 }],
    clientProfitability: [{ name: "عميل سري", revenue: 5000 }],
    maintenance: [{ id: 4, vehicleId: 12, vehicle: "1234", status: "تنفيذ", cost: "700 SAR" }],
  },
};

describe("report data access", () => {
  it("does not expose finance or maintenance costs to a reports-only user", () => {
    const result = scopeCompanyReport(report, ["reports"]);
    expect(result.finance).toEqual({ receivableOutstanding: 0, payablesOutstanding: 0 });
    expect(result.details.claims).toEqual([]);
    expect(result.details.payables).toEqual([]);
    expect(result.details.maintenance).toEqual([]);
    expect(result.maintenance.costInPeriod).toBe(0);
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
    expect(result.details.maintenance).toEqual([]);
  });
});
