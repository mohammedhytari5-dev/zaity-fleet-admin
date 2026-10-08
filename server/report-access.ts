import { payableLinkPermissions } from "./payable-access";
import { documentModuleByType } from "./document-relations";

type ReportRow = Record<string, unknown>;

function zeroRecord<T extends ReportRow>(record: T): T {
  return Object.fromEntries(Object.keys(record).map(key => [key, 0])) as T;
}

export function scopeCompanyReport<T extends ReportRow>(report: T, permissions: string[]): T {
  const allowed = new Set(permissions);
  const finance = allowed.has("finance");
  const clients = allowed.has("clients");
  const vehicles = allowed.has("vehicles");
  const maintenance = allowed.has("maintenance");
  const payables = allowed.has("payables");
  const details = report.details as ReportRow;
  const redactClient = (row: ReportRow): ReportRow => clients ? row : { ...row, client: "—", clientId: null };
  const canViewPayable = (row: ReportRow) => payableLinkPermissions({
    vehicleId: typeof row.vehicleId === "number" ? row.vehicleId : null,
    maintenanceRequestId: typeof row.maintenanceRequestId === "number" ? row.maintenanceRequestId : null,
  }).every(permission => allowed.has(permission));
  const canViewDocumentSummary = (row: ReportRow) => {
    if (row.entityId === null || row.entityId === undefined) return true;
    const module = documentModuleByType[String(row.entityType) as keyof typeof documentModuleByType];
    return module !== undefined && allowed.has(module);
  };
  const { payableSummaryRows = [], documentSummaryRows = [], operatingExpenses = [], ...publicDetails } = details;
  const visiblePayableSummaries = payables ? (payableSummaryRows as ReportRow[]).filter(canViewPayable) : [];
  const visibleDocumentSummaries = allowed.has("documents")
    ? (documentSummaryRows as ReportRow[]).filter(canViewDocumentSummary)
    : [];
  const visibleOperatingExpenses = finance && vehicles
    ? (operatingExpenses as ReportRow[])
      .filter(row => {
        if (typeof row.maintenanceRequestId === "number" && !maintenance) return false;
        if (typeof row.payableId === "number" && (!payables || !canViewPayable({
          vehicleId: typeof row.payableVehicleId === "number" ? row.payableVehicleId : typeof row.vehicleId === "number" ? row.vehicleId : null,
          maintenanceRequestId: typeof row.payableMaintenanceRequestId === "number" ? row.payableMaintenanceRequestId : typeof row.maintenanceRequestId === "number" ? row.maintenanceRequestId : null,
        }))) return false;
        return true;
      })
      .map(({ vehicleId: _vehicleId, payableId: _payableId, payableVehicleId: _payableVehicleId, payableMaintenanceRequestId: _payableMaintenanceRequestId, maintenanceRequestId, ...row }) => {
        const scoped = { ...row };
        if (!clients) { delete scoped.clientId; scoped.clientName = "—"; }
        if (!allowed.has("projects")) { delete scoped.projectId; scoped.projectName = "—"; }
        if (!maintenance) delete scoped.maintenanceRequestId;
        else scoped.maintenanceRequestId = maintenanceRequestId;
        return scoped;
      })
    : [];

  const scopedDetails = {
    ...publicDetails,
    receivablesAging: finance ? ((details.receivablesAging as ReportRow[] | undefined) ?? []).map(redactClient) : [],
    payments: finance ? ((details.payments as ReportRow[] | undefined) ?? []).map(redactClient) : [],
    claims: finance ? (details.claims as ReportRow[]).map(redactClient) : [],
    contracts: finance ? (details.contracts as ReportRow[]).map(redactClient) : [],
    payables: payables ? (details.payables as ReportRow[])
      .filter(canViewPayable)
      .map(({ vehicleId: _vehicleId, maintenanceRequestId: _maintenanceRequestId, ...row }) => row) : [],
    vehicleProfitability: finance && vehicles ? details.vehicleProfitability : [],
    projectProfitability: finance && allowed.has("projects") ? details.projectProfitability : [],
    clientProfitability: finance && clients ? details.clientProfitability : [],
    employees: allowed.has("employees") ? (details.employees as ReportRow[]) : [],
    drivers: allowed.has("drivers") ? (details.drivers as ReportRow[]) : [],
    maintenance: !maintenance ? [] : (details.maintenance as ReportRow[]).map(row => {
      const visible = { ...row };
      if (!finance) {
        delete visible.cost;
        delete visible.estimatedCost;
        delete visible.invoicedCost;
        delete visible.costVariance;
      }
      if (!payables) {
        delete visible.invoicedCost;
        delete visible.costVariance;
        delete visible.invoiceCount;
      }
      if (!vehicles) { delete visible.vehicle; delete visible.vehicleId; }
      return visible;
    }),
    operatingExpenses: visibleOperatingExpenses,
  };

  const scoped = {
    ...report,
    fleet: vehicles ? report.fleet : zeroRecord(report.fleet as ReportRow),
    finance: (() => {
      const values = finance ? { ...report.finance as ReportRow } : zeroRecord(report.finance as ReportRow);
      if (payables) {
        values.payablesOutstanding = visiblePayableSummaries.reduce((sum, row) => sum + (Number(row.remainingNow) || 0), 0);
        values.payablesPendingApproval = visiblePayableSummaries.filter(row => row.pendingApproval === true).length;
        values.payablesPendingApprovalAmount = visiblePayableSummaries.reduce((sum, row) => sum + (Number(row.pendingApprovalAmount) || 0), 0);
        values.overduePayables = visiblePayableSummaries.filter(row => row.overdue === true).length;
        values.outgoingInPeriod = visiblePayableSummaries.reduce((sum, row) => sum + (Number(row.paidInPeriod) || 0), 0);
      } else {
        values.payablesOutstanding = 0;
        values.payablesPendingApproval = 0;
        values.payablesPendingApprovalAmount = 0;
        values.overduePayables = 0;
        values.outgoingInPeriod = 0;
      }
      if (!vehicles) {
        values.vehicleCostsInPeriod = 0;
        values.allocatedVehicleRevenueInPeriod = 0;
        values.fleetVehicleNetInPeriod = 0;
      }
      return values;
    })(),
    maintenance: maintenance ? { ...report.maintenance as ReportRow, ...(!finance ? { costInPeriod: 0 } : {}) } : zeroRecord(report.maintenance as ReportRow),
    projects: (() => {
      const values = allowed.has("projects") ? { ...report.projects as ReportRow } : zeroRecord(report.projects as ReportRow);
      if (!vehicles) values.assignedVehicles = 0;
      return values;
    })(),
    documents: allowed.has("documents") ? {
      expiringInPeriod: visibleDocumentSummaries.filter(row => row.expiringInPeriod === true).length,
      expiredNow: visibleDocumentSummaries.filter(row => row.expiredNow === true).length,
      expiringNext30Days: visibleDocumentSummaries.filter(row => row.expiringNext30Days === true).length,
    } : zeroRecord(report.documents as ReportRow),
    people: {
      ...(report.people as ReportRow),
      employees: allowed.has("employees") ? (report.people as ReportRow).employees : 0,
      activeEmployees: allowed.has("employees") ? (report.people as ReportRow).activeEmployees : 0,
      drivers: allowed.has("drivers") ? (report.people as ReportRow).drivers : 0,
      availableDrivers: allowed.has("drivers") ? (report.people as ReportRow).availableDrivers : 0,
    },
    details: scopedDetails,
  };
  return scoped as T;
}
