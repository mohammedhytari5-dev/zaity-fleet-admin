import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { formatCompanyDate } from "@shared/date-utils";
import { nextMaintenanceStages, type MaintenanceStage } from "@shared/maintenance-domain";
import { summarizeMaintenanceCost } from "@shared/maintenance-cost-summary";
import { isLinkedDocument } from "@/lib/documentRelations";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MoreHorizontal,
  Pencil,
  Wrench,
} from "lucide-react";
import type { Row, Vehicle, Driver, Maintenance, Document, PayableRow } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  Modal,
  ContextMenu,
  LinkedDocumentsSection,
  DocumentFileActions,
  exportCsv,
  formatSAR,
} from "./common";

export function MaintenanceInvoicesSection({
  requestId,
  invoices,
  canViewPayables,
  onOpenPayables,
}: {
  requestId: number;
  invoices: PayableRow[];
  canViewPayables: boolean;
  onOpenPayables: () => void;
}) {
  const utils = trpc.useUtils();
  const linked = canViewPayables
    ? invoices.filter((invoice) => invoice.maintenanceRequestId === requestId)
    : [];

  const openReceipt = async (invoice: PayableRow) => {
    try {
      const receipt = await utils.payables.receipt.fetch({ id: invoice.id });
      if (!receipt?.url) throw new Error("لا توجد صورة فاتورة مرفقة");
      window.open(receipt.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر فتح الفاتورة");
    }
  };

  return (
    <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
      <div className="section-head">
        <div>
          <h3>فواتير طلب الصيانة</h3>
          <span>
            {canViewPayables
              ? `${linked.length.toLocaleString("en-US")} فاتورة مرتبطة`
              : "يلزم إذن المستحقات علينا لعرض سجل الفواتير"}
          </span>
        </div>
        {canViewPayables && (
          <button className="btn outline" onClick={onOpenPayables}>
            فتح سجل الفواتير
          </button>
        )}
      </div>
      {!canViewPayables ? (
        <div className="field-note">
          امنح المستخدم صلاحية «المستحقات علينا» لعرض حالات الفواتير والمدفوعات.
        </div>
      ) : linked.length ? (
        <div className="compact-list">
          {linked.map((invoice) => (
            <div className="compact-row" key={invoice.id}>
              <div className="compact-main">
                <strong>
                  {invoice.ref} · {invoice.supplier}
                </strong>
                <small>
                  {invoice.issueDate} · {invoice.description}
                </small>
              </div>
              <Badge>{invoice.status}</Badge>
              <div className="compact-main" style={{ textAlign: "left" }}>
                <strong>{formatSAR(invoice.amount)}</strong>
                <small>
                  مدفوع {formatSAR(invoice.paid)} · متبقٍ {formatSAR(invoice.remaining)}
                </small>
              </div>
              {invoice.hasReceipt && (
                <button className="text-link" onClick={() => void openReceipt(invoice)}>
                  معاينة الفاتورة
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: "1rem" }}>
          لا توجد فواتير مورد مرتبطة بهذا الطلب حتى الآن.
        </div>
      )}
    </section>
  );
}

export function MaintenanceCostSummary({
  request,
  invoices,
}: {
  request: Maintenance;
  invoices: PayableRow[];
}) {
  const linked = invoices.filter((invoice) => invoice.maintenanceRequestId === request.id);
  const summary = summarizeMaintenanceCost({
    workshopQuote: request.estimatedCost,
    partsQuote: request.quotedPartsCost,
    recordedActual: request.cost,
    invoices: linked,
  });
  const varianceLabel =
    summary.variance === null
      ? "لا يوجد تقدير للمقارنة"
      : summary.variance > 0
      ? `زيادة ${formatSAR(summary.variance)} عن التقدير`
      : summary.variance < 0
      ? `أقل من التقدير بـ ${formatSAR(Math.abs(summary.variance))}`
      : "مطابق للتقدير";

  return (
    <section className="surface maintenance-cost-summary">
      <div className="section-head">
        <div>
          <h3>مطابقة التكلفة</h3>
          <span>الفاتورة المعتمدة تُحتسب تكلفة فعلية؛ الفاتورة الجديدة تبقى معلّقة حتى اعتماد المالية.</span>
        </div>
      </div>
      <div className="quick-metrics">
        <div>
          <span>التقدير (الورشة + القطع)</span>
          <strong>{formatSAR(summary.estimate)}</strong>
        </div>
        <div>
          <span>فعلي معتمد من الفواتير</span>
          <strong>{formatSAR(summary.approvedActual)}</strong>
        </div>
        <div>
          <span>فواتير بانتظار الاعتماد</span>
          <strong>{formatSAR(summary.pendingTotal)}</strong>
        </div>
        <div>
          <span>الفرق عن التقدير</span>
          <strong>{varianceLabel}</strong>
        </div>
      </div>
      {summary.hasRecordedActualMismatch && (
        <div className="maintenance-cost-warning" role="alert">
          قيمة التكلفة الفعلية المسجلة في الطلب ({formatSAR(summary.recordedActual)}) لا تطابق مجموع الفواتير المعتمدة (
          {formatSAR(summary.approvedActual)}). راجع سجل الفواتير قبل إغلاق الطلب.
        </div>
      )}
    </section>
  );
}

export function MaintenanceDetailModal({
  request,
  linkedInvoices,
  canViewFinance,
  canViewPayables,
  canViewDocuments,
  onOpenPayables,
  onClose,
  onEdit,
}: {
  request: Maintenance;
  linkedInvoices: PayableRow[];
  canViewFinance: boolean;
  canViewPayables: boolean;
  canViewDocuments: boolean;
  onOpenPayables: () => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const history = trpc.maintenance.history.useQuery({ id: request.id });
  const entries: Array<[string, unknown]> = [
    ["الطلب", request.ref],
    ["المركبة", request.vehicle],
    ["نوع الصيانة", request.type],
    ["الأولوية", request.priority || "متوسط"],
    ["المرحلة", request.workflowStage || "بلاغ"],
    ["مقدم البلاغ", request.reportedBy],
    ["الفني", request.technician],
    ["الورشة", request.workshop],
    ["وصف المشكلة", request.reason],
    ["التشخيص", request.diagnosis],
    ["العمل المنفذ", request.workDone],
    ["العودة المتوقعة", request.expectedReturn || request.due],
    ["الضمان حتى", request.warrantyUntil],
  ];

  if (canViewFinance) {
    entries.push(
      ["قيمة عرض الورشة", request.estimatedCost],
      ["قيمة قطع الغيار حسب العرض", request.quotedPartsCost],
      ["التكلفة الفعلية", request.cost],
      ["قرار الاعتماد", request.approvalStatus],
      ["طريقة الصرف", request.fundingType],
      ["رقم عملية الصرف", request.fundingReference],
      ["المبلغ المصروف", request.fundingAmount],
      ["الجهة المستلمة", request.fundingRecipient],
      ["حالة العهدة", request.advanceStatus],
      ["مرجع تسوية العهدة", request.advanceSettlementReference],
      ["المعتمد", request.approvedByName],
      ["تاريخ الاعتماد", request.approvedAt],
      ["ملاحظات الاعتماد", request.approvalNotes]
    );
  }

  return (
    <Modal title={`تفاصيل طلب الصيانة · ${request.ref}`} onClose={onClose} wide>
      <div className="detail-grid">
        {entries.map(([label, value]) => (
          <div className="detail-cell" key={label}>
            <span>{label}</span>
            <strong>{value instanceof Date ? value.toLocaleString("en-US") : String(value ?? "—")}</strong>
          </div>
        ))}
      </div>
      {request.quoteUrl && (
        <div className="detail-footer">
          <button
            className="btn outline"
            onClick={() => window.open(String(request.quoteUrl), "_blank", "noopener,noreferrer")}
          >
            <BookOpen size={15} />
            معاينة عرض السعر · {request.quoteName || "الملف"}
          </button>
        </div>
      )}
      {canViewFinance && canViewPayables && (
        <MaintenanceCostSummary request={request} invoices={linkedInvoices} />
      )}
      <LinkedDocumentsSection
        entityType="صيانة"
        entityId={request.id}
        canViewDocuments={canViewDocuments}
      />
      <MaintenanceInvoicesSection
        requestId={request.id}
        invoices={linkedInvoices}
        canViewPayables={canViewPayables}
        onOpenPayables={onOpenPayables}
      />
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h3>سجل الإجراءات</h3>
            <span>المراحل والتعديلات وقرارات الاعتماد</span>
          </div>
        </div>
        {history.isLoading ? (
          <div className="empty-state">جارٍ تحميل السجل...</div>
        ) : history.data?.length ? (
          <div className="compact-list">
            {history.data.map((event) => (
              <div className="compact-row" key={event.id}>
                <div className="compact-main">
                  <strong>
                    {event.eventType}
                    {event.toStage ? ` · ${event.toStage}` : ""}
                  </strong>
                  <small>
                    {event.actorName} · {new Date(event.createdAt).toLocaleString("en-US")}
                  </small>
                  {event.details && <small>{event.details}</small>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "1rem" }}>
            لا توجد أحداث مسجلة لهذا الطلب.
          </div>
        )}
      </section>
      <div className="detail-footer">
        <button className="btn ghost" onClick={onClose}>
          إغلاق
        </button>
        <button className="btn primary" onClick={onEdit}>
          <Pencil size={15} />
          تعديل الطلب
        </button>
      </div>
    </Modal>
  );
}

export function DriverVehiclesModal({
  driver,
  vehicles,
  documents,
  canViewDocuments,
  onClose,
}: {
  driver: Driver;
  vehicles: Vehicle[];
  documents: Document[];
  canViewDocuments: boolean;
  onClose: () => void;
}) {
  const documentsQuery = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canViewDocuments });
  const linkedVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.driverId === driver.id ||
      vehicle.driver === driver.name ||
      (driver.vehicle !== "—" && vehicle.plate === driver.vehicle)
  );
  const linkedDocuments = canViewDocuments
    ? ((documentsQuery.data as Document[] | undefined) ?? documents).filter((doc) =>
        isLinkedDocument(doc, "سائق", driver.id)
      )
    : [];

  return (
    <Modal title={`ملف السائق · ${driver.name}`} onClose={onClose} wide>
      <div className="driver-summary">
        <span className="avatar">{driver.name.slice(0, 1)}</span>
        <div>
          <strong>{driver.name}</strong>
          <span>
            {driver.phone} · {driver.license}
          </span>
          <Badge>{driver.status}</Badge>
        </div>
      </div>
      <div className="linked-vehicles-head">
        <div>
          <h3>المركبات المرتبطة</h3>
          <span>
            {linkedVehicles.length
              ? `لديه ${linkedVehicles.length} مركبة مرتبطة حاليًا`
              : "لا توجد مركبات مرتبطة بهذا السائق"}
          </span>
        </div>
        <CarFront size={20} />
      </div>
      {linkedVehicles.length ? (
        <div className="linked-vehicles-list">
          {linkedVehicles.map((vehicle) => (
            <div className="linked-vehicle" key={vehicle.id}>
              <span className="vehicle-avatar">
                <CarFront size={17} />
              </span>
              <div>
                <strong>{vehicle.plate}</strong>
                <span>
                  {vehicle.brand} · {vehicle.model}
                </span>
              </div>
              <div className="linked-vehicle-meta">
                <Badge>{vehicle.status}</Badge>
                <small>{vehicle.client !== "—" ? vehicle.client : "بدون عميل"}</small>
                <small>{vehicle.contract !== "—" ? vehicle.contract : "بدون عقد"}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <CarFront size={24} />
          <strong>لا توجد مركبة مرتبطة</strong>
          <span>يمكن إسناد مركبة من قائمة إجراءات السائق.</span>
        </div>
      )}
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h3>المستندات المرتبطة</h3>
            <span>{linkedDocuments.length} مستند</span>
          </div>
        </div>
        {linkedDocuments.length ? (
          <div className="compact-list">
            {linkedDocuments.map((doc) => (
              <div className="compact-row" key={doc.id}>
                <div className="compact-main">
                  <strong>{doc.name}</strong>
                  <small>
                    {doc.type} · ينتهي {doc.expiry}
                  </small>
                </div>
                <Badge>{doc.status}</Badge>
                <DocumentFileActions file={doc} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "1.5rem" }}>
            لا توجد مستندات مرتبطة بهذا السائق.
          </div>
        )}
      </section>
      <div className="detail-footer">
        <button className="btn primary" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}

export function MaintenancePage({
  maintenance,
  onOpenForm,
  onAction,
  canApprove,
  canRecordInvoice,
  onRegisterInvoice,
}: {
  maintenance: Maintenance[];
  onOpenForm: (row?: Row) => void;
  onAction: (action: string, row: Row) => void;
  canApprove: boolean;
  canRecordInvoice: boolean;
  onRegisterInvoice: (request: Maintenance) => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [menu, setMenu] = useState<number | null>(null);
  const today = formatCompanyDate();
  const monthlyCostQuery = trpc.maintenance.costForPeriod.useQuery(
    { from: `${today.slice(0, 7)}-01`, to: today },
    { enabled: canApprove, staleTime: 15000 }
  );

  const filtered = maintenance.filter(
    (m) =>
      matchesQuickSearch(m, search) &&
      (tab === "الكل" ||
        (tab === "مكتمل" && m.status === "مكتمل") ||
        (tab === "جاري العمل" && m.status !== "مكتمل"))
  );

  const isOpen = (item: Maintenance) =>
    !["مغلق", "مرفوض"].includes(String(item.workflowStage || ""));

  const overdue = maintenance.filter((item) => {
    const value = String(
      item.expectedReturn && item.expectedReturn !== "—" ? item.expectedReturn : item.due || ""
    ).slice(0, 10);
    return isOpen(item) && /^\d{4}-\d{2}-\d{2}$/.test(value) && value < formatCompanyDate();
  });

  const actualCost = (item: Maintenance) =>
    Number(String(item.cost || "").replace(/[^0-9]/g, "")) || 0;

  const topVehicleCosts = Array.from(
    maintenance
      .reduce(
        (totals, item) => totals.set(item.vehicle, (totals.get(item.vehicle) || 0) + actualCost(item)),
        new Map<string, number>()
      )
      .entries()
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / الورش"
        title="حوكمة الصيانة"
        description="تابع البلاغات والأولويات والاعتمادات والتنفيذ وسجل المركبات."
        action="طلب صيانة جديد"
        onAction={() => onOpenForm()}
      />

      <div className="stats-banner">
        <div>
          <Wrench size={18} />
          <div className="stats-banner-info">
            <span>طلبات مفتوحة</span>
            <strong>{maintenance.filter(isOpen).length.toLocaleString("en-US")}</strong>
          </div>
        </div>
        <div>
          <Clock3 size={18} />
          <div className="stats-banner-info">
            <span>متأخرة</span>
            <strong className="red-text">{overdue.length.toLocaleString("en-US")}</strong>
          </div>
        </div>
        <div>
          <AlertCircle size={18} />
          <div className="stats-banner-info">
            <span>طارئة / عاجلة</span>
            <strong className="red-text">
              {
                maintenance.filter(
                  (item) => isOpen(item) && ["طارئ", "عاجل"].includes(String(item.priority))
                ).length
              }
            </strong>
          </div>
        </div>
        <div>
          <CheckCircle2 size={18} />
          <div className="stats-banner-info">
            <span>بانتظار الاعتماد</span>
            <strong>
              {maintenance.filter((item) => item.approvalStatus === "بانتظار الاعتماد").length.toLocaleString("en-US")}
            </strong>
          </div>
        </div>
        {canApprove && (
          <>
            <div>
              <CircleDollarSign size={18} />
              <div className="stats-banner-info">
                <span>مصروف الصيانة المعتمد هذا الشهر</span>
                <strong>
                  {monthlyCostQuery.isFetching
                    ? "جارٍ التحميل"
                    : monthlyCostQuery.isError
                    ? "تعذر التحميل"
                    : formatSAR(monthlyCostQuery.data ?? 0)}
                </strong>
                <small>حسب تاريخ قيد المصروف؛ الفواتير غير المعتمدة مستبعدة.</small>
              </div>
            </div>
            <div>
              <CalendarDays size={18} />
              <div className="stats-banner-info">
                <span>إجمالي الطلبات</span>
                <strong>{maintenance.length.toLocaleString("en-US")}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {canApprove && topVehicleCosts.length > 0 && (
        <div className="quick-metrics">
          {topVehicleCosts.map(([vehicle, amount]) => (
            <div key={vehicle}>
              <span>تكلفة مركبة · {vehicle}</span>
              <strong>{formatSAR(amount)}</strong>
            </div>
          ))}
        </div>
      )}

      <TableShell
        columns={[
          "الطلب",
          "المركبة",
          "الأولوية",
          "مرحلة العمل",
          "نوع الصيانة",
          "سبب البلاغ",
          "مسؤول الصيانة",
          "العودة المتوقعة",
          "الحالة",
          "التقديرية / الفعلية",
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            [
              "ref",
              "vehicle",
              "priority",
              "workflowStage",
              "type",
              "reason",
              "manager",
              "expectedReturn",
              "status",
              "estimatedCost",
              "quotedPartsCost",
              "cost",
            ],
            "maintenance"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "مكتمل", "جاري العمل"]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="طلب صيانة جديد"
        onAdd={() => onOpenForm()}
      >
        {filtered.map((m) => {
          const stage = (m.workflowStage || "بلاغ") as MaintenanceStage;
          const canProgress = nextMaintenanceStages(stage).length > 0;
          const canReview = canApprove && stage === "اعتماد" && m.approvalStatus === "بانتظار الاعتماد";
          const canInvoice =
            canRecordInvoice &&
            Boolean(m.vehicleId) &&
            m.approvalStatus === "معتمد" &&
            ["تنفيذ", "فحص بعد الإصلاح"].includes(stage);
          const quoteTotal = Number(m.estimatedCost || 0) + Number(m.quotedPartsCost || 0);
          const currentCost = actualCost(m);
          const shownCost = currentCost > 0 ? currentCost : quoteTotal;
          const hasCost =
            ["تقدير تكلفة", "اعتماد", "مرفوض", "تنفيذ", "فحص بعد الإصلاح", "مغلق"].includes(stage) &&
            shownCost > 0;

          return (
            <tr key={m.id}>
              <td>
                <strong className="table-primary">{m.ref}</strong>
                <small>
                  {m.reportedBy || "—"} · {m.start}
                </small>
              </td>
              <td>{m.vehicle}</td>
              <td>
                <Badge>{m.priority || "متوسط"}</Badge>
              </td>
              <td>
                <Badge>{stage}</Badge>
                {m.approvalStatus === "بانتظار الاعتماد" && <small>بانتظار اعتماد المالية</small>}
              </td>
              <td>{m.type}</td>
              <td>{m.reason || "—"}</td>
              <td>{m.technician && m.technician !== "—" ? m.technician : m.manager}</td>
              <td>{m.expectedReturn || m.due}</td>
              <td>
                <Badge>{m.status}</Badge>
              </td>
              <td>
                {hasCost ? (
                  <>
                    {formatSAR(shownCost)}
                    <small>{currentCost > 0 ? "فعلي حسب الفواتير" : "تقديري حسب العرض"}</small>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="actions-cell">
                {canReview ? (
                  <button className="btn outline" onClick={() => onAction("approval", m)}>
                    مراجعة الاعتماد
                  </button>
                ) : canProgress ? (
                  <button className="btn outline" onClick={() => onAction("stage", m)}>
                    {nextMaintenanceStages(stage).includes("اعتماد") ? "إرسال للمالية" : "إجراء المرحلة"}
                  </button>
                ) : null}
                {canInvoice && (
                  <button className="btn primary" onClick={() => onRegisterInvoice(m)}>
                    تسجيل فاتورة
                  </button>
                )}
                <button
                  className="row-menu-btn"
                  title="المزيد من الإجراءات"
                  onClick={() => setMenu(menu === m.id ? null : m.id)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {menu === m.id && (
                  <ContextMenu
                    row={m}
                    module="maintenance"
                    canApprove={canApprove}
                    onClose={() => setMenu(null)}
                    onAction={(action) => {
                      setMenu(null);
                      onAction(action, m);
                    }}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </TableShell>
    </>
  );
}

export default MaintenancePage;
