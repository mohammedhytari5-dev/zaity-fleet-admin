import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCompanyDate } from "@shared/date-utils";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import { Download, Eye, FileText, Upload } from "lucide-react";
import type { Row, Vehicle, Driver } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  Modal,
  Field,
  FormActions,
  exportCsv,
  formatSAR,
  LinkedDocumentsSection,
  DocumentPreviewModal,
} from "./common";

export function AccidentDetailModal({ accident, onClose }: { accident: Row; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: record } = trpc.accidents.detail.useQuery({ id: accident.id });
  const { data: events = [] } = trpc.accidents.events.useQuery({ id: accident.id });
  const advance = trpc.accidents.advance.useMutation();
  const createDocument = trpc.documents.create.useMutation();
  const [faultPercent, setFaultPercent] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [insurer, setInsurer] = useState("");
  const [claimRef, setClaimRef] = useState("");
  const [claimStatus, setClaimStatus] = useState("مرفوعة");
  const [settlement, setSettlement] = useState("");
  const [notes, setNotes] = useState("");
  const [stageFile, setStageFile] = useState<File | null>(null);
  const [stageDocName, setStageDocName] = useState("");
  const [uploadingStage, setUploadingStage] = useState(false);
  const [previewNajm, setPreviewNajm] = useState(false);

  const current = (record ?? accident) as Row;

  const nextStage: Record<string, string | null> = {
    "بلاغ": "تحديد المسؤولية",
    "تحديد المسؤولية": "تقدير الإصلاح",
    "تقدير الإصلاح": "مطالبة التأمين",
    "مطالبة التأمين": "التسوية",
    "التسوية": "مغلق",
    "مغلق": null,
    "ملغي": null,
  };

  const getStageDocPlaceholder = (stage: string) => {
    switch (stage) {
      case "تقدير الإصلاح":
        return { label: "تقرير تقدير الورشة / تكلفة الإصلاح", type: "تقدير إصلاح" };
      case "مطالبة التأمين":
        return { label: "نموذج مطالبة التأمين / إشعار المطالبة", type: "مطالبة تأمين" };
      case "التسوية":
        return { label: "مخالصة وسند استلام التعويض", type: "مخالصة تسوية" };
      case "تحديد المسؤولية":
        return { label: "تقرير المرور / إشعار تحديد المسؤولية", type: "تقرير المرور" };
      default:
        return { label: "مستند داعم للمرحلة", type: "مستند حادث" };
    }
  };

  const advanceToNext = async () => {
    const toStage = nextStage[String(current.workflowStage)];
    if (!toStage) return;
    const data: Record<string, unknown> = { resolutionNotes: notes.trim() || undefined };
    if (toStage === "تقدير الإصلاح") {
      data.faultPercent = Number(faultPercent);
      data.najmReportNo = current.najmReportNo;
    }
    if (toStage === "مطالبة التأمين") {
      data.estimatedRepairCost = Number(repairCost);
      data.insurerName = insurer.trim();
    }
    if (toStage === "التسوية") {
      data.insurerClaimRef = claimRef.trim();
      data.insurerClaimStatus = claimStatus;
    }
    if (toStage === "مغلق") data.settlementAmount = Number(settlement);

    setUploadingStage(true);
    try {
      if (stageFile) {
        const fileUrl = await readUploadDataUrl(stageFile);
        const docConfig = getStageDocPlaceholder(toStage);
        await createDocument.mutateAsync({
          name: stageDocName.trim() || `${docConfig.label} - ${current.ref}`,
          entity: `حادث ${current.ref} (${current.vehiclePlate})`,
          entityType: "حادث",
          entityId: current.id,
          type: docConfig.type,
          expiry: "—",
          status: "ساري",
          fileName: stageFile.name,
          fileUrl,
        });
        await utils.documents.list.invalidate();
      }

      advance.mutate(
        { id: current.id, toStage: toStage as any, data: data as any },
        {
          onSuccess: () => {
            void utils.accidents.list.invalidate();
            void utils.accidents.detail.invalidate({ id: current.id });
            void utils.accidents.events.invalidate({ id: current.id });
            setStageFile(null);
            setStageDocName("");
            toast.success(`تم نقل الحادث إلى مرحلة ${toStage} بنجاح`);
          },
          onError: (error) => toast.error(`تعذر نقل الحادث: ${error.message}`),
        }
      );
    } catch (err: any) {
      toast.error(err.message || "تعذر إرفاق مستند المرحلة");
    } finally {
      setUploadingStage(false);
    }
  };

  const toStageName = nextStage[String(current.workflowStage)];
  const stageDocConfig = toStageName ? getStageDocPlaceholder(toStageName) : null;

  return (
    <Modal title={`بلاغ الحادث · ${current.ref}`} onClose={onClose} wide>
      <div className="quick-metrics">
        <div>
          <span>المركبة</span>
          <strong>{current.vehiclePlate}</strong>
        </div>
        <div>
          <span>السائق</span>
          <strong>{current.driverName || "—"}</strong>
        </div>
        <div>
          <span>تاريخ الحادث</span>
          <strong>{current.occurredAt}</strong>
        </div>
        <div>
          <span>المرحلة</span>
          <strong>{current.workflowStage}</strong>
        </div>
      </div>
      <div className="detail-grid">
        {[
          ["الموقع", current.location],
          ["الوصف", current.description],
          ["رقم تقرير نجم", current.najmReportNo],
          ["نسبة المسؤولية", current.faultPercent == null ? "لم تحدد" : `${current.faultPercent}%`],
          ["تقدير الإصلاح", current.estimatedRepairCost == null ? "لم يسجل" : formatSAR(current.estimatedRepairCost)],
          ["شركة التأمين", current.insurerName || "—"],
          ["رقم المطالبة", current.insurerClaimRef || "—"],
          ["حالة مطالبة التأمين", current.insurerClaimStatus || "—"],
          ["التسوية النهائية", current.settlementAmount == null ? "لم تسجل" : formatSAR(current.settlementAmount)],
        ].map(([label, value]) => (
          <div className="detail-cell" key={String(label)}>
            <span>{label}</span>
            <strong>{String(value ?? "—")}</strong>
          </div>
        ))}
      </div>

      {current.najmReportUrl && (
        <section className="surface" style={{ marginTop: "1rem", padding: "1.1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <strong style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                <FileText size={17} style={{ color: "var(--teal)" }} />
                تقرير نجم / البلاغ الأساسي
              </strong>
              <small style={{ color: "var(--muted)", display: "block", marginTop: 3 }}>
                {current.najmReportName || current.najmReportNo || "تقرير الحادث المعتمد"}
              </small>
            </div>
            <div style={{ display: "flex", gap: ".6rem" }}>
              <button
                type="button"
                className="btn outline"
                onClick={() => setPreviewNajm(true)}
              >
                <Eye size={15} /> معاينة داخل النظام
              </button>
              <a
                className="btn outline"
                href={current.najmReportUrl}
                download={current.najmReportName || "najm-report"}
              >
                <Download size={15} /> تحميل
              </a>
            </div>
          </div>
        </section>
      )}

      {/* In-system preview modal for Najm report */}
      {previewNajm && current.najmReportUrl && (
        <DocumentPreviewModal
          title={`تقرير نجم · ${current.ref}`}
          fileName={current.najmReportName || `najm-report-${current.najmReportNo || current.ref}`}
          fileUrl={current.najmReportUrl}
          type="تقرير نجم"
          entity={`حادث ${current.ref} (${current.vehiclePlate})`}
          status="ساري"
          onClose={() => setPreviewNajm(false)}
        />
      )}

      {/* Linked documents across all accident stages */}
      <LinkedDocumentsSection
        entityType="حادث"
        entityId={current.id}
        entityName={`حادث ${current.ref} (${current.vehiclePlate})`}
        canViewDocuments={true}
        canUpload={true}
      />

      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h3>سجل الإجراءات</h3>
            <span>المرحلة والمنفذ والتوقيت</span>
          </div>
        </div>
        <div className="compact-list">
          {(events ?? []).map((event) => (
            <div className="compact-row" key={event.id}>
              <div className="compact-main">
                <strong>{event.fromStage ? `${event.fromStage} ← ${event.toStage}` : event.toStage}</strong>
                <small>
                  {event.actorName} ·{" "}
                  {event.createdAt ? new Date(event.createdAt).toLocaleString("ar-SA") : ""} ·{" "}
                  {event.details || ""}
                </small>
              </div>
            </div>
          ))}
        </div>
        {(events ?? []).length === 0 && <div className="empty-state">لا يوجد سجل إجراءات.</div>}
      </section>

      {toStageName && (
        <section className="surface" style={{ padding: "1.25rem", marginTop: "1rem" }}>
          <h3 style={{ marginBottom: ".85rem", fontSize: 14 }}>
            الانتقال إلى المرحلة التالية: {toStageName}
          </h3>
          <div className="form-grid">
            {toStageName === "تقدير الإصلاح" && (
              <>
                <Field label="نسبة المسؤولية %" type="number" value={faultPercent} onChange={setFaultPercent} />
                <div className="field-note">رقم تقرير نجم: {current.najmReportNo || "—"}</div>
              </>
            )}
            {toStageName === "مطالبة التأمين" && (
              <>
                <Field
                  label="تقدير تكلفة الإصلاح (SAR)"
                  type="number"
                  value={repairCost}
                  onChange={setRepairCost}
                />
                <Field label="شركة التأمين" value={insurer} onChange={setInsurer} />
              </>
            )}
            {toStageName === "التسوية" && (
              <>
                <Field label="رقم مطالبة التأمين" value={claimRef} onChange={setClaimRef} />
                <label className="field">
                  <span>حالة المطالبة</span>
                  <select value={claimStatus} onChange={(event) => setClaimStatus(event.target.value)}>
                    <option>مرفوعة</option>
                    <option>مقبولة</option>
                    <option>مرفوضة</option>
                    <option>مصروفة</option>
                  </select>
                </label>
              </>
            )}
            {toStageName === "مغلق" && (
              <Field
                label="مبلغ التسوية النهائية (SAR)"
                type="number"
                value={settlement}
                onChange={setSettlement}
              />
            )}
            <Field label="ملاحظات الإجراء" value={notes} onChange={setNotes} />

            {/* Document upload for this stage */}
            {stageDocConfig && (
              <div style={{ gridColumn: "1 / -1", background: "#f8faf9", padding: "12px", borderRadius: "10px", border: "1px dashed #d1deda" }}>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Upload size={14} style={{ color: "var(--teal)" }} />
                    إرفاق مستند لهذه المرحلة ({stageDocConfig.label})
                  </span>
                  <input
                    type="file"
                    accept={SUPPORTED_UPLOAD_ACCEPT}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setStageFile(file);
                      if (file && !stageDocName) setStageDocName(file.name);
                    }}
                    style={{ marginTop: 6 }}
                  />
                </label>
                {stageFile && (
                  <div className="field-note" style={{ marginTop: 6 }}>
                    الملف المحدد للرفع: <strong>{stageFile.name}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="detail-footer">
            <button
              className="btn primary"
              disabled={advance.isPending || uploadingStage}
              onClick={advanceToNext}
            >
              {uploadingStage ? "جارٍ الرفع والاعتماد..." : "اعتماد المرحلة التالية"}
            </button>
            <button className="btn ghost" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </section>
      )}
    </Modal>
  );
}

export function AccidentsPage({ vehicles, drivers }: { vehicles: Vehicle[]; drivers: Driver[] }) {
  const utils = trpc.useUtils();
  const { data = [] } = trpc.accidents.list.useQuery(undefined, { staleTime: 15000 });
  const createAccident = trpc.accidents.create.useMutation();
  const createDocument = trpc.documents.create.useMutation();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [tablePreviewDoc, setTablePreviewDoc] = useState<{ url: string; name: string; title: string; entity: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const records = data as Row[];

  const filtered = records.filter((row) =>
    `${row.ref} ${row.vehiclePlate} ${row.driverName} ${row.location} ${row.najmReportNo}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.vehicleId || !form.occurredAt || !form.description || form.description.trim().length < 5) {
      toast.error("يرجى اختيار المركبة وتاريخ الحادث وكتابة وصف لا يقل عن 5 أحرف");
      return;
    }
    const vehicle = vehicles.find((row) => row.id === Number(form.vehicleId));
    const driver = drivers.find((row) => row.id === Number(form.driverId));
    if (!vehicle) {
      toast.error("المركبة المختارة غير متاحة");
      return;
    }
    setUploading(true);
    try {
      let najmReportUrl: string | null = null;
      let damagePhotosUrl: string | null = null;

      if (form.reportFile instanceof File) {
        najmReportUrl = await readUploadDataUrl(form.reportFile);
      }
      if (form.damageFile instanceof File) {
        damagePhotosUrl = await readUploadDataUrl(form.damageFile);
      }

      createAccident.mutate(
        {
          ref: `AC-${Date.now()}`,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
          driverId: driver?.id ?? null,
          driverName: driver?.name ?? "—",
          occurredAt: String(form.occurredAt),
          location: String(form.location || "—"),
          description: String(form.description),
          najmReportNo: String(form.najmReportNo || "—"),
          najmReportName: form.reportFile instanceof File ? form.reportFile.name : null,
          najmReportUrl,
        },
        {
          onSuccess: async (createdAccident: any) => {
            const accId = createdAccident?.id;
            const accRef = createdAccident?.ref || `AC-${Date.now()}`;

            // Save Najm Report to central documents table
            if (najmReportUrl && accId) {
              try {
                await createDocument.mutateAsync({
                  name: `تقرير نجم - ${accRef}`,
                  entity: `حادث ${accRef} (${vehicle.plate})`,
                  entityType: "حادث",
                  entityId: accId,
                  type: "تقرير نجم",
                  expiry: "—",
                  status: "ساري",
                  fileName: form.reportFile instanceof File ? form.reportFile.name : "najm-report",
                  fileUrl: najmReportUrl,
                });
              } catch (e) {
                console.error("Failed to link report to documents", e);
              }
            }

            // Save Damage Photos to central documents table
            if (damagePhotosUrl && accId) {
              try {
                await createDocument.mutateAsync({
                  name: `صور أضرار الحادث - ${accRef}`,
                  entity: `حادث ${accRef} (${vehicle.plate})`,
                  entityType: "حادث",
                  entityId: accId,
                  type: "صور أضرار",
                  expiry: "—",
                  status: "ساري",
                  fileName: form.damageFile instanceof File ? form.damageFile.name : "damage-photos",
                  fileUrl: damagePhotosUrl,
                });
              } catch (e) {
                console.error("Failed to link damage photos to documents", e);
              }
            }

            setForm(null);
            void utils.accidents.list.invalidate();
            void utils.documents.list.invalidate();
            toast.success("تم تسجيل بلاغ الحادث وإرفاق المستندات بنجاح");
          },
          onError: (error) => {
            let msg = error.message;
            try {
              const parsed = JSON.parse(error.message);
              if (Array.isArray(parsed) && parsed[0]?.message) {
                msg = parsed[0].message;
              }
            } catch {}
            toast.error(`تعذر تسجيل الحادث: ${msg}`);
          },
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تجهيز مرفقات الحادث");
    } finally {
      setUploading(false);
    }
  };

  const openNew = () =>
    setForm({
      id: Date.now(),
      vehicleId: "",
      driverId: "",
      occurredAt: formatCompanyDate(),
      location: "",
      description: "",
      najmReportNo: "",
      reportFile: null,
      damageFile: null,
    });

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الحوادث والتأمين"
        title="الحوادث"
        description="سجل بلاغ نجم، تحديد المسؤولية، تقدير الإصلاح، مطالبة شركة التأمين والتسوية النهائية مع حفظ ومزامنة كافة المستندات."
        action="تسجيل حادث"
        onAction={openNew}
      />

      <div className="quick-metrics">
        <div>
          <span>إجمالي البلاغات</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>قيد المعالجة</span>
          <strong>
            {records.filter((item) => !["مغلق", "ملغي"].includes(item.workflowStage)).length}
          </strong>
        </div>
        <div>
          <span>مطالبات تأمين مفتوحة</span>
          <strong className="amber-text">
            {records.filter((item) => ["مرفوعة", "مقبولة"].includes(item.insurerClaimStatus)).length}
          </strong>
        </div>
        <div>
          <span>مغلقة</span>
          <strong className="green-text">
            {records.filter((item) => item.workflowStage === "مغلق").length}
          </strong>
        </div>
      </div>

      <TableShell
        columns={[
          "رقم البلاغ",
          "المركبة",
          "السائق",
          "تاريخ الحادث",
          "تقرير نجم / المرفقات",
          "المرحلة",
          "شركة التأمين",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            [
              "ref",
              "vehiclePlate",
              "driverName",
              "occurredAt",
              "najmReportNo",
              "workflowStage",
              "insurerName",
              "insurerClaimStatus",
              "estimatedRepairCost",
              "settlementAmount",
            ],
            "accidents"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل"]}
        activeTab="الكل"
        setActiveTab={() => {}}
        addLabel="تسجيل حادث"
        onAdd={openNew}
      >
        {filtered.map((row) => (
          <tr key={row.id}>
            <td>
              <button className="driver-name-button" onClick={() => setSelected(row)}>
                <strong className="table-primary">{row.ref}</strong>
                <small>عرض تفاصيل الحادث والمستندات</small>
              </button>
            </td>
            <td>{row.vehiclePlate}</td>
            <td>{row.driverName || "—"}</td>
            <td>{row.occurredAt}</td>
            <td>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{row.najmReportNo || "بانتظار التقرير"}</span>
                {row.najmReportUrl && (
                  <button
                    type="button"
                    className="row-menu-btn"
                    title="معاينة تقرير نجم داخل النظام"
                    onClick={() =>
                      setTablePreviewDoc({
                        url: row.najmReportUrl,
                        name: row.najmReportName || `najm-${row.ref}`,
                        title: `تقرير نجم · ${row.ref}`,
                        entity: `حادث ${row.ref} (${row.vehiclePlate})`,
                      })
                    }
                  >
                    <Eye size={15} />
                  </button>
                )}
              </div>
            </td>
            <td>
              <Badge>{row.workflowStage}</Badge>
            </td>
            <td>{row.insurerName || "—"}</td>
            <td className="actions-cell">
              <button className="btn outline" onClick={() => setSelected(row)}>
                التفاصيل والمستندات
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {/* Table Row In-System Preview Modal */}
      {tablePreviewDoc && (
        <DocumentPreviewModal
          title={tablePreviewDoc.title}
          fileName={tablePreviewDoc.name}
          fileUrl={tablePreviewDoc.url}
          type="تقرير نجم"
          entity={tablePreviewDoc.entity}
          status="ساري"
          onClose={() => setTablePreviewDoc(null)}
        />
      )}

      {form && (
        <Modal title="تسجيل بلاغ حادث جديد" onClose={() => setForm(null)} wide>
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="field">
                <span>المركبة *</span>
                <select
                  value={form.vehicleId}
                  onChange={(event) => {
                    const chosen = vehicles.find((row) => String(row.id) === event.target.value);
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            vehicleId: chosen?.id ?? "",
                            driverId: chosen?.driverId ?? "",
                          }
                        : prev
                    );
                  }}
                >
                  <option value="">اختر مركبة</option>
                  {vehicles.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.plate} · {row.brand} {row.model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>السائق</span>
                <select
                  value={form.driverId}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, driverId: event.target.value } : prev))
                  }
                >
                  <option value="">غير محدد</option>
                  {drivers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="تاريخ الحادث *"
                type="date"
                value={form.occurredAt}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, occurredAt: value } : prev))
                }
              />
              <Field
                label="موقع الحادث"
                value={form.location}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, location: value } : prev))
                }
              />
              <Field
                label="رقم تقرير نجم"
                value={form.najmReportNo}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, najmReportNo: value } : prev))
                }
              />
              <Field
                label="وصف الحادث * (5 أحرف على الأقل)"
                value={form.description}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, description: value } : prev))
                }
                placeholder="مثال: صدم من الخلف أثناء التوقف عند الإشارة..."
              />
              <label className="field">
                <span>تقرير نجم / تقرير المرور (PDF أو صورة)</span>
                <input
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, reportFile: event.target.files?.[0] ?? null } : prev
                    )
                  }
                />
              </label>
              <label className="field">
                <span>صور أضرار الحادث (اختياري)</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, damageFile: event.target.files?.[0] ?? null } : prev
                    )
                  }
                />
              </label>
              {form.reportFile && (
                <div className="field-note" style={{ gridColumn: "1 / -1" }}>
                  تقرير الحادث المرفق: <strong>{form.reportFile.name}</strong>
                </div>
              )}
              {form.damageFile && (
                <div className="field-note" style={{ gridColumn: "1 / -1" }}>
                  صور الأضرار المرفقة: <strong>{form.damageFile.name}</strong>
                </div>
              )}
            </div>
            <FormActions
              onCancel={() => setForm(null)}
              label={uploading || createAccident.isPending ? "جارٍ الحفظ والمزامنة..." : "حفظ بلاغ الحادث والمستندات"}
            />
          </form>
        </Modal>
      )}

      {selected && <AccidentDetailModal accident={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default AccidentsPage;
