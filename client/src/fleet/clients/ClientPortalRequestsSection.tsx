import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge, Modal, FormActions } from "../common";
import {
  Globe,
  Share2,
  Copy,
  Phone,
  MessageSquare,
  Bus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Eye,
  Check,
  X,
  ExternalLink,
  Users,
  Building2,
  User,
  MapPin,
  Fuel,
} from "lucide-react";
import type { ClientPortalRequestRow } from "../types";

export function ClientPortalRequestsSection() {
  const [tab, setTab] = useState<string>("الكل");
  const [typeFilter, setTypeFilter] = useState<string>("الكل");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<ClientPortalRequestRow | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [statusToUpdate, setStatusToUpdate] = useState<"جديد" | "قيد التواصل" | "تم الاتفاق والتنفيذ" | "مرفوض" | "ملغى">("قيد التواصل");

  const utils = trpc.useUtils();
  const requestsQuery = trpc.clientPortal.list.useQuery(undefined, {
    staleTime: 15000,
  });
  const updateStatusMutation = trpc.clientPortal.updateStatus.useMutation();
  const deleteMutation = trpc.clientPortal.delete.useMutation();

  const requests = (requestsQuery.data ?? []) as ClientPortalRequestRow[];

  const filtered = requests.filter((r) => {
    if (tab !== "الكل" && r.status !== tab) return false;
    if (typeFilter !== "الكل" && r.requestType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        r.companyName.toLowerCase().includes(q) ||
        r.contactPerson.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.details && r.details.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleCopyPortalLink = () => {
    const url = `${window.location.origin}/client-portal`;
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط بوابة العملاء العامة بنجاح!");
  };

  const handleOpenDetail = (r: ClientPortalRequestRow) => {
    setSelectedRequest(r);
    setStatusToUpdate((r.status as any) || "قيد التواصل");
    setResponseNotes(r.responseNotes || "");
  };

  const handleSaveStatus = async () => {
    if (!selectedRequest) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: selectedRequest.id,
        status: statusToUpdate,
        responseNotes: responseNotes.trim() || undefined,
      });
      utils.clientPortal.list.invalidate();
      toast.success("تم تحديث حالة طلب العميل بنجاح");
      setSelectedRequest(null);
    } catch (err: any) {
      toast.error(err.message || "تعذر تحديث الطلب");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "جديد":
        return <Badge variant="warn">جديد</Badge>;
      case "قيد التواصل":
        return <Badge variant="neutral">قيد التواصل</Badge>;
      case "تم الاتفاق والتنفيذ":
        return <Badge variant="ok">تم الاتفاق والتنفيذ</Badge>;
      case "مرفوض":
      case "ملغى":
        return <Badge variant="bad">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div>
      {/* Top Banner with Public Link Sharing */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
          borderRadius: "14px",
          padding: "1.25rem 1.5rem",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.25rem",
          boxShadow: "0 6px 16px rgba(37, 99, 235, 0.25)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <Globe size={20} />
            <strong style={{ fontSize: "1.1rem" }}>بوابة العملاء العامة (بدون تسجيل دخول)</strong>
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9 }}>
            يمكن للعملاء الجدد والحاليين الدخول عبر هذا الرابط لطلب استئجار باصات أو إرسال بلاغات وشكاوى وسرية تامة دون كشف بيانات الشركة.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={handleCopyPortalLink}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "white",
              color: "#1e3a8a",
              border: "none",
              borderRadius: "8px",
              padding: "0.55rem 1rem",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            <Copy size={16} />
            <span>نسخ رابط البوابة للمشاركة 🔗</span>
          </button>

          <a
            href="/client-portal"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.15)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "8px",
              padding: "0.55rem 1rem",
              fontWeight: 700,
              fontSize: "0.88rem",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={16} />
            <span>معاينة شاشة العميل</span>
          </a>
        </div>
      </div>

      {/* Filter Tabs by Type */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
          background: "white",
          padding: "0.4rem",
          borderRadius: "10px",
          border: "1px solid var(--border-color, #e5e7eb)",
        }}
      >
        {[
          { id: "الكل", label: "جميع الطلبات والبلاغات" },
          { id: "استئجار باصات", label: "طلبات استئجار جديدة 🚌" },
          { id: "باصات إضافية", label: "باصات إضافية ➕" },
          { id: "بلاغ عطل", label: "بلاغات أعطال ⚠️" },
          { id: "شكوى سائق", label: "شكاوى سائقين 👤" },
          { id: "إلغاء أو تعديل عقد", label: "تعديل وإلغاء عقود 📄" },
          { id: "استفسار عام", label: "استفسارات عامة 💬" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTypeFilter(t.id)}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "none",
              background: typeFilter === t.id ? "#1e40af" : "transparent",
              color: typeFilter === t.id ? "white" : "#475569",
              fontWeight: typeFilter === t.id ? 700 : 500,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar: Status Tabs & Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["الكل", "جديد", "قيد التواصل", "تم الاتفاق والتنفيذ", "مرفوض"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setTab(st)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: tab === st ? "#2563eb" : "#cbd5e1",
                background: tab === st ? "#eff6ff" : "white",
                color: tab === st ? "#1d4ed8" : "#475569",
                fontWeight: tab === st ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {st} {st === "جديد" && requests.filter((r) => r.status === "جديد").length > 0 && `(${requests.filter((r) => r.status === "جديد").length} 🟡)`}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: "260px" }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالمنشأة، المسؤول، الجوال..."
            style={{
              flex: 1,
              padding: "0.45rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Requests Table */}
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          border: "1px solid var(--border-color, #e5e7eb)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
              <th style={{ padding: "0.75rem 1rem" }}>المرجع / التاريخ</th>
              <th style={{ padding: "0.75rem 1rem" }}>نوع الطلب</th>
              <th style={{ padding: "0.75rem 1rem" }}>المنشأة والمسؤول</th>
              <th style={{ padding: "0.75rem 1rem" }}>التواصل المباشر</th>
              <th style={{ padding: "0.75rem 1rem" }}>تفاصيل الأسطول والمدينة</th>
              <th style={{ padding: "0.75rem 1rem" }}>الحالة</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "center" }}>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
                  لا توجد طلبات واردة من بوابة العملاء مطابقة للفلترة
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const cleanPhone = r.phone.replace(/[^0-9]/g, "");
                const waPhone = cleanPhone.startsWith("05") ? "966" + cleanPhone.slice(1) : cleanPhone;
                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: r.status === "جديد" ? "#fffbeb" : "white",
                    }}
                  >
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <strong style={{ color: "#1e40af", display: "block" }}>
                        REQ-{1000 + r.id}
                      </strong>
                      <small style={{ color: "#64748b" }}>
                        {r.createdAt ? String(r.createdAt).slice(0, 10) : "—"}
                      </small>
                    </td>

                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "6px",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          background:
                            r.requestType === "بلاغ عطل"
                              ? "#fee2e2"
                              : r.requestType === "شكوى سائق"
                              ? "#ffedd5"
                              : "#e0f2fe",
                          color:
                            r.requestType === "بلاغ عطل"
                              ? "#991b1b"
                              : r.requestType === "شكوى سائق"
                              ? "#9a3412"
                              : "#0369a1",
                        }}
                      >
                        {r.requestType}
                      </span>
                      <small style={{ display: "block", color: "#64748b", marginTop: "2px" }}>
                        {r.clientType}
                      </small>
                    </td>

                    <td style={{ padding: "0.75rem 1rem" }}>
                      <strong style={{ display: "block", color: "#0f172a" }}>{r.companyName}</strong>
                      <small style={{ color: "#475569" }}>{r.contactPerson}</small>
                    </td>

                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 600 }}>{r.phone}</span>
                        <a
                          href={`tel:${r.phone}`}
                          title="اتصال هاتفي"
                          style={{
                            background: "#eff6ff",
                            color: "#2563eb",
                            padding: "0.25rem 0.45rem",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <Phone size={13} />
                        </a>
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="محادثة واتساب"
                          style={{
                            background: "#ecfdf5",
                            color: "#059669",
                            padding: "0.25rem 0.45rem",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <MessageSquare size={13} />
                        </a>
                      </div>
                    </td>

                    <td style={{ padding: "0.75rem 1rem" }}>
                      {r.requestType === "استئجار باصات" ? (
                        <div>
                          <div>
                            <strong>{r.city}</strong> · {r.busType || "باص"} ({r.busesCount} باص)
                          </div>
                          <small style={{ color: "#64748b" }}>
                            المدة: {r.duration || "—"} · {r.withDriver ? "بسائق" : "بدون"} · {r.withFuel ? "بمحروقات" : "بدون"}
                          </small>
                        </div>
                      ) : (
                        <div>
                          <div style={{ color: "#334155" }}>
                            {r.busPlateNumber ? `لوحة: ${r.busPlateNumber} · ` : ""}
                            {r.currentContractNo ? `عقد: ${r.currentContractNo}` : "—"}
                          </div>
                          <small style={{ color: "#64748b", maxWidth: "240px", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.details || "لا توجد تفاصيل إضافية"}
                          </small>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "0.75rem 1rem" }}>{getStatusBadge(r.status)}</td>

                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(r)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          background: "#2563eb",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.4rem 0.75rem",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Eye size={14} />
                        <span>متابعة والرد</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: View and Update Request */}
      {selectedRequest && (
        <Modal
          title={`متابعة طلب العميل: REQ-${1000 + selectedRequest.id}`}
          onClose={() => setSelectedRequest(null)}
          wide
        >
          <div style={{ padding: "0.5rem" }}>
            {/* Request Summary Banner */}
            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>نوع الطلب:</span>
                <strong style={{ display: "block", color: "#1e40af", fontSize: "0.95rem" }}>
                  {selectedRequest.requestType}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>المنشأة:</span>
                <strong style={{ display: "block", color: "#0f172a" }}>{selectedRequest.companyName}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>المسؤول:</span>
                <strong style={{ display: "block", color: "#0f172a" }}>{selectedRequest.contactPerson}</strong>
              </div>
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>الجوال:</span>
                <strong style={{ display: "block", color: "#0f172a" }}>{selectedRequest.phone}</strong>
              </div>
            </div>

            {/* Detailed Spec for Bus Rental */}
            {selectedRequest.requestType === "استئجار باصات" && (
              <div
                style={{
                  background: "#eff6ff",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid #bfdbfe",
                  marginBottom: "1.25rem",
                  fontSize: "0.9rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e40af" }}>مواصفات التشغيل المطلوبة:</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                  <div><strong>المدينة:</strong> {selectedRequest.city}</div>
                  <div><strong>نوع الباص:</strong> {selectedRequest.busType}</div>
                  <div><strong>العدد:</strong> {selectedRequest.busesCount} باص</div>
                  <div><strong>مدة العقد:</strong> {selectedRequest.duration}</div>
                  <div><strong>طبيعة العمل:</strong> {selectedRequest.workNature || "—"}</div>
                  <div><strong>المسافة التقديرية:</strong> {selectedRequest.dailyEstimatedKm || 0} كم / يومياً</div>
                  <div><strong>السائق:</strong> {selectedRequest.withDriver ? "شامل سائق" : "بدون سائق"}</div>
                  <div><strong>المحروقات:</strong> {selectedRequest.withFuel ? "شامل المحروقات" : "بدون محروقات"}</div>
                  <div><strong>تاريخ المباشرة:</strong> {selectedRequest.startDate || "فوري"}</div>
                </div>
              </div>
            )}

            {/* Other Request Details */}
            {selectedRequest.details && (
              <div style={{ marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
                  تفاصيل وشرح العميل:
                </span>
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "0.85rem",
                    borderRadius: "8px",
                    marginTop: "0.4rem",
                    color: "#0f172a",
                    lineHeight: 1.6,
                    fontSize: "0.9rem",
                  }}
                >
                  {selectedRequest.details}
                </div>
              </div>
            )}

            {/* Contact Actions */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <a
                href={`tel:${selectedRequest.phone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "#2563eb",
                  color: "white",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                }}
              >
                <Phone size={16} />
                <span>اتصال بالعميل الآن</span>
              </a>

              <a
                href={`https://wa.me/${selectedRequest.phone.startsWith("05") ? "966" + selectedRequest.phone.slice(1) : selectedRequest.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "#10b981",
                  color: "white",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                }}
              >
                <MessageSquare size={16} />
                <span>محادثة واتساب</span>
              </a>
            </div>

            {/* Update Status & Notes Form */}
            <div
              style={{
                borderTop: "1px solid #e2e8f0",
                paddingTop: "1.25rem",
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "1rem",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                  تحديث حالة الطلب:
                </label>
                <select
                  value={statusToUpdate}
                  onChange={(e) => setStatusToUpdate(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                >
                  <option value="جديد">جديد 🟡</option>
                  <option value="قيد التواصل">قيد التواصل والمتابعة 🔵</option>
                  <option value="تم الاتفاق والتنفيذ">تم الاتفاق والتنفيذ 🟢</option>
                  <option value="مرفوض">مرفوض 🔴</option>
                  <option value="ملغى">ملغى</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                  ملاحظات المتابعة والرد الداخلي:
                </label>
                <input
                  type="text"
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="تم التواصل مع العميل وإرسال عرض السعر رقم..."
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                style={{
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={updateStatusMutation.isPending}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1e40af",
                  color: "white",
                  fontWeight: 700,
                  cursor: updateStatusMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {updateStatusMutation.isPending ? "جارٍ الحفظ..." : "حفظ التحديثات"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default ClientPortalRequestsSection;
