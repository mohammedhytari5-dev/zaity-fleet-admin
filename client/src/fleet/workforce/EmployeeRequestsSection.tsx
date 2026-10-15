import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge, toInputDate, Modal, FormActions, Field } from "../common";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Trash,
  Eye,
  Plus,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import type { EmployeeRequestRow, EmployeeRow, Driver } from "../types";

export function EmployeeRequestsSection({
  employees,
  drivers,
  onOpenSelfService,
}: {
  employees: EmployeeRow[];
  drivers: Driver[];
  onOpenSelfService: () => void;
}) {
  const [tab, setTab] = useState<string>("الكل");
  const [typeFilter, setTypeFilter] = useState<string>("الكل");
  const [search, setSearch] = useState("");
  const [rejectionModal, setRejectionModal] = useState<EmployeeRequestRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<{ title: string; url: string } | null>(null);

  const utils = trpc.useUtils();
  const requestsQuery = trpc.employeeRequests.list.useQuery();
  const updateStatusMutation = trpc.employeeRequests.updateStatus.useMutation();
  const deleteMutation = trpc.employeeRequests.delete.useMutation();

  const requests = requestsQuery.data ?? [];

  const filtered = requests.filter((req) => {
    if (tab !== "الكل" && req.status !== tab) return false;
    if (typeFilter !== "الكل" && req.requestType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        req.personName.toLowerCase().includes(q) ||
        req.title.toLowerCase().includes(q) ||
        (req.reason && req.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleApprove = async (req: EmployeeRequestRow) => {
    try {
      await updateStatusMutation.mutateAsync({
        id: req.id,
        status: "معتمدة",
        notes: "تمت الموافقة والاعتماد من الموارد البشرية",
      });
      toast.success(`تمت الموافقة على ${req.title} بنجاح 🟢`);
      utils.employeeRequests.list.invalidate();
    } catch (err: any) {
      toast.error(`تعذر الاعتماد: ${err.message}`);
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionModal) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: rejectionModal.id,
        status: "مرفوضة",
        rejectionReason: rejectionReason.trim() || "غير مطابق للشروط",
      });
      toast.success("تم رفض الطلب وتدوين السبب بنجاح");
      setRejectionModal(null);
      setRejectionReason("");
      utils.employeeRequests.list.invalidate();
    } catch (err: any) {
      toast.error(`تعذر رفض الطلب: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا السجل نهائياً؟")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("تم حذف الطلب بنجاح");
      utils.employeeRequests.list.invalidate();
    } catch (err: any) {
      toast.error(`تعذر الحذف: ${err.message}`);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "قيد المراجعة").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Top Banner */}
      <div
        style={{
          background: "white",
          padding: "1rem 1.25rem",
          borderRadius: "10px",
          border: "1px solid var(--border-color, #e5e7eb)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "var(--brand-primary, #25364c)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileText size={20} color="#059669" /> طلبات الكادر والخدمة الذاتية (HR Requests)
          </h3>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
            إدارة طلبات الموظفين وسائقي الأسطول: الإجازات، نقل الكفالة، تأشيرات الخروج النهائي والعودة، وسلف الرواتب.
          </p>
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={onOpenSelfService}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Plus size={16} /> فتح بوابة الخدمة الذاتية / تقديم طلب
        </button>
      </div>

      {/* Tabs & Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div className="table-tabs" style={{ background: "white", padding: "0.25rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          {["الكل", "قيد المراجعة", "معتمدة", "مرفوضة"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              style={
                t === "قيد المراجعة" && pendingCount > 0
                  ? { color: "#d97706", fontWeight: 700 }
                  : undefined
              }
            >
              {t} {t === "قيد المراجعة" && pendingCount > 0 ? `(${pendingCount} ⚠️)` : `(${requests.filter((r) => t === "الكل" || r.status === t).length})`}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "white" }}
          >
            <option value="الكل">كافة أنواع الطلبات</option>
            <option value="إجازة">🏖️ إجازة</option>
            <option value="نقل كفالة">🔄 نقل كفالة</option>
            <option value="خروج نهائي">✈️ خروج نهائي</option>
            <option value="خروج وعودة">🛫 خروج وعودة</option>
            <option value="سلفة راتب">💵 سلفة راتب</option>
            <option value="تعريف بالراتب">📄 تعريف بالراتب</option>
          </select>

          <input
            type="text"
            placeholder="بحث باسم الكادر أو الطلب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "white", minWidth: 200 }}
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="table-scroll" style={{ background: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <table>
          <thead>
            <tr>
              <th>تاريخ التقديم</th>
              <th>صاحب الطلب</th>
              <th>الصفة والقسم</th>
              <th>نوع الطلب</th>
              <th>العنوان والتفاصيل</th>
              <th>المدة / القيمة</th>
              <th>المرفق</th>
              <th>الحالة</th>
              <th>ملاحظات الاعتماد</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((req) => (
              <tr key={req.id}>
                <td>
                  <strong>{toInputDate(req.createdAt)}</strong>
                </td>
                <td>
                  <strong>{req.personName}</strong>
                </td>
                <td>
                  <Badge variant="neutral">{req.personRole}</Badge>
                  <small style={{ display: "block", color: "var(--muted)", marginTop: "2px" }}>
                    {req.department || "—"}
                  </small>
                </td>
                <td>
                  <strong style={{ color: "var(--brand-primary, #25364c)" }}>{req.requestType}</strong>
                </td>
                <td>
                  <div><strong>{req.title}</strong></div>
                  {req.reason && (
                    <small style={{ color: "#475569", display: "block", maxWidth: "260px" }}>
                      {req.reason}
                    </small>
                  )}
                </td>
                <td>
                  {req.requestType === "إجازة" || req.requestType === "خروج وعودة" ? (
                    <span>
                      {req.days} يوم
                      {req.startDate && (
                        <small style={{ display: "block", color: "var(--muted)" }}>
                          ({toInputDate(req.startDate)} إلى {toInputDate(req.endDate)})
                        </small>
                      )}
                    </span>
                  ) : req.requestType === "سلفة راتب" ? (
                    <strong style={{ color: "#047857" }}>{Number(req.amount).toLocaleString("en-US")} SAR</strong>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>
                  {req.attachmentUrl ? (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setPreviewAttachment({ title: req.attachmentName || "المستند المرفق", url: req.attachmentUrl! })}
                    >
                      <FileText size={13} /> {req.attachmentName || "عرض الملف"}
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>
                  <Badge
                    variant={
                      req.status === "معتمدة"
                        ? "neutral"
                        : req.status === "مرفوضة"
                        ? "bad"
                        : "warn"
                    }
                  >
                    {req.status}
                  </Badge>
                </td>
                <td>
                  {req.status === "معتمدة" ? (
                    <div style={{ color: "#16a34a", fontSize: "0.8rem", fontWeight: 600 }}>
                      ✓ اعتمدها: {req.approvedBy} ({toInputDate(req.approvedAt)})
                    </div>
                  ) : req.status === "مرفوضة" ? (
                    <div style={{ color: "#dc2626", fontSize: "0.8rem" }}>
                      سبب الرفض: {req.rejectionReason}
                    </div>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>بانتظار قرار HR</span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    {req.status === "قيد المراجعة" && (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "#16a34a", borderColor: "#16a34a" }}
                          onClick={() => handleApprove(req)}
                          title="اعتماد الطلب"
                        >
                          <Check size={13} /> اعتماد
                        </button>
                        <button
                          type="button"
                          className="btn outline"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#dc2626", borderColor: "#fca5a5" }}
                          onClick={() => setRejectionModal(req)}
                          title="رفض الطلب"
                        >
                          <X size={13} /> رفض
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDelete(req.id)}
                      title="حذف"
                      style={{ color: "var(--muted)" }}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "var(--muted)", padding: "2.5rem" }}>
                  لا توجد طلبات تطابق الفلترة المحددة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* REJECTION REASON MODAL */}
      {rejectionModal && (
        <Modal title={`رفض طلب: ${rejectionModal.title}`} onClose={() => setRejectionModal(null)}>
          <form onSubmit={handleRejectConfirm}>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "#64748b" }}>
              يرجى تدوين سبب رفض هذا الطلب ليظهر لصاحب الطلب ({rejectionModal.personName}) في بوابته:
            </p>
            <Field
              label="سبب الرفض *"
              value={rejectionReason}
              onChange={setRejectionReason}
              placeholder="مثال: تعارض مع جدول العمل الحالي، أو نقص في المستندات..."
            />
            <FormActions
              onCancel={() => setRejectionModal(null)}
              label="تأكيد رفض الطلب"
            />
          </form>
        </Modal>
      )}

      {/* ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <Modal title={previewAttachment.title} onClose={() => setPreviewAttachment(null)}>
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <img
              src={previewAttachment.url}
              alt={previewAttachment.title}
              style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button type="button" className="btn ghost" onClick={() => setPreviewAttachment(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
