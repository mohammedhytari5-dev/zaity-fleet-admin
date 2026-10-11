import React from "react";
import { TableShell, Badge, exportCsv } from "../common";
import { Check, X, Trash } from "lucide-react";
import type { LeaveRow, EmployeeRow } from "../types";
import { matchesQuickSearch } from "@/lib/quick-search";

interface LeavesSectionProps {
  leavesList: LeaveRow[];
  employeesList: EmployeeRow[];
  search: string;
  setSearch: (s: string) => void;
  leaveTab: string;
  setLeaveTab: (tab: string) => void;
  onOpenNewLeave: () => void;
  onApproveLeave: (id: number) => void;
  onRejectLeave: (id: number) => void;
  onDeleteLeave: (id: number) => void;
}

export const LeavesSection: React.FC<LeavesSectionProps> = ({
  leavesList,
  employeesList,
  search,
  setSearch,
  leaveTab,
  setLeaveTab,
  onOpenNewLeave,
  onApproveLeave,
  onRejectLeave,
  onDeleteLeave,
}) => {
  const filtered = leavesList.filter((item) => {
    const match = matchesQuickSearch(item, search);
    if (!match) return false;
    if (leaveTab === "الكل") return true;
    return item.status === leaveTab;
  });

  const underReviewCount = leavesList.filter(
    (l) => l.status === "قيد المراجعة"
  ).length;
  const approvedCount = leavesList.filter((l) => l.status === "معتمدة").length;
  const onLeaveNowCount = employeesList.filter(
    (e) => e.status === "إجازة" || e.status === "في إجازة"
  ).length;

  return (
    <>
      <div className="quick-metrics">
        <div>
          <span>إجمالي الطلبات</span>
          <strong>{leavesList.length.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>قيد المراجعة</span>
          <strong className="amber-text">{underReviewCount}</strong>
        </div>
        <div>
          <span>إجازات معتمدة</span>
          <strong className="green-text">{approvedCount}</strong>
        </div>
        <div>
          <span>في إجازة حالياً</span>
          <strong className="teal-text">{onLeaveNowCount}</strong>
        </div>
      </div>

      <TableShell
        columns={[
          "الموظف",
          "نوع الإجازة",
          "من تاريخ",
          "إلى تاريخ",
          "عدد الأيام",
          "السبب",
          "الحالة",
          "المعتمد",
          "الإجراءات",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            [
              "employeeName",
              "type",
              "startDate",
              "endDate",
              "days",
              "reason",
              "status",
              "approvedBy",
            ],
            "leaves"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "قيد المراجعة", "معتمدة", "مرفوضة"]}
        activeTab={leaveTab}
        setActiveTab={setLeaveTab}
        addLabel="طلب إجازة جديدة"
        onAdd={onOpenNewLeave}
      >
        {filtered.map((item) => (
          <tr key={item.id}>
            <td>
              <strong>{item.employeeName}</strong>
            </td>
            <td>
              <Badge>{item.type}</Badge>
            </td>
            <td>{item.startDate}</td>
            <td>{item.endDate}</td>
            <td>
              <strong>{item.days} أيام</strong>
            </td>
            <td>{item.reason || "—"}</td>
            <td>
              <Badge>{item.status}</Badge>
            </td>
            <td>{item.approvedBy || "—"}</td>
            <td className="actions-cell">
              {item.status === "قيد المراجعة" && (
                <>
                  <button
                    className="btn ghost"
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => onApproveLeave(item.id)}
                    title="اعتماد"
                  >
                    <Check size={14} /> اعتماد
                  </button>
                  <button
                    className="btn ghost danger"
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => onRejectLeave(item.id)}
                    title="رفض"
                  >
                    <X size={14} /> رفض
                  </button>
                </>
              )}
              <button
                className="row-menu-btn danger"
                title="حذف"
                onClick={() => onDeleteLeave(item.id)}
              >
                <Trash size={14} />
              </button>
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
};
