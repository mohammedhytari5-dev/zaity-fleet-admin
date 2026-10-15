import React, { useState } from "react";
import { formatCompanyDate, isCompanyDateBeforeToday, isWithinUpcomingDays } from "@shared/date-utils";
import { matchesQuickSearch } from "@/lib/quick-search";
import {
  orderWorkTasks,
  taskUrgency,
  filterWorkTasks,
  type WorkTask,
  type WorkTaskQueueFilter,
} from "@/lib/task-queue";
import { summarizeDriverLicenseAlerts } from "@/lib/driver-alerts";
import { notificationTarget } from "@/lib/notification-target";
import {
  totalOutstandingClaims,
  isReceivableClaimStatus,
  outstandingClaimAmount,
} from "@shared/receivables";
import type { TaskRelatedEntityType } from "@shared/task-relations";
import { toast } from "sonner";
import {
  CarFront,
  Activity,
  CheckCircle2,
  Wrench,
  AlertCircle,
  Gauge,
  Bell,
  ChevronLeft,
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Briefcase,
} from "lucide-react";
import type {
  ModuleKey,
  Row,
  Vehicle,
  Driver,
  Maintenance,
  Document,
  Contract,
  Claim,
  PayableRow,
  ProjectRow,
} from "./types";
import {
  PageHeader,
  Badge,
  Modal,
  Field,
  FormActions,
  formatSAR,
  Chart,
} from "./common";
import { FleetDonutKpiSection } from "./components/FleetDonutKpiSection";

export type TaskRelatedOption = {
  entityType: TaskRelatedEntityType;
  id: number;
  label: string;
};

export const taskRelatedLabels: Record<TaskRelatedEntityType, string> = {
  vehicle: "مركبة",
  maintenance: "طلب صيانة",
  project: "مشروع",
  document: "مستند",
  driver: "سائق",
  employee: "موظف",
  client: "عميل",
  contract: "عقد",
  claim: "مطالبة مالية",
  payable: "فاتورة مورد",
};

