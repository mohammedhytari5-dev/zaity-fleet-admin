type ReportRow = Record<string, unknown>;

function zeroRecord<T extends ReportRow>(record: T): T {
  return Object.fromEntries(Object.keys(record).map(key => [key, 0])) as T;
}

export function scopeCompanyReport<T extends ReportRow>(report: T, permissions: string[]): T {
  const allowed = new Set(permissions);
  const finance = allowed.has("finance");
  const vehicles = allowed.has("vehicles");
  const maintenance = allowed.has("maintenance");
  const details = report.details as ReportRow;

  const scopedDetails = {
    ...details,
    claims: finance ? details.claims : [],
    contracts: finance ? details.contracts : [],
    payables: finance ? details.payables : [],
    vehicleProfitability: finance ? details.vehicleProfitability : [],
    projectProfitability: finance ? details.projectProfitability : [],
    clientProfitability: finance ? details.clientProfitability : [],
    maintenance: !maintenance ? [] : (details.maintenance as ReportRow[]).map(row => {
      const visible = { ...row };
      if (!finance) delete visible.cost;
      if (!vehicles) { delete visible.vehicle; delete visible.vehicleId; }
      return visible;
    }),
  };

  const scoped = {
    ...report,
    fleet: vehicles ? report.fleet : zeroRecord(report.fleet as ReportRow),
    finance: finance ? report.finance : zeroRecord(report.finance as ReportRow),
    maintenance: maintenance ? { ...report.maintenance as ReportRow, ...(!finance ? { costInPeriod: 0 } : {}) } : zeroRecord(report.maintenance as ReportRow),
    projects: allowed.has("projects") ? report.projects : zeroRecord(report.projects as ReportRow),
    documents: allowed.has("documents") ? report.documents : zeroRecord(report.documents as ReportRow),
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
