import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Paperclip,
  UploadCloud,
  Send,
  AlertCircle,
  Search,
} from "lucide-react";
import { Badge, Modal, FormActions, formatSAR } from "../common";

interface FinanceInquiriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: number;
    name?: string | null;
    role: string;
  } | null;
}

export function FinanceInquiriesModal({
  isOpen,
  onClose,
  currentUser,
}: FinanceInquiriesModalProps) {
  const utils = trpc.useUtils();
  const inquiriesQuery = trpc.payrollInquiry.list.useQuery(undefined, {
    enabled: isOpen,
  });
  const respondMutation = trpc.payrollInquiry.respond.useMutation();

  const [activeTab, setActiveTab] = useState<"pending" | "responded" | "all">("pending");
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [responseText, setResponseText] = useState("");
  const [proofDocName, setProofDocName] = useState("");
  const [proofDocUrl, setProofDocUrl] = useState("");
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  if (!isOpen) return null;

  const inquiries = inquiriesQuery.data ?? [];

  const filtered = inquiries.filter((inq) => {
    if (activeTab === "pending" && inq.status !== "بانتظار الرد") return false;
    if (activeTab === "responded" && inq.status !== "تم الرد") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (inq.personName || "").toLowerCase().includes(q) ||
      (inq.inquiryText || "").toLowerCase().includes(q)
    );
  });

  const pendingCount = inquiries.filter((i) => i.status === "بانتظار الرد").length;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readUploadDataUrl(file);
      setProofDocUrl(dataUrl);
      setProofDocName(file.name);
      toast.success("تم إرفاق صورة المخالفة / المستند بنجاح");
    } catch {
      toast.error("فشل رفع المستند");
    }
  };

  const handleOpenRespond = (inq: any) => {
    setSelectedInquiry(inq);
    setResponseText(inq.financeResponse || "");
    setProofDocName(inq.proofDocName || "");
    setProofDocUrl(inq.proofDocUrl || "");
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !responseText.trim()) {
      toast.error("يرجى كتابة نص الرد والتوضيح للسائق");
      return;
    }

    try {
      await respondMutation.mutateAsync({
        id: selectedInquiry.id,
        financeResponse: responseText.trim(),
        proofDocName: proofDocName || undefined,
        proofDocUrl: proofDocUrl || undefined,
      });
      toast.success("تم إرسال الرد وتوضيح الخصم للسائق بنجاح");
      setSelectedInquiry(null);
      setResponseText("");
      setProofDocName("");
      setProofDocUrl("");
      utils.payrollInquiry.list.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء إرسال الرد");
    }
  };

  return (
    <Modal title="استفسارات واعتراضات السائقين على خصومات الرواتب" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Top bar with tabs and search */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div
            className="table-tabs"
            style={{
              background: "#f8fafc",
              padding: "0.3rem 0.6rem",
              borderRadius: "8px",
              display: "flex",
              gap: "0.4rem",
              margin: 0,
            }}
          >
            <button
              className={activeTab === "pending" ? "active" : ""}
              onClick={() => setActiveTab("pending")}
              type="button"
            >
              بانتظار الرد ({pendingCount})
            </button>
            <button
              className={activeTab === "responded" ? "active" : ""}
              onClick={() => setActiveTab("responded")}
              type="button"
            >
              تم الرد ({inquiries.length - pendingCount})
            </button>
            <button
              className={activeTab === "all" ? "active" : ""}
              onClick={() => setActiveTab("all")}
              type="button"
            >
              الكل ({inquiries.length})
            </button>
          </div>

          <div style={{ position: "relative", minWidth: "220px" }}>
            <Search
              size={15}
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
              placeholder="بحث بالسائق أو الشهر..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingRight: "2rem", width: "100%", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {/* List of Inquiries */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
            <CheckCircle2 size={36} color="#16a34a" style={{ margin: "0 auto 0.5rem" }} />
            <h4 style={{ margin: 0, color: "#1e293b" }}>لا توجد استفسارات في هذا القسم</h4>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              جميع اعتراضات واستفسارات السائقين تم التعامل معها.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "60vh", overflowY: "auto" }}>
            {filtered.map((inq) => (
              <div
                key={inq.id}
                className="surface"
                style={{
                  borderRadius: "10px",
                  padding: "1rem",
                  border: inq.status === "بانتظار الرد" ? "1.5px solid #f59e0b" : "1px solid #e2e8f0",
                  background: inq.status === "بانتظار الرد" ? "#fffdf5" : "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                      {inq.personName || `مستفيد #${inq.employeeOrDriverId}`}
                    </strong>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      فئة: <strong>{inq.personType === "driver" ? "سائق" : "موظف"}</strong> · مبلغ الخصم:{" "}
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>
                        {formatSAR(Number(inq.deductionAmount))}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Badge>{inq.status}</Badge>
                    <button
                      type="button"
                      className="btn primary"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                      onClick={() => handleOpenRespond(inq)}
                    >
                      {inq.status === "تم الرد" ? "تعديل الرد" : "الرد وإرفاق الإثبات"}
                    </button>
                  </div>
                </div>

                {/* Driver inquiry text */}
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    color: "#334155",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#64748b", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
                    نص استفسار السائق:
                  </div>
                  {inq.inquiryText}
                </div>

                {/* Existing response if present */}
                {inq.financeResponse && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#166534", fontSize: "0.78rem", marginBottom: "0.2rem" }}>
                      رد المالية المسجل ({inq.respondedByName || "الإدارة"}):
                    </div>
                    <div style={{ color: "#15803d" }}>{inq.financeResponse}</div>
                    {inq.proofDocUrl && (
                      <button
                        type="button"
                        className="btn outline"
                        style={{
                          marginTop: "0.4rem",
                          padding: "0.25rem 0.6rem",
                          fontSize: "0.75rem",
                          borderColor: "#16a34a",
                          color: "#166534",
                          background: "white",
                        }}
                        onClick={() =>
                          setPreviewDoc({
                            title: inq.proofDocName || "المستند المرفق",
                            url: inq.proofDocUrl!,
                          })
                        }
                      >
                        <Paperclip size={12} style={{ marginLeft: "4px" }} />
                        معاينة الإثبات / المخالفة المرفقة ({inq.proofDocName || "ملف"})
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal for responding */}
        {selectedInquiry && (
          <Modal
            title={`الرد على استفسار: ${selectedInquiry.personName || ""}`}
            onClose={() => setSelectedInquiry(null)}
          >
            <form onSubmit={handleSendResponse}>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <strong>صاحب الاستفسار:</strong> {selectedInquiry.personName} ({selectedInquiry.personType === "driver" ? "سائق" : "موظف"})
                </div>
                <div>
                  <strong>قيمة الخصم:</strong> {formatSAR(Number(selectedInquiry.deductionAmount))}
                </div>
                <div style={{ marginTop: "0.35rem", color: "#475569" }}>
                  <strong>نص الاستفسار:</strong> {selectedInquiry.inquiryText}
                </div>
              </div>

              <div className="field" style={{ marginBottom: "1rem" }}>
                <span>نص الرد والتوضيح للسائق *</span>
                <textarea
                  className="input"
                  rows={4}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="مثال: تم الخصم بناءً على مخالفة سرعة رصدتها منصة إيفاء / غياب يوم الأحد بدون إذن مسبق..."
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: "1rem" }}>
                <span>إرفاق إثبات / صورة مخالفة مرورية أو تقرير (اختياري)</span>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <label
                    className="btn outline"
                    style={{
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.45rem 0.85rem",
                    }}
                  >
                    <UploadCloud size={16} />
                    <span>رفع صورة المخالفة / المستند</span>
                    <input
                      type="file"
                      accept={SUPPORTED_UPLOAD_ACCEPT}
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                  {proofDocName && (
                    <span style={{ fontSize: "0.8rem", color: "#166534" }}>
                      ✓ {proofDocName}
                    </span>
                  )}
                </div>
              </div>

              <FormActions
                onCancel={() => setSelectedInquiry(null)}
                label={respondMutation.isPending ? "جارٍ الإرسال..." : "اعتماد وإرسال الرد"}
              />
            </form>
          </Modal>
        )}

        {/* Preview image modal */}
        {previewDoc && (
          <Modal title={previewDoc.title} onClose={() => setPreviewDoc(null)}>
            <div style={{ textAlign: "center", padding: "0.5rem" }}>
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  borderRadius: "8px",
                  objectFit: "contain",
                  border: "1px solid #e2e8f0",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button className="btn outline" onClick={() => setPreviewDoc(null)}>
                إغلاق
              </button>
            </div>
          </Modal>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button className="btn outline" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}