export function DashboardHome({
  onNavigate,
  onNavigateFinanceView,
  userName,
  tasks,
  taskAssignees,
  relatedRecords,
  viewerUserId,
  notifications,
  vehicles,
  drivers,
  maintenance,
  documents,
  contracts,
  claims,
  payables,
  projects,
  clients = [],
  canAccess,
  onTaskToggle,
  onTaskCreate,
  canManageTasks,
  onNotificationOpen,
  onOpenNotifications,
  onMaintenanceOpen,
  onTaskOpenRelated,
}: {
  onNavigate: (key: ModuleKey) => void;
  onNavigateFinanceView: (view: "contracts" | "claims") => void;
  userName?: string | null;
  tasks: WorkTask[];
  taskAssignees: Array<{ id: number; name: string | null }>;
  relatedRecords: TaskRelatedOption[];
  viewerUserId: number;
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    severity: string;
    readAt?: Date | string | null;
    entityType?: string | null;
    entityId?: number | null;
  }>;
  vehicles: Vehicle[];
  drivers: Driver[];
  maintenance: Maintenance[];
  documents: Document[];
  contracts: Contract[];
  claims: Claim[];
  payables: PayableRow[];
  projects: ProjectRow[];
  clients?: any[];
  canAccess: (key: ModuleKey) => boolean;
  onTaskToggle: (task: { id: number; status: string }) => void;
  onTaskCreate: (task: {
    title: string;
    description: string;
    dueAt: string;
    assigneeUserId: number;
    relatedEntityType: TaskRelatedEntityType | null;
    relatedEntityId: number | null;
  }) => void;
  canManageTasks: boolean;
  onNotificationOpen: (notification: {
    id: number;
    entityType?: string | null;
    entityId?: number | null;
  }) => void;
  onOpenNotifications: () => void;
  onMaintenanceOpen: (request: Maintenance) => void;
  onTaskOpenRelated: (task: WorkTask) => void;
}) {
  const [maintenanceRange, setMaintenanceRange] = useState<
    "month" | "quarter" | "year"
  >("month");
  const [taskFilter, setTaskFilter] = useState<WorkTaskQueueFilter>("الكل");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskRelatedSearch, setTaskRelatedSearch] = useState("");
  const [taskLimit, setTaskLimit] = useState(8);
  const [taskDetail, setTaskDetail] = useState<WorkTask | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    dueAt: formatCompanyDate(),
    assigneeUserId: "",
    relatedEntityType: "" as TaskRelatedEntityType | "",
    relatedEntityId: "",
  });

  const availableTaskRelatedTypes = Array.from(
    new Set(relatedRecords.map((record) => record.entityType))
  );
  const selectedTaskRelatedRecords = taskDraft.relatedEntityType
    ? relatedRecords.filter(
        (record) =>
          record.entityType === taskDraft.relatedEntityType &&
          matchesQuickSearch(record.label, taskRelatedSearch)
      )
    : [];
  const selectedTaskRelatedType = taskDraft.relatedEntityType;
  const taskRelatedRecordCount = taskDraft.relatedEntityType
    ? relatedRecords.filter(
        (record) => record.entityType === taskDraft.relatedEntityType
      ).length
    : 0;
  const taskDetailRelatedRecord =
    taskDetail?.relatedEntityType && taskDetail.relatedEntityId
      ? relatedRecords.find(
          (record) =>
            record.entityType === taskDetail.relatedEntityType &&
            record.id === taskDetail.relatedEntityId
        )
      : undefined;

  const activeTasks = orderWorkTasks(
    tasks.filter((task) => task.status !== "ملغاة")
  );
  const openTasks = activeTasks.filter((task) => task.status !== "مكتملة");
  const overdueTasks = openTasks.filter((task) => taskUrgency(task) === "متأخرة");
  const todayTasks = openTasks.filter((task) => taskUrgency(task) === "اليوم");
  const upcomingTasks = openTasks.filter((task) => taskUrgency(task) === "قادمة");
  const filteredTasks = filterWorkTasks(activeTasks, taskFilter).filter((task) =>
    matchesQuickSearch(task, taskSearch)
  );
  const shownTasks = filteredTasks.slice(0, taskLimit);

  const totalVehicles = vehicles.length;
  const workingVehicles = vehicles.filter((v) =>
    ["مؤجرة", "مشغولة"].includes(v.status)
  ).length;
  const readyVehicles = vehicles.filter((v) => v.status === "متاحة").length;
  const maintenanceVehicles = vehicles.filter(
    (v) => v.status === "في الصيانة"
  ).length;
  const stoppedVehicles = vehicles.filter((v) => v.status === "متوقفة").length;
  const setupVehicles = vehicles.filter((v) => v.status === "قيد التجهيز").length;
  const operationRate = totalVehicles
    ? ((workingVehicles / totalVehicles) * 100).toFixed(1).replace(".", "٫")
    : "٠";
  const operationRatePct = totalVehicles
    ? Math.min(100, Math.round((workingVehicles / totalVehicles) * 100))
    : 0;

  const receivable = totalOutstandingClaims(claims);
  const payable = payables
    .filter((item) => ["معتمدة", "مدفوعة جزئيًا", "مدفوعة"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  const pendingPayableAmount = payables
    .filter((item) => item.status === "جديدة")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const openNotification = (item: (typeof notifications)[number]) =>
    onNotificationOpen(item);
  const driverLicenseAlert = summarizeDriverLicenseAlerts(drivers);

  const automaticAlerts: Array<{
    id: number;
    title: string;
    message: string;
    severity: string;
    target: ModuleKey;
    record?: Row;
    dueAt?: string;
  }> = [
    ...(driverLicenseAlert ? [driverLicenseAlert] : []),
    ...claims
      .filter(
        (item) =>
          isCompanyDateBeforeToday(item.due) &&
          isReceivableClaimStatus(item.status) &&
          outstandingClaimAmount(item) > 0
      )
      .map((item) => ({
        id: 1000000 + item.id,
        title: `مطالبة متأخرة ${item.ref}`,
        message: `${item.client} · متبقٍ ${formatSAR(
          outstandingClaimAmount(item)
        )}`,
        severity: "حرج",
        target: "finance" as ModuleKey,
        record: item,
        dueAt: item.due,
      })),
    ...claims
      .filter(
        (item) =>
          isCompanyDateBeforeToday(item.followUpAt) &&
          isReceivableClaimStatus(item.status) &&
          outstandingClaimAmount(item) > 0
      )
      .map((item) => ({
        id: 1500000 + item.id,
        title: `متابعة مطلوبة للمطالبة ${item.ref}`,
        message: `${item.client} · موعد المتابعة ${item.followUpAt}`,
        severity: "تنبيه",
        target: "finance" as ModuleKey,
        record: item,
        dueAt: item.followUpAt,
      })),
    ...payables
      .filter((item) => item.overdue)
      .map((item) => ({
        id: 1600000 + item.id,
        title: `فاتورة مورد متأخرة ${item.ref}`,
        message: `${item.supplier} · متبقٍ ${formatSAR(item.remaining)}`,
        severity: "حرج",
        target: "payables" as ModuleKey,
        record: item,
        dueAt: item.dueDate,
      })),
    ...contracts
      .filter((item) => item.status === "قائم" && isWithinUpcomingDays(item.expiry, 30))
      .map((item) => ({
        id: 2000000 + item.id,
        title: `عقد يقترب من الانتهاء ${item.ref}`,
        message: `${item.client} · ينتهي ${item.expiry}`,
        severity: "تنبيه",
        target: "finance" as ModuleKey,
        record: item,
        dueAt: item.expiry,
      })),
    ...documents
      .filter((item) => ["قريبًا", "متأخر", "منتهي"].includes(item.status))
      .map((item) => ({
        id: 3000000 + item.id,
        title: `مستند يحتاج مراجعة: ${item.name}`,
        message: `${item.entity} · ${item.expiry} · ${item.status}`,
        severity:
          item.status === "منتهي" || item.status === "متأخر" ? "حرج" : "تنبيه",
        target: "documents" as ModuleKey,
        record: item,
        dueAt: item.expiry,
      })),
    ...maintenance
      .filter(
        (item) =>
          item.status === "متوقف" ||
          (item.status !== "مكتمل" &&
            isCompanyDateBeforeToday(item.expectedReturn)) ||
          (item.status !== "مكتمل" &&
            item.createdAt &&
            Date.now() - new Date(item.createdAt).getTime() >
              7 * 24 * 60 * 60 * 1000)
      )
      .map((item) => ({
        id: 4000000 + item.id,
        title: `مركبة متوقفة: ${item.vehicle}`,
        message: `${item.reason || item.type} · ${item.status}`,
        severity: "حرج",
        target: "maintenance" as ModuleKey,
        record: item,
        dueAt: item.expectedReturn || item.due,
      })),
  ];

  const manualAlerts = notifications
    .filter((item) => !item.readAt)
    .map((item) => ({
      ...item,
      target: notificationTarget(item.entityType) as ModuleKey,
      onOpen: () => openNotification(item),
    }))
    .filter((item) => canAccess(item.target));

  const alertPriority = (severity: string) =>
    severity === "حرج" ? 0 : severity === "تنبيه" ? 1 : 2;

  const visibleAlerts = [
    ...automaticAlerts
      .filter((item) => canAccess(item.target))
      .map((item) => ({
        ...item,
        onOpen: () =>
          item.record
            ? onNotificationOpen({
                id: item.id,
                entityType: item.target,
                entityId: item.record.id,
              })
            : onNavigate(item.target),
      })),
    ...manualAlerts,
  ]
    .sort(
      (a, b) =>
        alertPriority(a.severity) - alertPriority(b.severity) ||
        String(("dueAt" in a && a.dueAt) || "9999-12-31").localeCompare(
          String(("dueAt" in b && b.dueAt) || "9999-12-31")
        ) ||
        a.title.localeCompare(b.title, "ar")
    )
    .slice(0, 5);

  const maintenanceRows = maintenance
    .filter((item) => item.status !== "مكتمل")
    .sort((a, b) => {
      const aDate = String(a.expectedReturn || a.due || "9999-12-31").slice(0, 10);
      const bDate = String(b.expectedReturn || b.due || "9999-12-31").slice(0, 10);
      const aOverdue = aDate < formatCompanyDate();
      const bOverdue = bDate < formatCompanyDate();
      return Number(bOverdue) - Number(aOverdue) || aDate.localeCompare(bDate);
    })
    .slice(0, 3);

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Aden",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );
  const greeting =
    hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء الخير";

  return (
    <>
      <PageHeader
        eyebrow="مركز متابعة الشركة"
        title={`${greeting}، ${userName || "بك"}`}
        description={`لوحة تشغيل موحدة · ${formatCompanyDate()} · افتح أي مؤشر للانتقال إلى سجلاته.`}
        action="إضافة مركبة"
        onAction={() => onNavigate("vehicles")}
      />

      <FleetDonutKpiSection
        vehicles={vehicles}
        drivers={drivers}
        clients={clients}
        claims={claims}
        contracts={contracts}
        maintenance={maintenance}
        onNavigate={onNavigate}
      />

      {canAccess("vehicles") && (
        <div className="dash-fleet-grid">
          <button
            type="button"
            className="dash-kpi-card"
            onClick={() => onNavigate("vehicles")}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-title">إجمالي المركبات</span>
              <span className="dash-kpi-icon teal">
                <CarFront size={15} />
              </span>
            </div>
            <div className="dash-kpi-value">{totalVehicles.toLocaleString("en-US")}</div>
            <div className="dash-kpi-footer">
              <span>كامل الأسطول المسجل</span>
            </div>
          </button>

          <button
            type="button"
            className="dash-kpi-card"
            onClick={() => onNavigate("vehicles")}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-title">تعمل / مؤجرة</span>
              <span className="dash-kpi-icon emerald">
                <Activity size={15} />
              </span>
            </div>
            <div className="dash-kpi-value">{workingVehicles.toLocaleString("en-US")}</div>
            <div>
              <div className="dash-kpi-footer">
                <span>تشغيل {operationRate}٪</span>
                <span className="dash-kpi-badge emerald">{operationRatePct}٪</span>
              </div>
              <div className="dash-progress-track">
                <div
                  className="dash-progress-bar"
                  style={{ width: `${operationRatePct}%` }}
                />
              </div>
            </div>
          </button>

          <button
            type="button"
            className="dash-kpi-card"
            onClick={() => onNavigate("vehicles")}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-title">جاهزة للتشغيل</span>
              <span className="dash-kpi-icon indigo">
                <CheckCircle2 size={15} />
              </span>
            </div>
            <div className="dash-kpi-value">{readyVehicles.toLocaleString("en-US")}</div>
            <div className="dash-kpi-footer">
              <span>متاحة للطلب الفوري</span>
              <span className="dash-kpi-badge blue">جاهزة</span>
            </div>
          </button>

          <button
            type="button"
            className="dash-kpi-card"
            onClick={() => onNavigate("maintenance")}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-title">في الصيانة</span>
              <span className="dash-kpi-icon amber">
                <Wrench size={15} />
              </span>
            </div>
            <div className="dash-kpi-value">{maintenanceVehicles.toLocaleString("en-US")}</div>
            <div className="dash-kpi-footer">
              <span>طلبات صيانة نشطة</span>
              {maintenanceVehicles > 0 && (
                <span className="dash-kpi-badge amber">ورش</span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="dash-kpi-card"
            onClick={() => onNavigate("vehicles")}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-title">متوقفة</span>
              <span className="dash-kpi-icon rose">
                <AlertCircle size={15} />
              </span>
            </div>
            <div className="dash-kpi-value">{stoppedVehicles.toLocaleString("en-US")}</div>
            <div className="dash-kpi-footer">
              <span>تتطلب إجراءً ومراجعة</span>
              {stoppedVehicles > 0 && (
                <span className="dash-kpi-badge rose">تنبيه</span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="dash-kpi-card"
            onClick={() => onNavigate("vehicles")}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-title">قيد التجهيز</span>
              <span className="dash-kpi-icon cyan">
                <Gauge size={15} />
              </span>
            </div>
            <div className="dash-kpi-value">{setupVehicles.toLocaleString("en-US")}</div>
            <div className="dash-kpi-footer">
              <span>تجهيز وتأهيل للخدمة</span>
            </div>
          </button>
        </div>
      )}
      <div className="dash-exec-grid">
        {canAccess("finance") && (
          <button
            type="button"
            className="dash-exec-card"
            onClick={() => onNavigateFinanceView("claims")}
          >
            <div className="dash-exec-header">
              <span>المستحق لنا · مطالبات العملاء</span>
              <span className="dash-exec-icon emerald">
                <ArrowDownLeft size={15} />
              </span>
            </div>
            <div className="dash-exec-value green">{formatSAR(receivable)}</div>
            <div className="dash-exec-footer">
              <span>سجل المطالبات المفتوحة للتحصيل</span>
              <ChevronLeft size={14} />
            </div>
          </button>
        )}
        {canAccess("payables") && (
          <button
            type="button"
            className="dash-exec-card"
            onClick={() => onNavigate("payables")}
          >
            <div className="dash-exec-header">
              <span>المستحق علينا · فواتير الموردين</span>
              <span className="dash-exec-icon rose">
                <ArrowUpRight size={15} />
              </span>
            </div>
            <div className="dash-exec-value red">{formatSAR(payable)}</div>
            <div className="dash-exec-footer">
              <span>
                {pendingPayableAmount > 0
                  ? `${formatSAR(pendingPayableAmount)} بانتظار الاعتماد`
                  : "سجل المستحقات والفواتير"}
              </span>
              <ChevronLeft size={14} />
            </div>
          </button>
        )}
        {canAccess("finance") && (
          <button
            type="button"
            className="dash-exec-card"
            onClick={() => onNavigateFinanceView("contracts")}
          >
            <div className="dash-exec-header">
              <span>العقود التشغيلية القائمة</span>
              <span className="dash-exec-icon indigo">
                <FileText size={15} />
              </span>
            </div>
            <div className="dash-exec-value slate">
              {contracts
                .filter((contract) => contract.status === "قائم")
                .length.toLocaleString("en-US")}{" "}
              <small style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>عقد سارٍ</small>
            </div>
            <div className="dash-exec-footer">
              <span>سجل العقود واتفاقيات التأجير</span>
              <ChevronLeft size={14} />
            </div>
          </button>
        )}
        {canAccess("projects") && (
          <button
            type="button"
            className="dash-exec-card"
            onClick={() => onNavigate("projects")}
          >
            <div className="dash-exec-header">
              <span>المشاريع التشغيلية النشطة</span>
              <span className="dash-exec-icon teal">
                <Briefcase size={15} />
              </span>
            </div>
            <div className="dash-exec-value slate">
              {projects
                .filter((project) => project.status === "نشط")
                .length.toLocaleString("en-US")}{" "}
              <small style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>مشروع نشط</small>
            </div>
            <div className="dash-exec-footer">
              <span>متابعة إنجاز وحركة المشاريع</span>
              <ChevronLeft size={14} />
            </div>
          </button>
        )}
      </div>
      <div className="dashboard-grid">
        {canAccess("maintenance") && (
          <section className="surface chart-card dash-card">
            <div className="section-head">
              <div>
                <h2>مسار الصيانة</h2>
                <span>توزيع الطلبات حسب مراحل التشغيل والفترة</span>
              </div>
              <select
                className="select-like"
                aria-label="فترة مخطط الصيانة"
                value={maintenanceRange}
                onChange={(event) =>
                  setMaintenanceRange(
                    event.target.value as "month" | "quarter" | "year"
                  )
                }
              >
                <option value="month">هذا الشهر</option>
                <option value="quarter">هذا الربع</option>
                <option value="year">هذه السنة</option>
              </select>
            </div>
            <Chart maintenance={maintenance} range={maintenanceRange} />
          </section>
        )}
        <section className="surface alert-card dash-card">
          <div className="section-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <h2>تحتاج إلى انتباه</h2>
                <span>تنبيهات تتطلب إجراءً منك</span>
              </div>
              {visibleAlerts.length > 0 && (
                <span className="dash-alert-badge">{visibleAlerts.length}</span>
              )}
            </div>
            <button
              className="icon-btn"
              aria-label="عرض مركز التنبيهات"
              onClick={onOpenNotifications}
            >
              <Bell size={17} />
            </button>
          </div>
          <div className="alerts-list">
            {visibleAlerts.length ? (
              visibleAlerts.map((item) => (
                <div
                  className="dash-alert-row"
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => (item.onOpen ? item.onOpen() : onNavigate(item.target))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      item.onOpen ? item.onOpen() : onNavigate(item.target);
                    }
                  }}
                >
                  <span
                    className={`alert-icon ${
                      item.severity === "حرج"
                        ? "red"
                        : item.severity === "تنبيه"
                        ? "amber"
                        : "blue"
                    }`}
                  >
                    <Bell size={15} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.message}</small>
                  </div>
                  <ChevronLeft size={14} />
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>لا توجد تنبيهات جديدة</strong>
                <span>ستظهر هنا التنبيهات التشغيلية المهمة.</span>
              </div>
            )}
          </div>
          <button className="text-link" onClick={onOpenNotifications}>
            عرض كل التنبيهات <ChevronLeft size={14} />
          </button>
        </section>
      </div>
      <div className="dashboard-grid lower">
        {canAccess("maintenance") && (
          <section className="surface mini-table dash-card">
            <div className="section-head">
              <div>
                <h2>طلبات الصيانة المفتوحة</h2>
                <span>
                  افتح الطلب مباشرة لمراجعة المرحلة والتكلفة والفواتير
                </span>
              </div>
              <button className="text-link" onClick={() => onNavigate("maintenance")}>
                عرض الكل <ChevronLeft size={14} />
              </button>
            </div>
            <div className="compact-list">
              {maintenanceRows.length ? (
                maintenanceRows.map((item) => (
                  <button
                    className="compact-row compact-row-button"
                    key={item.id}
                    onClick={() => onMaintenanceOpen(item)}
                  >
                    <div className="vehicle-avatar">
                      <Wrench size={16} />
                    </div>
                    <div className="compact-main">
                      <strong>
                        {item.vehicle} · {item.ref}
                      </strong>
                      <small>
                        {item.type} · {item.workflowStage || item.status}
                      </small>
                    </div>
                    <Badge>{item.status}</Badge>
                    <span className="compact-date">
                      {item.expectedReturn || item.due || "—"}
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <strong>لا توجد مركبات تحت الصيانة</strong>
                  <span>حالة الأسطول التشغيلية مستقرة.</span>
                </div>
              )}
            </div>
          </section>
        )}
        <section className="surface mini-table dash-card">
          <div className="section-head">
            <div>
              <h2>{canManageTasks ? "مهام الفريق" : "مهامي"}</h2>
              <span>
                {openTasks.length.toLocaleString("en-US")} مفتوحة ·{" "}
                {overdueTasks.length.toLocaleString("en-US")} متأخرة ·{" "}
                {todayTasks.length.toLocaleString("en-US")} اليوم ·{" "}
                {upcomingTasks.length.toLocaleString("en-US")} قادمة
                {!canManageTasks ? " · المسندة إلى حسابك" : " · جميع المكلفين"}
              </span>
            </div>
            {canManageTasks && (
              <button
                className="btn outline"
                onClick={() => {
                  setTaskDraft({
                    title: "",
                    description: "",
                    dueAt: formatCompanyDate(),
                    assigneeUserId: taskAssignees[0]
                      ? String(taskAssignees[0].id)
                      : "",
                    relatedEntityType: "",
                    relatedEntityId: "",
                  });
                  setTaskFormOpen(true);
                }}
              >
                <Plus size={15} />
                إضافة مهمة
              </button>
            )}
          </div>
          <label className="report-search" style={{ margin: "0 0 .65rem", minHeight: 36 }}>
            <Search size={15} />
            <input
              value={taskSearch}
              onChange={(event) => {
                setTaskSearch(event.target.value);
                setTaskLimit(8);
              }}
              placeholder="ابحث في عنوان المهمة أو تفاصيلها…"
            />
          </label>
          <div className="task-filters" role="group" aria-label="تصفية مهام التشغيل">
            {(["الكل", "متأخرة", "اليوم", "قادمة", "مكتملة"] as const).map(
              (filter) => {
                const count =
                  filter === "الكل"
                    ? activeTasks.length
                    : filter === "متأخرة"
                    ? overdueTasks.length
                    : filter === "اليوم"
                    ? todayTasks.length
                    : filter === "قادمة"
                    ? upcomingTasks.length
                    : activeTasks.filter((task) => task.status === "مكتملة").length;
                return (
                  <button
                    key={filter}
                    className={taskFilter === filter ? "active" : ""}
                    aria-pressed={taskFilter === filter}
                    onClick={() => {
                      setTaskFilter(filter);
                      setTaskLimit(8);
                    }}
                  >
                    {filter}
                    <span>{count}</span>
                  </button>
                );
              }
            )}
          </div>
          <div className="tasks">
            {filteredTasks.length ? (
              shownTasks.map((task) => {
                const urgency = taskUrgency(task);
                const linkedTaskRecord =
                  task.relatedEntityType && task.relatedEntityId
                    ? relatedRecords.find(
                        (record) =>
                          record.entityType === task.relatedEntityType &&
                          record.id === task.relatedEntityId
                      )
                    : undefined;
                const canUpdateThisTask =
                  canManageTasks ||
                  task.assigneeUserId === viewerUserId ||
                  (!task.assigneeUserId && task.assignee === userName);
                return (
                  <div
                    className={`task ${task.status === "مكتملة" ? "done" : ""}`}
                    key={task.id}
                  >
                    <input
                      type="checkbox"
                      aria-label={
                        task.status === "مكتملة"
                          ? "إعادة فتح المهمة"
                          : "إكمال المهمة"
                      }
                      checked={task.status === "مكتملة"}
                      disabled={!canUpdateThisTask}
                      onChange={() => onTaskToggle(task)}
                    />
                    <button
                      type="button"
                      className="task-open"
                      onClick={() => setTaskDetail(task)}
                    >
                      <strong>{task.title}</strong>
                      <small>
                        {task.assignee && task.assignee !== "—"
                          ? `المسؤول: ${task.assignee} · `
                          : ""}
                        {task.dueAt || "بلا موعد"}
                        {task.relatedEntityType
                          ? ` · ${
                              linkedTaskRecord?.label ||
                              `${taskRelatedLabels[task.relatedEntityType]} #${
                                task.relatedEntityId
                              }`
                            }`
                          : ""}
                      </small>
                    </button>
                    {urgency === "متأخرة" ? (
                      <Badge>متأخرة</Badge>
                    ) : urgency === "اليوم" ? (
                      <Badge>اليوم</Badge>
                    ) : urgency === "قادمة" ? (
                      <Badge>قادمة</Badge>
                    ) : urgency === "مكتملة" ? (
                      <Badge>مكتملة</Badge>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <strong>لا توجد مهام تطابق البحث والفلتر</strong>
                <span>
                  {taskFilter === "الكل"
                    ? canManageTasks
                      ? "أضف مهمة وحدد المسؤول وموعد الإنجاز."
                      : "ستظهر هنا المهام المسندة إلى حسابك."
                    : `لا توجد مهام ${taskFilter.toLocaleLowerCase()} حاليًا.`}
                </span>
              </div>
            )}
          </div>
          {filteredTasks.length > shownTasks.length && (
            <div className="task-list-footer">
              معروض {shownTasks.length.toLocaleString("en-US")} من{" "}
              {filteredTasks.length.toLocaleString("en-US")} نتيجة ·{" "}
              <button
                type="button"
                className="text-link"
                onClick={() => setTaskLimit((limit) => limit + 8)}
              >
                عرض المزيد
              </button>
            </div>
          )}
          {taskFormOpen && (
            <Modal
              title="إضافة مهمة تشغيلية"
              onClose={() => setTaskFormOpen(false)}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (taskDraft.title.trim().length < 2) {
                    toast.error("اكتب عنوانًا واضحًا للمهمة");
                    return;
                  }
                  if (!taskDraft.assigneeUserId) {
                    toast.error("اختر حساب الموظف المسؤول عن المهمة");
                    return;
                  }
                  onTaskCreate({
                    ...taskDraft,
                    title: taskDraft.title.trim(),
                    description: taskDraft.description.trim(),
                    assigneeUserId: Number(taskDraft.assigneeUserId),
                    relatedEntityType: taskDraft.relatedEntityType || null,
                    relatedEntityId: taskDraft.relatedEntityId
                      ? Number(taskDraft.relatedEntityId)
                      : null,
                  });
                  setTaskFormOpen(false);
                }}
              >
                <div className="form-grid single">
                  <Field
                    label="عنوان المهمة *"
                    value={taskDraft.title}
                    onChange={(value) =>
                      setTaskDraft((current) => ({ ...current, title: value }))
                    }
                    placeholder="مثال: متابعة تجهيز المركبة"
                  />
                  <label className="field">
                    <span>الموظف المسؤول *</span>
                    <select
                      required
                      value={taskDraft.assigneeUserId}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          assigneeUserId: event.target.value,
                        }))
                      }
                    >
                      <option value="">اختر حسابًا نشطًا</option>
                      {taskAssignees
                        .filter((item) => item.name?.trim())
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    {taskAssignees.length === 0 && (
                      <small>
                        لا توجد حسابات نشطة يمكن إسناد المهمة إليها.
                      </small>
                    )}
                  </label>
                  <Field
                    label="موعد الإنجاز *"
                    value={taskDraft.dueAt}
                    onChange={(value) =>
                      setTaskDraft((current) => ({ ...current, dueAt: value }))
                    }
                    type="date"
                  />
                  <Field
                    label="تفاصيل المهمة"
                    value={taskDraft.description}
                    onChange={(value) =>
                      setTaskDraft((current) => ({
                        ...current,
                        description: value,
                      }))
                    }
                  />
                  <label className="field">
                    <span>ربط بسجل (اختياري)</span>
                    <select
                      value={taskDraft.relatedEntityType}
                      onChange={(event) => {
                        setTaskRelatedSearch("");
                        setTaskDraft((current) => ({
                          ...current,
                          relatedEntityType: event.target
                            .value as TaskRelatedEntityType | "",
                          relatedEntityId: "",
                        }));
                      }}
                    >
                      <option value="">بدون ربط</option>
                      {availableTaskRelatedTypes.map((type) => (
                        <option key={type} value={type}>
                          {taskRelatedLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedTaskRelatedType && (
                    <>
                      <label className="field">
                        <span>ابحث عن {taskRelatedLabels[selectedTaskRelatedType]}</span>
                        <input
                          value={taskRelatedSearch}
                          onChange={(event) => {
                            setTaskRelatedSearch(event.target.value);
                            setTaskDraft((current) => ({
                              ...current,
                              relatedEntityId: "",
                            }));
                          }}
                          placeholder="اكتب الاسم أو الرقم للعثور على السجل"
                        />
                      </label>
                      <label className="field">
                        <span>
                          السجل المرتبط ·{" "}
                          {selectedTaskRelatedRecords.length.toLocaleString(
                            "en-US"
                          )}{" "}
                          نتيجة
                        </span>
                        <select
                          required
                          value={taskDraft.relatedEntityId}
                          onChange={(event) =>
                            setTaskDraft((current) => ({
                              ...current,
                              relatedEntityId: event.target.value,
                            }))
                          }
                        >
                          <option value="">
                            اختر {taskRelatedLabels[selectedTaskRelatedType]}
                          </option>
                          {selectedTaskRelatedRecords.slice(0, 100).map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.label}
                            </option>
                          ))}
                        </select>
                        {taskRelatedRecordCount === 0 ? (
                          <small>لا توجد سجلات متاحة في هذه الوحدة للربط.</small>
                        ) : selectedTaskRelatedRecords.length === 0 ? (
                          <small>لا توجد نتائج مطابقة؛ جرّب كلمات بحث أخرى.</small>
                        ) : (
                          selectedTaskRelatedRecords.length > 100 && (
                            <small>
                              يعرض أول 100 نتيجة؛ أضف كلمات للبحث لتحديد السجل
                              بسرعة.
                            </small>
                          )
                        )}
                      </label>
                    </>
                  )}
                </div>
                <FormActions
                  onCancel={() => setTaskFormOpen(false)}
                  label="حفظ المهمة"
                />
              </form>
            </Modal>
          )}
        </section>
      </div>
      {taskDetail && (
        <Modal title="تفاصيل المهمة" onClose={() => setTaskDetail(null)}>
          <div className="driver-summary">
            <span className="avatar">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>{taskDetail.title}</strong>
              <span>
                المسؤول: {taskDetail.assignee || "غير محدد"} · موعد الإنجاز:{" "}
                {taskDetail.dueAt || "غير محدد"}
              </span>
              <Badge>{taskUrgency(taskDetail)}</Badge>
            </div>
          </div>
          <section
            className="surface"
            style={{ marginTop: "1rem", padding: "1rem" }}
          >
            <strong>تفاصيل العمل</strong>
            <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
              {taskDetail.description?.trim() ||
                "لا توجد تفاصيل إضافية لهذه المهمة."}
            </p>
            {taskDetail.relatedEntityType && (
              <div className="field-note" style={{ marginTop: ".7rem" }}>
                السجل المرتبط:{" "}
                {taskDetailRelatedRecord?.label ||
                  `${taskRelatedLabels[taskDetail.relatedEntityType]} #${
                    taskDetail.relatedEntityId
                  }`}
              </div>
            )}
          </section>
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn outline"
              onClick={() => setTaskDetail(null)}
            >
              إغلاق
            </button>
            {taskDetailRelatedRecord && (
              <button
                type="button"
                className="btn outline"
                onClick={() => {
                  setTaskDetail(null);
                  onTaskOpenRelated(taskDetail);
                }}
              >
                فتح السجل المرتبط
              </button>
            )}
            {taskDetail.status !== "ملغاة" &&
              (canManageTasks ||
                taskDetail.assigneeUserId === viewerUserId ||
                (!taskDetail.assigneeUserId &&
                  taskDetail.assignee === userName)) && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    onTaskToggle(taskDetail);
                    setTaskDetail(null);
                  }}
                >
                  {taskDetail.status === "مكتملة"
                    ? "إعادة فتح المهمة"
                    : "إكمال المهمة"}
                </button>
              )}
          </div>
        </Modal>
      )}
    </>
  );
}

export default DashboardHome;
