import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCompanyDate } from "@shared/date-utils";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import {
  Wallet,
  CreditCard,
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  AlertCircle,
  Tag,
  Search,
} from "lucide-react";
import { Badge, Modal, Field, FormActions, formatSAR } from "./common";
import type { Driver, EmployeeRow } from "./types";

interface CustodyPageProps {
  canApprove: boolean;
  currentUser: {
    id: number;
    name?: string | null;
    role: string;
  } | null;
  drivers: Driver[];
  employees: EmployeeRow[];
}

export function CustodyPage({
  canApprove,
  currentUser,
  drivers = [],
  employees = [],
}: CustodyPageProps) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expenseModalCustody, setExpenseModalCustody] = useState<any | null>(null);
  const [historyCustody, setHistoryCustody] = useState<any | null>(null);
  const [settleModalCustody, setSettleModalCustody] = useState<any | null>(null);

  // Queries & Mutations
  const custodiesQuery = trpc.custody.list.useQuery();
  const createMutation = trpc.custody.create.useMutation();
  const acceptMutation = trpc.custody.accept.useMutation();
  const addExpenseMutation = trpc.custody.addExpense.useMutation();
  const settleMutation = trpc.custody.settle.useMutation();

  const expensesQuery = trpc.custody.expenses.useQuery(
    { custodyId: historyCustody?.id ?? 0 },
    { enabled: Boolean(historyCustody?.id) }
  );

  // Form states
  const [newCustody, setNewCustody] = useState({
    title: "",
    custodyType: "عهد الصيانة",
    custodianType: "employee" as "employee" | "driver",
    custodianId: 0,
    custodianName: "",
    paymentMethod: "تحويل بنكي",
    referenceNumber: "",
    receiptDocName: "",
    receiptDocUrl: "",
    totalAmount: 1000,
    notes: "",
  });

  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: 100,
    expenseDate: formatCompanyDate(),
    invoiceNumber: "",
    invoiceDocName: "",
    invoiceDocUrl: "",
  });

  const [settleNotes, setSettleNotes] = useState("");

  const custodies = custodiesQuery.data ?? [];

  // Categorize
  const isSpecialCard = (type: string) =>
    type.includes("خاصة") ||
    type.includes("بطاقة خاصة") ||
    type.includes("بطاقةخاصة") ||
    type.includes("بطاقات خاصة") ||
    type.includes("بطاقة صاحب العمل");
  const isOperational = (type: string) => !isSpecialCard(type);

  const filteredCustodies = custodies.filter((c) => {
    if (activeTab === "operational" && !isOperational(c.custodyType)) return false;
    if (activeTab === "special_cards" && !isSpecialCard(c.custodyType)) return false;
    if (activeTab === "active" && c.status !== "نشطة") return false;
    if (activeTab === "settled" && c.status !== "مسواة") return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.custodianName.toLowerCase().includes(q) ||
      c.custodyType.toLowerCase().includes(q)
    );
  });

  // KPI Summary
  const totalAllocated = custodies.reduce((sum, c) => sum + Number(c.totalAmount || 0), 0);
  const totalSpent = custodies.reduce((sum, c) => sum + Number(c.spentAmount || 0), 0);
  const totalRemaining = custodies.reduce((sum, c) => sum + Number(c.remainingAmount || 0), 0);
  const activeCount = custodies.filter((c) => c.status === "نشطة").length;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustody.custodianId) {
      toast.error("يرجى اختيار المستلم المسؤول عن العهدة");
      return;
    }
    if (newCustody.totalAmount <= 0) {
      toast.error("يرجى إدخال مبلغ عهدة صحيح");
      return;
    }

    try {
      await createMutation.mutateAsync(newCustody);
      toast.success("تم صرف وتسجيل العهدة بنجاح");
      setCreateModalOpen(false);
      utils.custody.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر إنشاء العهدة");
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseModalCustody) return;
    if (newExpense.amount <= 0) {
      toast.error("يرجى إدخال مبلغ مصروف صحيح");
      return;
    }

    try {
      await addExpenseMutation.mutateAsync({
        custodyId: expenseModalCustody.id,
        ...newExpense,
      });
      toast.success("تم تسجيل المصروف وخصم القيمة من رصيد العهدة تلقائياً");
      setExpenseModalCustody(null);
      setNewExpense({
        description: "",
        amount: 100,
        expenseDate: formatCompanyDate(),
        invoiceNumber: "",
        invoiceDocName: "",
        invoiceDocUrl: "",
      });
      utils.custody.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل المصروف");
    }
  };

  const handleAccept = async (custody: any) => {
    try {
      await acceptMutation.mutateAsync({
        id: custody.id,
        amount: Number(custody.totalAmount),
      });
      toast.success("تم تأكيد استلام العهدة بنجاح");
      utils.custody.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر تأكيد الاستلام");
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalCustody) return;
    try {
      await settleMutation.mutateAsync({
        id: settleModalCustody.id,
        notes: settleNotes,
      });
      toast.success("تم تسوية وإغلاق العهدة بنجاح");
      setSettleModalCustody(null);
      setSettleNotes("");
      utils.custody.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر تسوية العهدة");
    }
  };

  const handleFileUpload = async (
    file: File,
    onSuccess: (url: string, name: string) => void
  ) => {
    try {
      const dataUrl = await readUploadDataUrl(file);
      onSuccess(dataUrl, file.name);
      toast.success("تم تجهيز المستند المرفق");
    } catch {
      toast.error("تعذر تحميل الملف");
    }
  };

  return (
    <div style={{ padding: "1.25rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
            إدارة العهد والمصاريف وبطاقات الفيزا
          </h2>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.88rem" }}>
            صرف العهد، التصفية التلقائية بالخصم اللحظي، وإدارة بطاقات مشتريات الشركة والبطاقات الخاصة
          </p>
        </div>

        {canApprove && (
          <button
            className="btn primary"
            onClick={() => setCreateModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "10px",
              fontWeight: 700,
            }}
          >
            <Plus size={18} />
            صرف عهدة / بطاقة جديدة
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="surface" style={{ padding: "1rem", borderRadius: "12px" }}>
          <div style={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
            إجمالي العهد المنصرفة
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>
            {formatSAR(totalAllocated)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            {custodies.length} عهدة وبطاقة
          </div>
        </div>

        <div className="surface" style={{ padding: "1rem", borderRadius: "12px" }}>
          <div style={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
            إجمالي المصروفات والمشتريات
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#d97706", marginTop: "0.25rem" }}>
            {formatSAR(totalSpent)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            مخصومة تلقائياً مع الفواتير
          </div>
        </div>

        <div className="surface" style={{ padding: "1rem", borderRadius: "12px" }}>
          <div style={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
            الرصيد المتبقي المتاح
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#10b981", marginTop: "0.25rem" }}>
            {formatSAR(totalRemaining)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            في حوزة الموظفين والبطاقات
          </div>
        </div>

        <div className="surface" style={{ padding: "1rem", borderRadius: "12px" }}>
          <div style={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
            العهد النشطة الحالية
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#2563eb", marginTop: "0.25rem" }}>
            {activeCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            قيد الاستخدام الميداني
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <div
          className="table-tabs"
          style={{
            background: "white",
            padding: "0.35rem 0.75rem",
            borderRadius: "10px",
            border: "1px solid var(--border-color, #e5e7eb)",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            margin: 0,
          }}
        >
          <button
            className={activeTab === "all" ? "active" : ""}
            onClick={() => setActiveTab("all")}
          >
            الكل ({custodies.length})
          </button>
          <button
            className={activeTab === "operational" ? "active" : ""}
            onClick={() => setActiveTab("operational")}
          >
            <Wallet size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
            عهد الشركة التشغيلية
          </button>
          <button
            className={activeTab === "special_cards" ? "active" : ""}
            onClick={() => setActiveTab("special_cards")}
          >
            <CreditCard size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
            عهد بطاقات خاصة (4 بطاقات)
          </button>
          <button
            className={activeTab === "active" ? "active" : ""}
            onClick={() => setActiveTab("active")}
          >
            النشطة ({activeCount})
          </button>
          <button
            className={activeTab === "settled" ? "active" : ""}
            onClick={() => setActiveTab("settled")}
          >
            المسواة
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "240px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="بحث بالرمز، العنوان، أو المستلم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingRight: "2rem", width: "100%" }}
          />
        </div>
      </div>

      {/* Custodies Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {filteredCustodies.map((custody) => {
          const total = Number(custody.totalAmount || 0);
          const spent = Number(custody.spentAmount || 0);
          const remaining = Number(custody.remainingAmount || 0);
          const percentSpent = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
          const isSpecialCardType = isSpecialCard(custody.custodyType);

          return (
            <div
              key={custody.id}
              className="surface"
              style={{
                borderRadius: "14px",
                padding: "1.25rem",
                border: isSpecialCardType ? "1px solid #fed7aa" : "1px solid #e2e8f0",
                background: isSpecialCardType ? "#fffdfa" : "#ffffff",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              {/* Card Head */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: isSpecialCardType ? "#c2410c" : "#2563eb",
                        background: isSpecialCardType ? "#ffedd5" : "#eff6ff",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "6px",
                      }}
                    >
                      {custody.code}
                    </span>
                    <h4
                      style={{
                        margin: "0.4rem 0 0",
                        fontSize: "1.05rem",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {custody.title}
                    </h4>
                  </div>
                  <Badge>{custody.status}</Badge>
                </div>

                <div style={{ fontSize: "0.82rem", color: "#475569", margin: "0.5rem 0" }}>
                  <strong>المستلم: </strong>
                  <span>{custody.custodianName}</span> ({custody.custodianType === "driver" ? "سائق" : "موظف"})
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.8rem",
                    color: "#64748b",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span>{custody.custodyType}</span>
                  <span>•</span>
                  <span>{custody.paymentMethod}</span>
                  {custody.referenceNumber && (
                    <>
                      <span>•</span>
                      <span>سند #{custody.referenceNumber}</span>
                    </>
                  )}
                </div>

                {/* Acceptance Status Banner */}
                {custody.acceptanceStatus === "بانتظار الاستلام" ? (
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px dashed #f59e0b",
                      borderRadius: "8px",
                      padding: "0.5rem 0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.82rem",
                      color: "#b45309",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span>⚠️ بانتظار تأكيد استلام الموظف للمبلغ</span>
                    <button
                      className="btn outline"
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                      onClick={() => handleAccept(custody)}
                    >
                      تأكيد الاستلام
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#15803d",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>تم الاستلام رسمياً بمبلغ {formatSAR(Number(custody.acceptedAmount || total))}</span>
                  </div>
                )}

                {/* Progress & Financials */}
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "0.85rem",
                    borderRadius: "10px",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.82rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>المصروف: {formatSAR(spent)}</span>
                    <strong style={{ color: remaining > 0 ? "#10b981" : "#ef4444" }}>
                      المتبقي: {formatSAR(remaining)}
                    </strong>
                  </div>

                  {/* Progress Bar */}
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "#e2e8f0",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percentSpent}%`,
                        height: "100%",
                        background:
                          percentSpent > 90
                            ? "#ef4444"
                            : percentSpent > 60
                            ? "#f59e0b"
                            : "#2563eb",
                        borderRadius: "999px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "0.35rem",
                    }}
                  >
                    <span>الأصل: {formatSAR(total)}</span>
                    <span>{percentSpent}٪ مستهلك</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                {custody.status === "نشطة" && (
                  <button
                    className="btn primary"
                    style={{ flex: 1, padding: "0.45rem", fontSize: "0.82rem", fontWeight: 700 }}
                    onClick={() => setExpenseModalCustody(custody)}
                  >
                    <Plus size={14} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
                    تسجيل شراء / خصم
                  </button>
                )}

                <button
                  className="btn outline"
                  style={{ flex: 1, padding: "0.45rem", fontSize: "0.82rem" }}
                  onClick={() => setHistoryCustody(custody)}
                >
                  <Receipt size={14} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
                  سجل الفواتير
                </button>

                {canApprove && custody.status === "نشطة" && (
                  <button
                    className="btn outline"
                    style={{ padding: "0.45rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={() => setSettleModalCustody(custody)}
                  >
                    تسوية
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustodies.length === 0 && (
        <div className="surface" style={{ padding: "3rem", textAlign: "center", borderRadius: "12px" }}>
          <Wallet size={36} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
          <h4 style={{ margin: 0, color: "#334155" }}>لا توجد عهد أو بطاقات مطابقة</h4>
          <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: "0.88rem" }}>
            يمكنك صرف عهدة جديدة أو ضبط خيارات التصفية للبحث.
          </p>
        </div>
      )}

      {/* Modal: Create Custody */}
      {createModalOpen && (
        <Modal title="صرف عهدة أو بطاقة فيزا جديدة" onClose={() => setCreateModalOpen(false)} wide>
          <form onSubmit={handleCreateSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>نوع العهدة / البطاقة *</span>
                <select
                  value={newCustody.custodyType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCustody((prev) => ({
                      ...prev,
                      custodyType: val,
                      title: prev.title || val,
                    }));
                  }}
                >
                  <optgroup label="عهد الشركة التشغيلية">
                    <option value="عهد الصيانة">عهد الصيانة</option>
                    <option value="عهد الفحص الدوري">عهد الفحص الدوري</option>
                    <option value="عهد المحروقات (الوقود)">عهد المحروقات (الوقود)</option>
                    <option value="عهد تشغيلية أخرى">عهد تشغيلية أخرى</option>
                  </optgroup>
                  <optgroup label="عهد بطاقات خاصة (4 بطاقات)">
                    <option value="بطاقة خاصة 1 (مشتريات شركة)">بطاقة خاصة 1 (مشتريات شركة)</option>
                    <option value="بطاقة خاصة 2 (مشتريات شركة)">بطاقة خاصة 2 (مشتريات شركة)</option>
                    <option value="بطاقة خاصة 3 (مشتريات شركة)">بطاقة خاصة 3 (مشتريات شركة)</option>
                    <option value="بطاقة خاصة 4 (مصاريف خاصة)">بطاقة خاصة 4 (مصاريف خاصة)</option>
                  </optgroup>
                </select>
              </label>

              <Field
                label="عنوان أو مسمى العهدة *"
                value={newCustody.title}
                onChange={(val) => setNewCustody((prev) => ({ ...prev, title: val }))}
                placeholder="مثال: عهدة قطع غيار باصات، بطاقة فيزا رقم..."
              />

              <label className="field">
                <span>فئة المستلم *</span>
                <select
                  value={newCustody.custodianType}
                  onChange={(e) =>
                    setNewCustody((prev) => ({
                      ...prev,
                      custodianType: e.target.value as any,
                      custodianId: 0,
                      custodianName: "",
                    }))
                  }
                >
                  <option value="employee">موظف إداري / كادر</option>
                  <option value="driver">سائق أسطول</option>
                </select>
              </label>

              <label className="field">
                <span>اسم المستلم المسؤول *</span>
                <select
                  value={newCustody.custodianId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (newCustody.custodianType === "driver") {
                      const d = drivers.find((x) => x.id === id);
                      setNewCustody((prev) => ({
                        ...prev,
                        custodianId: id,
                        custodianName: d?.name || "",
                      }));
                    } else {
                      const emp = employees.find((x) => x.id === id);
                      setNewCustody((prev) => ({
                        ...prev,
                        custodianId: id,
                        custodianName: emp?.name || "",
                      }));
                    }
                  }}
                >
                  <option value={0}>اختر المستلم...</option>
                  {newCustody.custodianType === "driver"
                    ? drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.phone || d.nationalId}
                        </option>
                      ))
                    : employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} · {emp.department || "عام"}
                        </option>
                      ))}
                </select>
              </label>

              <label className="field">
                <span>طريقة الصرف والتسليم *</span>
                <select
                  value={newCustody.paymentMethod}
                  onChange={(e) => setNewCustody((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <option value="تحويل بنكي">تحويل بنكي مباشر</option>
                  <option value="كاش">كاش / نقدي</option>
                  <option value="بطاقة فيزا">تسليم بطاقة فيزا الشركة</option>
                </select>
              </label>

              <Field
                label="رقم الحوالة أو سند الصرف"
                value={newCustody.referenceNumber}
                onChange={(val) => setNewCustody((prev) => ({ ...prev, referenceNumber: val }))}
                placeholder="رقم العملية البنكية أو السند"
              />

              <Field
                label="مبلغ العهدة (ر.س) *"
                type="number"
                value={newCustody.totalAmount}
                onChange={(val) => setNewCustody((prev) => ({ ...prev, totalAmount: Number(val) }))}
              />

              <div className="field">
                <span>إرفاق إشعار التحويل / سند الصرف</span>
                <input
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, (url, name) => {
                        setNewCustody((prev) => ({
                          ...prev,
                          receiptDocUrl: url,
                          receiptDocName: name,
                        }));
                      });
                    }
                  }}
                />
                {newCustody.receiptDocName && (
                  <div style={{ fontSize: "0.8rem", color: "#10b981", marginTop: "0.25rem" }}>
                    تم إرفاق: {newCustody.receiptDocName}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field
                  label="ملاحظات وتوجيهات الصرف"
                  value={newCustody.notes}
                  onChange={(val) => setNewCustody((prev) => ({ ...prev, notes: val }))}
                  placeholder="أي شروط أو بنود خاصة بهذه العهدة..."
                />
              </div>
            </div>

            <FormActions
              onCancel={() => setCreateModalOpen(false)}
              label={createMutation.isPending ? "جارٍ الحفظ..." : "اعتماد وصرف العهدة"}
            />
          </form>
        </Modal>
      )}

      {/* Modal: Add Expense (خصم تلقائي فوري) */}
      {expenseModalCustody && (
        <Modal
          title={`تسجيل شراء وتصفية من العهدة (${expenseModalCustody.code})`}
          onClose={() => setExpenseModalCustody(null)}
        >
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            <strong>الرصيد المتاح حالياً بالعهدة: </strong>
            <span style={{ fontWeight: 800, color: "#1e3a8a" }}>
              {formatSAR(Number(expenseModalCustody.remainingAmount || 0))}
            </span>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.2rem" }}>
              سيتم خصم قيمة الشراء تلقائياً وتحديث الرصيد بمجرد الحفظ.
            </div>
          </div>

          <form onSubmit={handleExpenseSubmit}>
            <div className="form-grid">
              <Field
                label="ما الذي تم شراؤه؟ (بيان المصروف) *"
                value={newExpense.description}
                onChange={(val) => setNewExpense((prev) => ({ ...prev, description: val }))}
                placeholder="مثال: شراء قطع غيار، تعبئة وقود، فحص دوري بالمرور..."
              />

              <Field
                label="المبلغ المدفوع (ر.س) *"
                type="number"
                value={newExpense.amount}
                onChange={(val) => setNewExpense((prev) => ({ ...prev, amount: Number(val) }))}
              />

              <Field
                label="تاريخ الشراء *"
                type="date"
                value={newExpense.expenseDate}
                onChange={(val) => setNewExpense((prev) => ({ ...prev, expenseDate: val }))}
              />

              <Field
                label="رقم الفاتورة"
                value={newExpense.invoiceNumber}
                onChange={(val) => setNewExpense((prev) => ({ ...prev, invoiceNumber: val }))}
                placeholder="رقم الفاتورة الضريبية"
              />

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <span>صورة الفاتورة المرفقة *</span>
                <input
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, (url, name) => {
                        setNewExpense((prev) => ({
                          ...prev,
                          invoiceDocUrl: url,
                          invoiceDocName: name,
                        }));
                      });
                    }
                  }}
                />
                {newExpense.invoiceDocName && (
                  <div style={{ fontSize: "0.8rem", color: "#10b981", marginTop: "0.25rem" }}>
                    تم إرفاق: {newExpense.invoiceDocName}
                  </div>
                )}
              </div>
            </div>

            <FormActions
              onCancel={() => setExpenseModalCustody(null)}
              label={addExpenseMutation.isPending ? "جارٍ الحفظ والخصم..." : "حفظ وخصم تلقائي من العهدة"}
            />
          </form>
        </Modal>
      )}

      {/* Modal: Expenses History */}
      {historyCustody && (
        <Modal
          title={`سجل مشتريات وفواتير العهدة: ${historyCustody.title} (${historyCustody.code})`}
          onClose={() => setHistoryCustody(null)}
          wide
        >
          <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Badge>{`المبلغ الابتدائي: ${formatSAR(Number(historyCustody.totalAmount || 0))}`}</Badge>
            <Badge>{`المصروف: ${formatSAR(Number(historyCustody.spentAmount || 0))}`}</Badge>
            <Badge>{`المتبقي: ${formatSAR(Number(historyCustody.remainingAmount || 0))}`}</Badge>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>تاريخ الشراء</th>
                  <th>بيان المصروف</th>
                  <th>المبلغ</th>
                  <th>رقم الفاتورة</th>
                  <th>المرفق</th>
                  <th>المسجل</th>
                </tr>
              </thead>
              <tbody>
                {(expensesQuery.data ?? []).map((exp) => (
                  <tr key={exp.id}>
                    <td>{exp.expenseDate}</td>
                    <td><strong>{exp.description}</strong></td>
                    <td style={{ color: "#d97706", fontWeight: 700 }}>{formatSAR(Number(exp.amount))}</td>
                    <td>{exp.invoiceNumber || "—"}</td>
                    <td>
                      {exp.invoiceDocUrl ? (
                        <a
                          href={exp.invoiceDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            color: "#2563eb",
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLink size={14} />
                          معاينة الفاتورة
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{exp.reportedByName || "—"}</td>
                  </tr>
                ))}
                {(expensesQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                      لا توجد فواتير أو مشتريات مسجلة على هذه العهدة حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button className="btn outline" onClick={() => setHistoryCustody(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Settle Custody */}
      {settleModalCustody && (
        <Modal title={`تسوية العهدة (${settleModalCustody.code})`} onClose={() => setSettleModalCustody(null)}>
          <form onSubmit={handleSettle}>
            <p style={{ fontSize: "0.88rem", color: "#475569" }}>
              هل ترغب في تسوية وإغلاق هذه العهدة نهائياً؟
              <br />
              <strong>المبلغ الأصلي: </strong>{formatSAR(Number(settleModalCustody.totalAmount))} |{" "}
              <strong>المصروف: </strong>{formatSAR(Number(settleModalCustody.spentAmount))} |{" "}
              <strong>المتبقي: </strong>{formatSAR(Number(settleModalCustody.remainingAmount))}
            </p>

            <Field
              label="ملاحظات التسوية / استرجاع المتبقي"
              value={settleNotes}
              onChange={setSettleNotes}
              placeholder="مثال: تم إيداع المتبقي في حساب الشركة البنكي..."
            />

            <FormActions
              onCancel={() => setSettleModalCustody(null)}
              label={settleMutation.isPending ? "جارٍ التسوية..." : "تأكيد التسوية والإغلاق"}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
