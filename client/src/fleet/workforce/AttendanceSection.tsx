import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Fingerprint,
  RefreshCw,
  Cpu,
  Plus,
  Download,
  Upload,
  Calendar,
  Clock,
  UserCheck,
  AlertCircle,
  UserX,
  Coffee,
  CheckCircle2,
  Trash2,
  Edit2,
  Search,
} from "lucide-react";
import { Badge } from "../common";
import type { AttendanceRow, EmployeeRow, Driver } from "../types";
import { BiometricDeviceModal } from "./BiometricDeviceModal";
import { AttendanceModal } from "./AttendanceModal";

export function AttendanceSection({
  employees,
  drivers,
}: {
  employees: EmployeeRow[];
  drivers: Driver[];
}) {
  const utils = trpc.useUtils();
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [categoryFilter, setCategoryFilter] = useState<"الكل" | "موظف" | "سائق">("الكل");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState<AttendanceRow | null>(null);

  const { data: attendanceList = [], isLoading } = trpc.attendance.list.useQuery({
    date: selectedDate,
  });

  const { data: devices = [] } = trpc.attendance.devices.list.useQuery();
  const syncMutation = trpc.attendance.sync.useMutation();
  const deleteMutation = trpc.attendance.delete.useMutation();
  const importMutation = trpc.attendance.importLogs.useMutation();

  const handleSync = async () => {
    try {
      const res = await syncMutation.mutateAsync({ date: selectedDate });
      await utils.attendance.list.invalidate();
      await utils.attendance.devices.list.invalidate();
      toast.success(
        `تمت المزامنة بنجاح من جهاز البصمة (${res.deviceName}) - تسجيل ${res.synced} حركة لليوم`
      );
    } catch (err: any) {
      toast.error(`تعذر سحب حركات البصمة: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      await utils.attendance.list.invalidate();
      toast.success("تم حذف سجل الحضور بنجاح");
    } catch (err: any) {
      toast.error(`تعذر الحذف: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importMutation.mutateAsync({ fileContent: text });
      await utils.attendance.list.invalidate();
      toast.success(`تم استيراد ${res.imported} حركة من ملف البصمة بنجاح`);
    } catch (err: any) {
      toast.error(`تعذر استيراد ملف البصمة: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleExportCSV = () => {
    if (!attendanceList.length) {
      toast.error("لا توجد بيانات حضور لتصديرها في هذا اليوم");
      return;
    }
    const headers = [
      "الاسم",
      "الكود",
      "التاريخ",
      "وقت الحضور",
      "وقت الانصراف",
      "ساعات العمل",
      "التأخير (دقيقة)",
      "الإضافي (ساعة)",
      "الحالة",
      "المصدر",
    ];
    const rows = filteredRows.map((r) => [
      r.employeeName,
      r.employeeCode,
      r.date,
      r.checkIn || "—",
      r.checkOut || "—",
      r.workHours || 0,
      r.delayMinutes || 0,
      r.overtimeHours || 0,
      r.status,
      r.source,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("تم تصدير كشف الحضور بنجاح");
  };

  // Metrics calculation
  const stats = useMemo(() => {
    const present = attendanceList.filter((r) => r.status === "حاضر" || r.status === "تأخير").length;
    const delayed = attendanceList.filter((r) => r.status === "تأخير").length;
    const absent = attendanceList.filter((r) => r.status === "غياب").length;
    const onLeave = attendanceList.filter((r) => r.status === "إجازة" || r.status === "استئذان").length;
    const totalDelayMinutes = attendanceList.reduce((sum, r) => sum + (r.delayMinutes || 0), 0);
    return { present, delayed, absent, onLeave, totalDelayMinutes };
  }, [attendanceList]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return (attendanceList as AttendanceRow[]).filter((row) => {
      // Category filter
      if (categoryFilter === "سائق" && !row.employeeCode.startsWith("DRV-") && !row.employeeName.includes("سائق")) return false;
      if (categoryFilter === "موظف" && (row.employeeCode.startsWith("DRV-") || row.employeeName.includes("سائق"))) return false;

      // Status filter
      if (statusFilter !== "الكل" && row.status !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.employeeName.toLowerCase().includes(q) ||
          row.employeeCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [attendanceList, categoryFilter, statusFilter, searchQuery]);

  const activeDevice = devices[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Banner and Quick Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--surface)",
          padding: "1rem 1.25rem",
          borderRadius: "12px",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.12)",
              color: "var(--teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Fingerprint size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>كشف الحضور والانصراف والبصمة</h3>
            <small style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span>تكامل حي مع أجهزة البصمة</span>
              <span>·</span>
              <span style={{ color: activeDevice?.status === "متصل" ? "var(--teal)" : "var(--muted)" }}>
                {activeDevice ? `جهاز: ${activeDevice.name} (${activeDevice.ip})` : "لم يتم إعداد جهاز بصمة بعد"}
              </span>
            </small>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn primary"
            onClick={handleSync}
            disabled={syncMutation.isPending}
            style={{ height: 36 }}
          >
            <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "جاري السحب..." : "مزامنة البصمة الآن"}
          </button>

          <button
            type="button"
            className="btn outline"
            onClick={() => setShowDeviceModal(true)}
            style={{ height: 36 }}
          >
            <Cpu size={15} /> إعدادات جهاز البصمة
          </button>

          <label className="btn outline" style={{ height: 36, margin: 0, cursor: "pointer" }}>
            <Upload size={15} /> استيراد ملف البصمة
            <input
              type="file"
              accept=".dat,.csv,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>

          <button
            type="button"
            className="btn outline"
            onClick={() => setShowAddModal(true)}
            style={{ height: 36 }}
          >
            <Plus size={15} /> تسجيل يدوي
          </button>

          <button
            type="button"
            className="btn outline"
            onClick={handleExportCSV}
            style={{ height: 36 }}
            title="تصدير الكشف إلى ملف Excel / CSV"
          >
            <Download size={15} /> تصدير
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>الحضور اليوم</span>
            <UserCheck size={18} style={{ color: "var(--teal)" }} />
          </div>
          <strong style={{ fontSize: 22, marginTop: 4 }}>{stats.present}</strong>
          <small style={{ color: "var(--teal)", marginTop: 2, display: "block" }}>
            حاضر في الموعد أو بتأخير
          </small>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>المتأخرون</span>
            <Clock size={18} style={{ color: "#d97706" }} />
          </div>
          <strong style={{ fontSize: 22, marginTop: 4, color: "#d97706" }}>{stats.delayed}</strong>
          <small style={{ color: "var(--muted)", marginTop: 2, display: "block" }}>
            إجمالي التأخير: {stats.totalDelayMinutes} دقيقة
          </small>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>الغياب</span>
            <UserX size={18} style={{ color: "#e11d48" }} />
          </div>
          <strong style={{ fontSize: 22, marginTop: 4, color: "#e11d48" }}>{stats.absent}</strong>
          <small style={{ color: "var(--muted)", marginTop: 2, display: "block" }}>
            غير مسجل في البصمة
          </small>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>إجازات واستئذان</span>
            <Coffee size={18} style={{ color: "#2563eb" }} />
          </div>
          <strong style={{ fontSize: 22, marginTop: 4, color: "#2563eb" }}>{stats.onLeave}</strong>
          <small style={{ color: "var(--muted)", marginTop: 2, display: "block" }}>
            إجازات معتمدة رسمياً
          </small>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>جهاز البصمة</span>
            <Cpu size={18} style={{ color: "var(--teal)" }} />
          </div>
          <strong style={{ fontSize: 16, marginTop: 6, display: "block" }}>
            {activeDevice ? activeDevice.name.split(" ")[0] : "افتراضي"}
          </strong>
          <small style={{ color: activeDevice?.status === "متصل" ? "var(--teal)" : "var(--muted)", marginTop: 2, display: "block" }}>
            {activeDevice ? `حالة: ${activeDevice.status}` : "جاهز للربط"}
          </small>
        </div>
      </div>

      {/* Date & Filters Toolbar */}
      <div
        className="surface"
        style={{
          padding: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={16} style={{ color: "var(--teal)" }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)",
              }}
            />
          </div>

          <button
            type="button"
            className={`btn ${selectedDate === new Date().toISOString().slice(0, 10) ? "primary" : "outline"}`}
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            style={{ height: 36, fontSize: 12 }}
          >
            اليوم
          </button>

          <button
            type="button"
            className="btn outline"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
            style={{ height: 36, fontSize: 12 }}
          >
            الأمس
          </button>

          <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

          {/* Category Tabs */}
          <div className="tab-pills" style={{ margin: 0 }}>
            {(["الكل", "موظف", "سائق"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={categoryFilter === cat ? "active" : ""}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "الكل" ? "جميع الكادر" : cat === "موظف" ? "الموظفون فقط" : "السائقون فقط"}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--background)",
              padding: "0 10px",
              fontSize: 13,
            }}
          >
            <option value="الكل">جميع الحالات</option>
            <option value="حاضر">حاضر</option>
            <option value="تأخير">تأخير</option>
            <option value="غياب">غياب</option>
            <option value="إجازة">إجازة</option>
            <option value="استئذان">استئذان</option>
            <option value="عطلة">عطلة</option>
          </select>
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: 220 }}>
          <Search
            size={15}
            style={{ position: "absolute", right: 10, top: 11, color: "var(--muted)" }}
          />
          <input
            type="text"
            placeholder="بحث بالاسم أو كود البصمة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: 36,
              paddingRight: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--background)",
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Main Attendance Table */}
      <section className="surface" style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", minWidth: 800 }}>
          <thead>
            <tr>
              <th>الموظف / السائق</th>
              <th>كود البصمة</th>
              <th>التاريخ</th>
              <th>وقت الدخول</th>
              <th>وقت الخروج</th>
              <th>ساعات العمل</th>
              <th>التأخير</th>
              <th>الإضافي</th>
              <th>الحالة</th>
              <th>المصدر</th>
              <th style={{ textAlign: "center" }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                  جاري تحميل كشف الحضور...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <Fingerprint size={32} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                  <div style={{ color: "var(--ink)", fontWeight: 600 }}>لا توجد حركات حضور مسجلة لهذا التاريخ ({selectedDate})</div>
                  <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                    اضغط على «مزامنة البصمة الآن» لسحب الحركات من الجهاز أو «تسجيل يدوي».
                  </small>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.employeeName}</strong>
                    <small style={{ color: "var(--muted)", display: "block", marginTop: 2 }}>
                      {row.employeeCode.startsWith("DRV-") ? "سائق أسطول" : "موظف"}
                    </small>
                  </td>
                  <td>
                    <code style={{ fontSize: 12, background: "var(--background)", padding: "2px 6px", borderRadius: 4 }}>
                      {row.employeeCode}
                    </code>
                  </td>
                  <td>{row.date}</td>
                  <td>
                    {row.checkIn ? (
                      <span style={{ color: "var(--teal)", fontWeight: 600 }}>{row.checkIn}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {row.checkOut ? (
                      <span style={{ color: "#2563eb", fontWeight: 600 }}>{row.checkOut}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {row.workHours ? (
                      <span>{row.workHours} س</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>0 س</span>
                    )}
                  </td>
                  <td>
                    {row.delayMinutes && row.delayMinutes > 0 ? (
                      <span style={{ color: "#d97706", fontWeight: 600 }}>
                        {row.delayMinutes} د
                      </span>
                    ) : (
                      <span style={{ color: "var(--teal)" }}>0</span>
                    )}
                  </td>
                  <td>
                    {row.overtimeHours && row.overtimeHours > 0 ? (
                      <span style={{ color: "var(--teal)", fontWeight: 600 }}>
                        +{row.overtimeHours} س
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <Badge>{row.status}</Badge>
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      {row.source === "جهاز بصمة" ? <Fingerprint size={13} style={{ color: "var(--teal)" }} /> : <Clock size={13} />}
                      {row.source}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                      <button
                        type="button"
                        className="btn outline"
                        onClick={() => setEditingRow(row)}
                        style={{ height: 28, width: 28, padding: 0 }}
                        title="تعديل السجل"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn outline"
                        onClick={() => handleDelete(row.id)}
                        style={{ height: 28, width: 28, padding: 0, color: "var(--danger)" }}
                        title="حذف"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Device Configuration Modal */}
      {showDeviceModal && (
        <BiometricDeviceModal
          onClose={() => setShowDeviceModal(false)}
          onSynced={() => void utils.attendance.list.invalidate()}
        />
      )}

      {/* Manual Entry / Edit Modal */}
      {(showAddModal || editingRow) && (
        <AttendanceModal
          attendance={editingRow}
          employees={employees}
          drivers={drivers}
          onClose={() => {
            setShowAddModal(false);
            setEditingRow(null);
          }}
          onSaved={() => void utils.attendance.list.invalidate()}
        />
      )}
    </div>
  );
}
