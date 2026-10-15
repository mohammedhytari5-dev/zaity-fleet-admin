import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCompanyDate } from "@shared/date-utils";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { Badge, Modal, Field, FormActions, formatSAR } from "../common";
import type { Driver, Vehicle } from "../types";

export function DailyInspectionAlertBanner({
  inspections,
  onStartInspection,
}: {
  inspections: Array<{ createdAt?: string | Date; inspectionDate?: string | Date }>;
  onStartInspection: () => void;
}) {
  const today = formatCompanyDate();
  const hasInspectedToday = inspections.some((ins) => {
    const raw = ins.createdAt || ins.inspectionDate;
    if (!raw) return false;
    const d = typeof raw === "string" ? raw.slice(0, 10) : raw instanceof Date ? raw.toISOString().slice(0, 10) : "";
    return d === today;
  });

  if (hasInspectedToday) {
    return (
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
          padding: "0.85rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#15803d",
          fontSize: "0.9rem",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <CheckCircle2 size={20} />
          <span>تم تسجيل فحص باصك بنجاح اليوم ({today}). قيادة آمنة وموفقة!</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
        border: "1.5px solid #f59e0b",
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            background: "#f59e0b",
            color: "white",
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={22} />
        </div>
        <div>
          <h4 style={{ margin: 0, color: "#92400e", fontSize: "1rem", fontWeight: 800 }}>
            تنبيه: لم تقم بإجراء فحص الباص اليومي لتاريخ اليوم!
          </h4>
          <p style={{ margin: "0.2rem 0 0", color: "#b45309", fontSize: "0.84rem" }}>
            يرجى فحص الزيت وماء الرديتر وضغط الإطارات وأنوار الباص قبل بدء العمل لسلامتك وسلامة الركاب.
          </p>
        </div>
      </div>

      <button
        className="btn primary"
        onClick={onStartInspection}
        style={{
          background: "#d97706",
          color: "white",
          border: "none",
          fontWeight: 700,
          padding: "0.6rem 1.25rem",
          borderRadius: "8px",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <Bus size={16} />
        تسجيل الفحص اليومي الآن
      </button>
    </div>
  );
}

export function DriverMaintenanceSection({
  driverId,
  driverName,
  vehicles,
}: {
  driverId?: number;
  driverName?: string;
  vehicles: Vehicle[];
}) {
  const utils = trpc.useUtils();
  const maintenanceQuery = trpc.maintenance.list.useQuery();
  const completeMutation = trpc.maintenance.completeDriver.useMutation();

  const [selectedMaintForCompletion, setSelectedMaintForCompletion] = useState<any | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [invoiceName, setInvoiceName] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");

  const allRequests = maintenanceQuery.data ?? [];
  // Filter for this driver's vehicle or requests reported by him
  const myRequests = allRequests.filter(
    (m) =>
      (driverName && m.reportedBy?.includes(driverName)) ||
      (m.vehicleId && vehicles.some((v) => v.id === m.vehicleId && (v.driver === driverName || (v as any).driverId === driverId)))
  );

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaintForCompletion) return;
    if (!invoiceUrl) {
      toast.error("يرجى إرفاق صورة فاتورة الإصلاح أو قطع الغيار");
      return;
    }

    try {
      await completeMutation.mutateAsync({
        id: selectedMaintForCompletion.id,
        invoiceUrl,
        notes: completionNotes,
      });
      toast.success("تم تأكيد إنجاز الصيانة ورفع الفاتورة بنجاح");
      setSelectedMaintForCompletion(null);
      setInvoiceUrl("");
      setInvoiceName("");
      setCompletionNotes("");
      utils.maintenance.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر إكمال طلب الصيانة");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#1e293b" }}>
            متابعة صيانة الباص وإرفاق الفواتير
          </h3>
          <p style={{ margin: "0.2rem 0 0", color: "#64748b", fontSize: "0.85rem" }}>
            عند تحويل تكلفة الصيانة لك، قم بالإصلاح ثم ارفع صورة الفاتورة واضغط «تم الإصلاح»
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
        {myRequests.map((req) => {
          const hasFunding = Boolean(req.fundingAmount && Number(req.fundingAmount) > 0);
          const isDoneByDriver = Boolean(req.driverCompletedAt);

          return (
            <div
              key={req.id}
              className="surface"
              style={{
                borderRadius: "12px",
                padding: "1.1rem",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563eb" }}>{req.ref}</span>
                    <h4 style={{ margin: "0.25rem 0 0", fontSize: "1rem", fontWeight: 700 }}>{req.vehicle}</h4>
                  </div>
                  <Badge>{req.workflowStage}</Badge>
                </div>

                <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "#475569" }}>
                  <strong>نوع الصيانة: </strong>{req.type}
                </p>

                {hasFunding && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      color: "#166534",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong>تم تحويل المبلغ للإصلاح: </strong>
                    <span style={{ fontWeight: 800 }}>{formatSAR(Number(req.fundingAmount))}</span>
                    <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "0.15rem" }}>
                      طريقة الصرف: {req.fundingType} ({req.fundingReference || "معتمد"})
                    </div>
                  </div>
                )}

                {isDoneByDriver ? (
                  <div style={{ fontSize: "0.8rem", color: "#15803d", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <CheckCircle2 size={15} />
                    <span>تم الإصلاح ورفع الفاتورة بنجاح</span>
                  </div>
                ) : (
                  req.approvalStatus === "معتمد" && (
                    <button
                      className="btn primary"
                      style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem", fontSize: "0.85rem" }}
                      onClick={() => setSelectedMaintForCompletion(req)}
                    >
                      <UploadCloud size={16} style={{ marginLeft: "4px" }} />
                      إرفاق الفاتورة وتأكيد «تم الإصلاح»
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}

        {myRequests.length === 0 && (
          <div className="surface" style={{ padding: "2rem", textAlign: "center", color: "#64748b", gridColumn: "1 / -1" }}>
            لا توجد طلبات صيانة حالية مرتبطة بباصك.
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {selectedMaintForCompletion && (
        <Modal
          title={`إرفاق فاتورة الإصلاح لطلب (${selectedMaintForCompletion.ref})`}
          onClose={() => setSelectedMaintForCompletion(null)}
        >
          <form onSubmit={handleCompleteSubmit}>
            <div style={{ marginBottom: "1rem", fontSize: "0.88rem", color: "#475569" }}>
              يرجى رفع صورة واضحة لفاتورة الورشة أو قطع الغيار لتأكيد انتهاء أعمال الصيانة وتصفية المبلغ المحول.
            </div>

            <div className="field" style={{ marginBottom: "1rem" }}>
              <span>صورة الفاتورة *</span>
              <input
                type="file"
                accept={SUPPORTED_UPLOAD_ACCEPT}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const url = await readUploadDataUrl(file);
                      setInvoiceUrl(url);
                      setInvoiceName(file.name);
                      toast.success("تم تجهيز صورة الفاتورة");
                    } catch {
                      toast.error("تعذر تحميل الملف");
                    }
                  }
                }}
              />
              {invoiceName && (
                <div style={{ fontSize: "0.8rem", color: "#10b981", marginTop: "0.25rem" }}>
                  تم اختيار: {invoiceName}
                </div>
              )}
            </div>

            <Field
              label="ملاحظات بعد الإصلاح (اختياري)"
              value={completionNotes}
              onChange={setCompletionNotes}
              placeholder="مثال: تم تغيير الزيت والفلاتر والسيارة جاهزة للعمل"
            />

            <FormActions
              onCancel={() => setSelectedMaintForCompletion(null)}
              label={completeMutation.isPending ? "جارٍ الحفظ..." : "تأكيد إنجاز الصيانة وإرسال الفاتورة"}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

export function DriverPayrollDisputesSection({
  driverId,
  driverName,
}: {
  driverId?: number;
  driverName?: string;
}) {
  const utils = trpc.useUtils();
  const payrollQuery = trpc.payroll.list.useQuery();
  const inquiriesQuery = trpc.payrollInquiry.list.useQuery(
    driverId ? { employeeOrDriverId: driverId, personType: "driver" } : undefined
  );
  const createInquiryMutation = trpc.payrollInquiry.create.useMutation();

  const [inquiryModalPayroll, setInquiryModalPayroll] = useState<any | null>(null);
  const [inquiryText, setInquiryText] = useState("");
  const [activeProofModal, setActiveProofModal] = useState<{ title: string; url: string; notes?: string } | null>(null);

  const allPayrolls = payrollQuery.data ?? [];
  // Filter for this driver
  const myPayrolls = allPayrolls.filter(
    (p) => (driverId && p.employeeId === driverId) || (driverName && p.employeeName?.includes(driverName))
  );

  const inquiries = inquiriesQuery.data ?? [];

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryModalPayroll) return;
    if (!inquiryText.trim()) {
      toast.error("يرجى كتابة نص الاستفسار أو سبب الاعتراض");
      return;
    }

    try {
      await createInquiryMutation.mutateAsync({
        payrollId: inquiryModalPayroll.id,
        employeeOrDriverId: driverId || inquiryModalPayroll.employeeId,
        personType: "driver",
        personName: driverName || inquiryModalPayroll.employeeName,
        deductionAmount: Number(inquiryModalPayroll.deductions || 0),
        inquiryText,
      });
      toast.success("تم إرسال استفسارك للمالية بنجاح، وسترد عليك المالية بالمستندات رسمياً");
      setInquiryModalPayroll(null);
      setInquiryText("");
      utils.payrollInquiry.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر إرسال الاستفسار");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#1e293b" }}>
          كشوفات الرواتب والاستفسارات عن الخصومات
        </h3>
        <p style={{ margin: "0.2rem 0 0", color: "#64748b", fontSize: "0.85rem" }}>
          كشف رسمي بمفردات راتبك والبدلات؛ وفي حال وجود خصم يمكنك تقديم اعتراض رسمي وتستلم رد المالية ومرفقات المخالفات هنا مباشرة
        </p>
      </div>

      {/* Payroll cards list */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
        {myPayrolls.map((payroll) => {
          const deductions = Number(payroll.deductions || 0);
          const hasInquiry = inquiries.some((inq) => inq.payrollId === payroll.id);

          return (
            <div
              key={payroll.id}
              className="surface"
              style={{
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                    راتب شهر {payroll.month}
                  </h4>
                  <Badge>{payroll.status}</Badge>
                </div>

                {/* Salary breakdown table */}
                <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                    <span>الراتب الأساسي:</span>
                    <strong style={{ color: "#0f172a" }}>{formatSAR(Number(payroll.basicSalary || 0))}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                    <span>إجمالي البدلات:</span>
                    <strong style={{ color: "#16a34a" }}>+{formatSAR(Number(payroll.allowances || 0))}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                    <span>الخصومات والجزاءات:</span>
                    <strong style={{ color: deductions > 0 ? "#dc2626" : "#64748b" }}>
                      -{formatSAR(deductions)}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: "0.5rem",
                      marginTop: "0.25rem",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>صافي الراتب المستلم:</span>
                    <strong style={{ color: "#2563eb", fontWeight: 800 }}>
                      {formatSAR(Number(payroll.netSalary || 0))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Inquiry Action */}
              {deductions > 0 && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                  {hasInquiry ? (
                    <div style={{ fontSize: "0.8rem", color: "#d97706", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Clock size={14} />
                      <span>يوجد استفسار مسجل على هذا الخصم (انظر أدناه)</span>
                    </div>
                  ) : (
                    <button
                      className="btn outline"
                      style={{
                        width: "100%",
                        borderColor: "#f59e0b",
                        color: "#b45309",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        padding: "0.45rem",
                      }}
                      onClick={() => setInquiryModalPayroll(payroll)}
                    >
                      <HelpCircle size={15} style={{ marginLeft: "4px" }} />
                      استفسار أو اعتراض على الخصم
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {myPayrolls.length === 0 && (
          <div className="surface" style={{ padding: "2rem", textAlign: "center", color: "#64748b", gridColumn: "1 / -1" }}>
            لا توجد كشوفات رواتب مسجلة حتى الآن.
          </div>
        )}
      </div>

      {/* Previous Inquiries / Disputes */}
      {inquiries.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
            سجل الاستفسارات والردود من الإدارة المالية
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {inquiries.map((inq) => (
              <div
                key={inq.id}
                className="surface"
                style={{
                  borderRadius: "10px",
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MessageSquare size={16} color="#2563eb" />
                    <strong>استفسار عن خصم مبلغ: {formatSAR(Number(inq.deductionAmount))}</strong>
                  </div>
                  <Badge>{inq.status}</Badge>
                </div>

                <div style={{ fontSize: "0.85rem", color: "#475569", background: "#f8fafc", padding: "0.6rem", borderRadius: "6px" }}>
                  {inq.inquiryText}
                </div>

                {inq.financeResponse ? (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      padding: "0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#166534", marginBottom: "0.25rem" }}>
                      رد وتوضيح المالية ({inq.respondedByName || "الإدارة"}):
                    </div>
                    <div style={{ color: "#1e293b" }}>{inq.financeResponse}</div>

                    {inq.proofDocUrl && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn outline"
                          style={{
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.78rem",
                            borderColor: "#16a34a",
                            color: "#166534",
                            background: "white",
                          }}
                          onClick={() =>
                            setActiveProofModal({
                              title: inq.proofDocName || "مستند/صورة المخالفة أو الإثبات",
                              url: inq.proofDocUrl!,
                              notes: inq.financeResponse || undefined,
                            })
                          }
                        >
                          <Paperclip size={13} style={{ marginLeft: "4px" }} />
                          معاينة صورة المخالفة / الإثبات المرفق
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#d97706" }}>
                    ⏳ الطلب قيد مراجعة وتدقيق الإدارة المالية، سيتم الرد عليك هنا قريباً.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inquiry Modal */}
      {inquiryModalPayroll && (
        <Modal
          title={`استفسار عن خصم راتب شهر (${inquiryModalPayroll.month})`}
          onClose={() => setInquiryModalPayroll(null)}
        >
          <form onSubmit={handleInquirySubmit}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                padding: "0.75rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                fontSize: "0.85rem",
                color: "#991b1b",
              }}
            >
              <strong>مبلغ الخصم المسجل: </strong>
              <span>{formatSAR(Number(inquiryModalPayroll.deductions))}</span>
            </div>

            <div className="field" style={{ marginBottom: "1rem" }}>
              <span>اكتب استفسارك أو اعتراضك للإدارة المالية *</span>
              <textarea
                className="input"
                rows={4}
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                placeholder="اكتب تفاصيل استفسارك (مثال: أرجو توضيح سبب خصم هذا المبلغ وتزويدي بصورة المخالفة أو التقرير)..."
                required
              />
            </div>

            <FormActions
              onCancel={() => setInquiryModalPayroll(null)}
              label={createInquiryMutation.isPending ? "جارٍ الإرسال..." : "إرسال الاستفسار للمالية"}
            />
          </form>
        </Modal>
      )}

      {/* Proof Photo Modal */}
      {activeProofModal && (
        <Modal title={activeProofModal.title} onClose={() => setActiveProofModal(null)}>
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <img
              src={activeProofModal.url}
              alt={activeProofModal.title}
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                borderRadius: "8px",
                objectFit: "contain",
                border: "1px solid #e2e8f0",
              }}
            />
            {activeProofModal.notes && (
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#475569" }}>
                {activeProofModal.notes}
              </p>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button className="btn outline" onClick={() => setActiveProofModal(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

