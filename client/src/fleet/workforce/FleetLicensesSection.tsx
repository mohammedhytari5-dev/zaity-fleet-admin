import React from "react";
import { TableShell, Badge, exportCsv } from "../common";
import type { Driver } from "../types";
import { matchesQuickSearch } from "@/lib/quick-search";

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
  const filtered = driversList.filter((d) => {
    const match = matchesQuickSearch(d, search);
    if (!match) return false;
    if (driverTab === "الكل") return true;
    return d.status === driverTab;
  });

  const activeCount = driversList.filter((d) => d.status === "نشط").length;
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
      </div>

      <TableShell
        columns={[
          "الاسم",
          "الهاتف",
          "الهوية / الإقامة",
          "المركبة المسندة",
          "رقم الرخصة",
          "تاريخ التجديد",
          "الحالة",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            ["name", "phone", "idNo", "vehicle", "license", "renewal", "status"],
            "drivers_summary"
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
        {filtered.map((driver) => (
          <tr key={driver.id}>
            <td>
              <strong>{driver.name}</strong>
            </td>
            <td>{driver.phone}</td>
            <td>{driver.idNo}</td>
            <td>{driver.vehicle || "—"}</td>
            <td>{driver.license || "—"}</td>
            <td>{driver.renewal || "—"}</td>
            <td>
              <Badge>{driver.status}</Badge>
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
};
