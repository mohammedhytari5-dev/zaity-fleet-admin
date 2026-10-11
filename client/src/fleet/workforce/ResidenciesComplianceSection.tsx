import React from "react";
import { TableShell, Badge, exportCsv } from "../common";
import { Pencil } from "lucide-react";
import type { EmployeeRow } from "../types";
import { matchesQuickSearch } from "@/lib/quick-search";
import { WorkforceMember } from "@shared/workforce-domain";

interface ResidenciesComplianceSectionProps {
  employees: EmployeeRow[];
  search: string;
  setSearch: (s: string) => void;
  residencyTab: string;
  setResidencyTab: (tab: string) => void;
  onRefresh: () => void;
  onEdit: (emp: EmployeeRow) => void;
  onViewProfile: (emp: EmployeeRow) => void;
}

export const ResidenciesComplianceSection: React.FC<
  ResidenciesComplianceSectionProps
> = ({
  employees,
  search,
  setSearch,
  residencyTab,
  setResidencyTab,
  onRefresh,
  onEdit,
  onViewProfile,
}) => {
  const getExpiryDiffDays = (dateStr?: string | null) => {
    if (!dateStr || dateStr === "—") return null;
    return Math.ceil(
      (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const filtered = employees.filter((emp) => {
    const match = matchesQuickSearch(emp, search);
    if (!match) return false;
    if (residencyTab === "الكل") return true;
    const diff = getExpiryDiffDays(emp.residencyExpiry);
    if (diff === null) return false;
    if (residencyTab === "حرجة") return diff <= 30;
    if (residencyTab === "تنبيه") return diff > 30 && diff <= 60;
    if (residencyTab === "سارية") return diff > 60;
    return true;
  });

  const criticalCount = employees.filter((e) => {
    const diff = getExpiryDiffDays(e.residencyExpiry);
    return diff !== null && diff <= 30;
  }).length;

  const warningCount = employees.filter((e) => {
    const diff = getExpiryDiffDays(e.residencyExpiry);
    return diff !== null && diff > 30 && diff <= 60;
  }).length;

  const validCount = employees.filter((e) => {
    const diff = getExpiryDiffDays(e.residencyExpiry);
    return diff !== null && diff > 60;
  }).length;

  return (
    <>
      <div className="quick-metrics">
        <div>
          <span>إجمالي السجلات</span>
          <strong>{employees.length}</strong>
        </div>
        <div>
          <span>حرجة (&lt;= 30 يوم)</span>
          <strong className="red-text">{criticalCount}</strong>
        </div>
        <div>
          <span>تنبيه (&lt;= 60 يوم)</span>
          <strong className="amber-text">{warningCount}</strong>
        </div>
        <div>
          <span>سارية</span>
          <strong className="green-text">{validCount}</strong>
        </div>
      </div>

      <TableShell
        columns={[
          "الموظف",
          "الرقم الوظيفي",
          "رقم الهوية / الإقامة",
          "انتهاء الإقامة",
          "حالة الإقامة",
          "انتهاء التأمين",
          "الإجراءات",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            [
              "name",
              "employeeNo",
              "nationalId",
              "residencyExpiry",
              "insuranceExpiry",
            ],
            "residencies_insurance"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "حرجة", "تنبيه", "سارية"]}
        activeTab={residencyTab}
        setActiveTab={setResidencyTab}
        addLabel="تحديث القائمة"
        onAdd={onRefresh}
      >
        {filtered.map((emp) => {
          const diffDays = getExpiryDiffDays(emp.residencyExpiry);

          return (
            <tr key={emp.id}>
              <td>
                <button
                  className="driver-name-button"
                  onClick={() => onViewProfile(emp)}
                >
                  <span className="avatar">{emp.name.slice(0, 1)}</span>
                  <span>
                    <strong>{emp.name}</strong>
                    <small>
                      {emp.department} · {emp.jobTitle}
                    </small>
                  </span>
                </button>
              </td>
              <td>{emp.employeeNo}</td>
              <td>{emp.nationalId}</td>
              <td>{emp.residencyExpiry}</td>
              <td>
                {diffDays === null ? (
                  <span>—</span>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <Badge>
                      {diffDays < 0
                        ? "متأخر"
                        : diffDays <= 30
                        ? "عاجل"
                        : diffDays <= 60
                        ? "قريبًا"
                        : "ساري"}
                    </Badge>
                    <small>
                      {diffDays < 0
                        ? `(مضى ${Math.abs(diffDays)} يوم)`
                        : `(متبقٍ ${diffDays} يوم)`}
                    </small>
                  </div>
                )}
              </td>
              <td>{emp.insuranceExpiry || "—"}</td>
              <td className="actions-cell">
                <button
                  className="row-menu-btn"
                  title="تعديل التواريخ"
                  onClick={() => onEdit(emp)}
                >
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </>
  );
};
