import React, { useMemo } from "react";
import { TableShell, Badge, exportCsv } from "../common";
import type { Driver } from "../types";
import { matchesQuickSearch } from "@/lib/quick-search";
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";

interface FleetLicensesSectionProps {
  driversList: Driver[];
  search: string;
  setSearch: (s: string) => void;
  driverTab: string;
  setDriverTab: (tab: string) => void;
  onRefresh: () => void;
}

export const FleetLicensesSection: React.FC<FleetLicensesSectionProps> = ({
  driversList,
  search,
  setSearch,
  driverTab,
  setDriverTab,
  onRefresh,
}) => {
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
    for (const d of driversList) {
      const count = accidentsByDriver.get(d.id) || 0;
      if (count > max) {
        max = count;
        top = d;
      }
    }
    return top && max > 0 ? { driver: top, count: max } : null;
  }, [driversList, accidentsByDriver]);

  const filtered = driversList.filter((d) => {
    const match = matchesQuickSearch(d, search);
    if (!match) return false;
    if (driverTab === "الكل") return true;
    return d.status === driverTab;
  });

  const activeCount = driversList.filter((d) => d.status === "نشط" || d.status === "متاح").length;
  const withVehicleCount = driversList.filter(
    (d) => d.vehicle && d.vehicle !== "—"
  ).length;

  return (
    <>
      <div className="quick-metrics">
        <div>
          <span>إجمالي السائقين</span>
          <strong>{driversList.length}</strong>
        </div>
        <div>
          <span>على رأس العمل</span>
          <strong className="green-text">{activeCount}</strong>
        </div>
        <div>
          <span>مرتبط بمركبة</span>
          <strong>{withVehicleCount}</strong>
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

      <TableShell
        columns={[
          "الاسم",
          "الهاتف",
          "الهوية / الإقامة",
          "المركبة المسندة",
          "سجل الحوادث",
          "رقم الرخصة",
          "تاريخ التجديد",
          "الحالة",
        ]}
        onExport={() =>
          exportCsv(
            filtered.map((d) => ({
              ...d,
              accidentsCount: accidentsByDriver.get(d.id) || 0,
            })),
            ["name", "phone", "idNo", "vehicle", "accidentsCount", "license", "renewal", "status"],
            "drivers_summary",
            [
              "الاسم",
              "الهاتف",
              "الهوية / الإقامة",
              "المركبة المسندة",
              "عدد الحوادث",
              "رقم الرخصة",
              "تاريخ التجديد",
              "الحالة",
            ]
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "نشط", "إجازة", "موقوف"]}
        activeTab={driverTab}
        setActiveTab={setDriverTab}
        addLabel="تحديث القائمة"
        onAdd={onRefresh}
      >
        {filtered.map((driver) => {
          const accCount = accidentsByDriver.get(driver.id) || 0;
          return (
            <tr key={driver.id}>
              <td>
                <strong>{driver.name}</strong>
              </td>
              <td>{driver.phone}</td>
              <td>{driver.idNo}</td>
              <td>{driver.vehicle || "—"}</td>
              <td>
                {accCount > 0 ? (
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
                    <AlertTriangle size={13} /> {accCount} {accCount === 1 ? "حادث" : "حوادث"}
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: "11px" }}>سجل سليم (0)</span>
                )}
              </td>
              <td>{driver.license || "—"}</td>
              <td>{driver.renewal || "—"}</td>
              <td>
                <Badge>{driver.status}</Badge>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </>
  );
};
