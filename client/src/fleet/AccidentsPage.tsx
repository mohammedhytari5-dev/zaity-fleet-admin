import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCompanyDate } from "@shared/date-utils";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
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
} from "./common";

export function AccidentDetailModal({ accident, onClose }: { accident: Row; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: record } = trpc.accidents.detail.useQuery({ id: accident.id });
  const { data: events = [] } = trpc.accidents.events.useQuery({ id: accident.id });
  const advance = trpc.accidents.advance.useMutation();
  const [faultPercent, setFaultPercent] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [insurer, setInsurer] = useState("");
  const [claimRef, setClaimRef] = useState("");
  const [claimStatus, setClaimStatus] = useState("مرفوعة");
  const [settlement, setSettlement] = useState("");
  const [notes, setNotes] = useState("");
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

  const advanceToNext = () => {
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

    advance.mutate(
      { id: current.id, toStage: toStage as any, data: data as any },
      {
        onSuccess: () => {
          void utils.accidents.list.invalidate();
          void utils.accidents.detail.invalidate({ id: current.id });
          void utils.accidents.events.invalidate({ id: current.id });
          toast.success(`تم نقل الحادث إلى مرحلة ${toStage}`);
        },
        onError: (error) => toast.error(`تعذر نقل الحادث: ${error.message}`),
      }
    );
  };

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
        <section className="surface" style={{ marginTop: "1rem", padding: "1rem" }}>
          <strong>تقرير نجم · {current.najmReportName || current.najmReportNo}</strong>
          <div style={{ display: "flex", gap: ".75rem", marginTop: ".75rem" }}>
            <a className="btn outline" href={current.najmReportUrl} target="_blank" rel="noreferrer">
              معاينة التقرير
            </a>
            <a className="btn outline" href={current.najmReportUrl} download={current.najmReportName || "najm-report"}>
              تحميل التقرير
            </a>
          </div>
        </section>
      )}
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
      {nextStage[String(current.workflowStage)] && (
        <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
          <h3 style={{ marginBottom: ".75rem" }}>الانتقال إلى: {nextStage[String(current.workflowStage)]}</h3>
          <div className="form-grid">
            {nextStage[String(current.workflowStage)] === "تقدير الإصلاح" && (
              <>
                <Field label="نسبة المسؤولية %" type="number" value={faultPercent} onChange={setFaultPercent} />
                <div className="field-note">رقم تقرير نجم: {current.najmReportNo || "—"}</div>
              </>
            )}
            {nextStage[String(current.workflowStage)] === "مطالبة التأمين" && (
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
            {nextStage[String(current.workflowStage)] === "التسوية" && (
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
            {nextStage[String(current.workflowStage)] === "مغلق" && (
              <Field
                label="مبلغ التسوية النهائية (SAR)"
                type="number"
                value={settlement}
                onChange={setSettlement}
              />
            )}
            <Field label="ملاحظات الإجراء" value={notes} onChange={setNotes} />
          </div>
          <div className="detail-footer">
            <button className="btn primary" disabled={advance.isPending} onClick={advanceToNext}>
              اعتماد المرحلة التالية
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
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [uploading, setUploading] = useState(false);
  const records = data as Row[];

  const filtered = records.filter((row) =>
    `${row.ref} ${row.vehiclePlate} ${row.driverName} ${row.location} ${row.najmReportNo}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.vehicleId || !form.description || !form.occurredAt) {
      toast.error("اختر المركبة واكتب وصف الحادث وتاريخه");
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
      if (form.reportFile instanceof File) najmReportUrl = await readUploadDataUrl(form.reportFile);
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
          onSuccess: () => {
            setForm(null);
            void utils.accidents.list.invalidate();
            toast.success("تم تسجيل بلاغ الحادث");
          },
          onError: (error) => toast.error(`تعذر تسجيل الحادث: ${error.message}`),
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرفاق تقرير نجم");
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
    });

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الحوادث والتأمين"
        title="الحوادث"
        description="سجل بلاغ نجم، تحديد المسؤولية، تقدير الإصلاح، مطالبة شركة التأمين والتسوية النهائية."
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
          "تقرير نجم",
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
                <small>عرض تفاصيل الحادث</small>
              </button>
            </td>
            <td>{row.vehiclePlate}</td>
            <td>{row.driverName || "—"}</td>
            <td>{row.occurredAt}</td>
            <td>
              {row.najmReportNo || "بانتظار التقرير"}
              {row.hasNajmReport ? " · مرفق" : ""}
            </td>
            <td>
              <Badge>{row.workflowStage}</Badge>
            </td>
            <td>{row.insurerName || "—"}</td>
            <td className="actions-cell">
              <button className="btn outline" onClick={() => setSelected(row)}>
                التفاصيل والإجراء
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {form && (
        <Modal title="تسجيل بلاغ حادث" onClose={() => setForm(null)} wide>
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
                label="وصف الحادث *"
                value={form.description}
                onChange={(value) =>
                  setForm((prev) => (prev ? { ...prev, description: value } : prev))
                }
              />
              <label className="field">
                <span>تقرير نجم / صور الضرر</span>
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
              {form.reportFile && <div className="field-note">المرفق: {form.reportFile.name}</div>}
            </div>
            <FormActions
              onCancel={() => setForm(null)}
              label={uploading || createAccident.isPending ? "جارٍ الحفظ..." : "حفظ بلاغ الحادث"}
            />
          </form>
        </Modal>
      )}

      {selected && <AccidentDetailModal accident={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default AccidentsPage;
