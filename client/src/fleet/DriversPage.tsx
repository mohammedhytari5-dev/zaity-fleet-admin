import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { resolveRenewalStatus } from "@shared/date-utils";
import { MoreHorizontal, Upload, AlertTriangle } from "lucide-react";
import type { Row, Driver, ImportConfig } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  ContextMenu,
  ImportModal,
  exportCsv,
} from "./common";

export function DriversPage({
  drivers,
  onOpenForm,
  onAction,
  onView,
}: {
  drivers: Driver[];
  onOpenForm: (row?: Row) => void;
  onAction: (action: string, row: Row) => void;
  onView: (driver: Driver) => void;
}) {
  const utils = trpc.useUtils();
  const createDriver = trpc.drivers.create.useMutation();
  const { data: accidentsList = [] } = trpc.accidents.list.useQuery();

  // Aggregate accident counts by driver ID
  const accidentsByDriver = useMemo(() => {
    const map = new Map<number, number>();
    (accidentsList || []).forEach((acc) => {
      if (acc.driverId) {
        map.set(acc.driverId, (map.get(acc.driverId) || 0) + 1);
      }
    });
    return map;
  }, [accidentsList]);

  // Identify driver with the most accidents
  const topAccidentDriver = useMemo<{ driver: Driver; count: number } | null>(() => {
    let max = 0;
    let top: Driver | null = null;
    for (const d of drivers) {
      const count = accidentsByDriver.get(d.id) || 0;
      if (count > max) {
        max = count;
        top = d;
      }
    }
    return top && max > 0 ? { driver: top, count: max } : null;
  }, [drivers, accidentsByDriver]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [menu, setMenu] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const renewalTabs: Record<string, string> = {
    "رخص منتهية": "منتهية",
    "رخص قريبة": "قريبة",
    "رخص سارية": "سارية",
    "بدون تاريخ تجديد": "غير محددة",
  };

  const filtered = drivers.filter((driver) => {
    const renewalStatus = resolveRenewalStatus(driver.renewal);
    const matchesTab =
      tab === "الكل" || driver.status === tab || renewalTabs[tab] === renewalStatus;
    return matchesTab && matchesQuickSearch({ ...driver, renewalStatus }, search);
  });

  const tabs = ["الكل", "متاح", "مشغول", ...Object.keys(renewalTabs)];

  const driverImportConfig: ImportConfig = {
    label: "السائقين",
    sampleFilename: "نموذج_استيراد_السائقين.csv",
    columns: [
      { key: "name", header: "الاسم الكامل", required: true, hint: "أحمد محمد العمري" },
      { key: "phone", header: "رقم الهاتف", required: false, hint: "0501234567" },
      { key: "idNo", header: "رقم الهوية / الإقامة", required: false, hint: "1234567890" },
      { key: "license", header: "نوع الرخصة", required: false, hint: "خصوصي" },
      { key: "renewal", header: "تاريخ انتهاء الرخصة", required: false, hint: "2025-12-31" },
      { key: "status", header: "الحالة", required: false, hint: "متاح" },
    ],
    mapRow: (raw) => ({
      name: raw["الاسم الكامل"]?.trim() || "",
      phone: raw["رقم الهاتف"]?.trim() || "—",
      idNo: raw["رقم الهوية / الإقامة"]?.trim() || "—",
      license: raw["نوع الرخصة"]?.trim() || "خصوصي",
      renewal: raw["تاريخ انتهاء الرخصة"]?.trim() || "—",
      status: raw["الحالة"]?.trim() || "متاح",
      vehicle: "—",
    }),
  };

  const doImportDrivers = async (rows: Record<string, any>[]) => {
    for (const row of rows) {
      await createDriver.mutateAsync(row as any);
    }
    void utils.drivers.list.invalidate();
  };

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الفريق"
        title="السائقون"
        description="إدارة ملفات السائقين والرخص والتوزيع والحالة التشغيلية."
        action="إضافة سائق"
        onAction={() => onOpenForm()}
        secondaryAction="استيراد السائقين من إكسل"
        onSecondaryAction={() => setImportOpen(true)}
      />

      <div className="quick-metrics">
        <div>
          <span>إجمالي السائقين</span>
          <strong>{drivers.length.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>متاحون</span>
          <strong className="green-text">
            {drivers.filter((d) => d.status === "متاح").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>في مهمة</span>
          <strong className="blue-text">
            {drivers.filter((d) => d.status === "مشغول").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>رخص منتهية أو قريبة</span>
          <strong className="amber-text">
            {
              drivers.filter((d) =>
                ["منتهية", "قريبة"].includes(resolveRenewalStatus(d.renewal))
              ).length
            }
          </strong>
        </div>
        <div>
          <span>الأكثر تسجيلاً للحوادث</span>
          {topAccidentDriver ? (
            <strong style={{ color: "#d9534f", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <AlertTriangle size={15} /> {topAccidentDriver.driver.name} ({topAccidentDriver.count} {topAccidentDriver.count === 1 ? "حادث" : "حوادث"})
            </strong>
          ) : (
            <strong className="green-text">لا توجد حوادث مسجلة</strong>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: ".5rem" }}>
        <button className="btn outline" onClick={() => setImportOpen(true)}>
          <Upload size={15} /> استيراد من CSV
        </button>
      </div>

      <TableShell
        columns={[
          "السائق",
          "الهاتف",
          "الهوية",
          "نوع الرخصة",
          "المركبة الحالية",
          "حالة السائق",
          "سجل الحوادث",
          "تاريخ انتهاء الرخصة",
          "حالة الرخصة",
        ]}
        onExport={() =>
          exportCsv(
            filtered.map((driver) => ({
              ...driver,
              accidentsCount: accidentsByDriver.get(driver.id) || 0,
              renewalStatus: resolveRenewalStatus(driver.renewal),
            })),
            ["name", "phone", "idNo", "license", "vehicle", "status", "accidentsCount", "renewal", "renewalStatus"],
            "drivers",
            [
              "السائق",
              "الهاتف",
              "الهوية",
              "نوع الرخصة",
              "المركبة الحالية",
              "حالة السائق",
              "سجل الحوادث",
              "تاريخ انتهاء الرخصة",
              "حالة الرخصة",
            ]
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={tabs}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="إضافة سائق"
        onAdd={() => onOpenForm()}
        onImport={() => setImportOpen(true)}
        importLabel="استيراد من إكسل"
      >
        {filtered.map((driver) => (
          <tr key={driver.id}>
            <td>
              <button className="driver-name-button" onClick={() => onView(driver)}>
                <span className="avatar">{driver.name.slice(0, 1)}</span>
                <span>
                  <strong>{driver.name}</strong>
                  <small>اضغط لعرض ملف السائق</small>
                </span>
              </button>
            </td>
            <td>{driver.phone}</td>
            <td>{driver.idNo}</td>
            <td>{driver.license}</td>
            <td>{driver.vehicle}</td>
            <td>
              <Badge>{driver.status}</Badge>
            </td>
            <td>
              {(accidentsByDriver.get(driver.id) || 0) > 0 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  <AlertTriangle size={13} /> {accidentsByDriver.get(driver.id)}{" "}
                  {accidentsByDriver.get(driver.id) === 1 ? "حادث" : "حوادث"}
                </span>
              ) : (
                <span style={{ color: "var(--muted)", fontSize: "11px" }}>سجل سليم (0)</span>
              )}
            </td>
            <td>{driver.renewal}</td>
            <td>
              <Badge>{resolveRenewalStatus(driver.renewal)}</Badge>
            </td>
            <td className="actions-cell">
              <button className="row-menu-btn" onClick={() => setMenu(menu === driver.id ? null : driver.id)}>
                <MoreHorizontal size={18} />
              </button>
              {menu === driver.id && (
                <ContextMenu
                  row={driver}
                  module="drivers"
                  onClose={() => setMenu(null)}
                  onAction={(action) => {
                    setMenu(null);
                    onAction(action, driver);
                  }}
                />
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {importOpen && (
        <ImportModal
          config={driverImportConfig}
          onClose={() => setImportOpen(false)}
          onImport={doImportDrivers}
        />
      )}
    </>
  );
}

export default DriversPage;
