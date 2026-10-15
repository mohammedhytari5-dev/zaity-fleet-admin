import React, { useState } from "react";
import { TableShell, Badge, exportCsv, formatSAR } from "../common";
import {
  DollarSign,
  Plus,
  RefreshCw,
  Check,
  Pencil,
  Trash,
  HelpCircle,
} from "lucide-react";
import type { PayrollRow } from "../types";
import { formatCompanyDate } from "@shared/date-utils";
import { matchesQuickSearch } from "@/lib/quick-search";
import { trpc } from "@/lib/trpc";
import { FinanceInquiriesModal } from "./FinanceInquiriesModal";

interface PayrollSectionProps {
  payrollList: PayrollRow[];
  payrollMonth: string;
  setPayrollMonth: (month: string) => void;
  search: string;
  setSearch: (s: string) => void;
  payrollTab: string;
  setPayrollTab: (tab: string) => void;
  onRefresh: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onOpenNewModal: () => void;
  onOpenEditModal: (item: PayrollRow) => void;
  onDelete: (item: PayrollRow) => void;
  onApprove: (id: number) => void;
  onDisburse: (id: number) => void;
}

export const PayrollSection: React.FC<PayrollSectionProps> = ({
  payrollList,
  payrollMonth,
  setPayrollMonth,
  search,
  setSearch,
  payrollTab,
  setPayrollTab,
  onRefresh,
  onGenerate,
  isGenerating,
  onOpenNewModal,
  onOpenEditModal,
  onDelete,
  onApprove,
  onDisburse,
}) => {
  const [inquiriesModalOpen, setInquiriesModalOpen] = useState(false);
  const inquiriesQuery = trpc.payrollInquiry.list.useQuery();
  const pendingInquiriesCount = (inquiriesQuery.data ?? []).filter(
    (i) => i.status === "بانتظار الرد"
  ).length;

  const filtered = payrollList.filter((item) => {
    const match = matchesQuickSearch(item, search);
    if (!match) return false;
    if (payrollTab === "الكل") return true;
    return item.status === payrollTab;
  });

  const totalNet = payrollList.reduce(
    (sum, p) => sum + Number(p.netSalary || 0),
    0
  );
  const approvedCount = payrollList.filter((p) => p.status === "معتمد").length;
  const paidCount = payrollList.filter((p) => p.status === "تم الصرف").length;
  const draftCount = payrollList.filter((p) => p.status === "مسودة").length;

  return (
    <>
      <div className="quick-metrics">
        <div>
          <span>إجمالي المسير لشهر {payrollMonth}</span>
          <strong className="teal-text">{formatSAR(totalNet)}</strong>
        </div>
        <div>
          <span>المسيرات المعتمدة</span>
          <strong className="green-text">{approvedCount}</strong>
        </div>
        <div>
          <span>تم الصرف</span>
          <strong>{paidCount}</strong>
        </div>
        <div>
          <span>مسودات بانتظار الاعتماد</span>
          <strong className="amber-text">{draftCount}</strong>
        </div>
      </div>

      <div
        className="surface"
        style={{
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>مسير شهر:</span>
          <input
            type="text"
            value={payrollMonth}
            onChange={(e) => setPayrollMonth(e.target.value)}
            placeholder="10-2026"
            style={{ width: "120px", padding: "0.35rem 0.5rem" }}
          />
          <button
            className="btn ghost"
            onClick={onRefresh}
            title="تحديث البيانات"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="btn outline"
            onClick={() => setInquiriesModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              borderColor: pendingInquiriesCount > 0 ? "#f59e0b" : undefined,
              background: pendingInquiriesCount > 0 ? "#fffbeb" : undefined,
            }}
          >
            <HelpCircle size={15} color={pendingInquiriesCount > 0 ? "#d97706" : undefined} />
            <span>اعتراضات الخصومات</span>
            {pendingInquiriesCount > 0 && (
              <span
                style={{
                  background: "#dc2626",
                  color: "white",
                  borderRadius: "999px",
                  fontSize: "0.72rem",
                  padding: "0.1rem 0.45rem",
                  fontWeight: 700,
                }}
              >
                {pendingInquiriesCount}
              </span>
            )}
          </button>
          <button
            className="btn primary"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            <DollarSign size={15} /> توليد مسير الشهر تلقائياً
          </button>
          <button
            className="btn ghost"
            onClick={onOpenNewModal}
          >
            <Plus size={15} /> إضافة بند يدوي
          </button>
        </div>
      </div>

      <TableShell
        columns={[
          "اسم الموظف",
          "الشهر",
          "الراتب الأساسي",
          "البدلات",
          "الخصومات",
          "صافي الراتب",
          "الحالة",
          "تاريخ الصرف",
          "الإجراءات",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            [
              "employeeName",
              "month",
              "basicSalary",
              "allowances",
              "deductions",
              "netSalary",
              "status",
              "paidAt",
            ],
            `payroll_${payrollMonth}`
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "مسودة", "معتمد", "تم الصرف"]}
        activeTab={payrollTab}
        setActiveTab={setPayrollTab}
        addLabel="توليد مسير الشهر"
        onAdd={onGenerate}
      >
        {filtered.map((item) => (
          <tr key={item.id}>
            <td>
              <strong>{item.employeeName}</strong>
            </td>
            <td>{item.month}</td>
            <td>{formatSAR(Number(item.basicSalary || 0))}</td>
            <td>{formatSAR(Number(item.allowances || 0))}</td>
            <td className="red-text">
              {Number(item.deductions || 0) > 0
                ? `-${formatSAR(Number(item.deductions || 0))}`
                : "0 ر.س"}
            </td>
            <td>
              <strong className="teal-text">
                {formatSAR(Number(item.netSalary || 0))}
              </strong>
            </td>
            <td>
              <Badge>{item.status}</Badge>
            </td>
            <td>{item.paidAt || "—"}</td>
            <td className="actions-cell">
              {item.status === "مسودة" && (
                <button
                  className="btn ghost"
                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => onApprove(item.id)}
                  title="اعتماد"
                >
                  <Check size={14} /> اعتماد
                </button>
              )}
              {item.status === "معتمد" && (
                <button
                  className="btn primary"
                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => onDisburse(item.id)}
                  title="صرف"
                >
                  <DollarSign size={14} /> صرف
                </button>
              )}
              <button
                className="row-menu-btn"
                title="تعديل"
                onClick={() => onOpenEditModal(item)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="row-menu-btn danger"
                title="حذف المسير"
                onClick={() => onDelete(item)}
              >
                <Trash size={15} />
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      <FinanceInquiriesModal
        isOpen={inquiriesModalOpen}
        onClose={() => setInquiriesModalOpen(false)}
        currentUser={null}
      />
    </>
  );
};
