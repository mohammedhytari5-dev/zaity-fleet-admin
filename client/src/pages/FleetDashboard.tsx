import { Children, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { serializeCsv } from "@/lib/csv";
import { appendReportSummary } from "@/lib/report-export";
import { summarizeDriverLicenseAlerts } from "@/lib/driver-alerts";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import { filterQuickSearch, matchesQuickSearch, normalizeQuickSearch, searchableRecordText } from "@/lib/quick-search";
import { isLinkedDocument } from "@/lib/documentRelations";
import { notificationRecord, notificationTarget } from "@/lib/notification-target";
import { filterWorkTasks, orderWorkTasks, taskUrgency, type TaskRelatedOption, type WorkTask, type WorkTaskQueueFilter } from "@/lib/task-queue";
import type { TaskRelatedEntityType } from "@shared/task-relations";
import { useAuth } from "@/_core/hooks/useAuth";
import { nextMaintenanceStages, type MaintenanceStage } from "@shared/maintenance-domain";
import { countOutstandingClaims, isReceivableClaimStatus, outstandingClaimAmount, totalOutstandingClaims } from "@shared/receivables";
import { formatCompanyDate, isCompanyDateBeforeToday, isExpiredOrWithinUpcomingDays, isWithinUpcomingDays, resolveRenewalStatus } from "@shared/date-utils";
import { compareReportMetric, previousReportPeriod } from "@shared/report-comparison";
import { summarizeMaintenanceCost } from "@shared/maintenance-cost-summary";
import { isOptionalFixedLengthIdentity, normalizeIdentityNumber, normalizeNumericInput } from "@shared/identity-number";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowDownLeft,
  ArrowUpLeft,
  Bell,
  BookOpen,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  ListFilter,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Pencil,
  Package,
  Plus,
  Search,
  Settings2, Trash,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";

type ModuleKey = "dashboard" | "vehicles" | "projects" | "maintenance" | "accidents" | "documents" | "drivers" | "employees" | "clients" | "finance" | "payables" | "inventory" | "reports" | "settings";
type Row = Record<string, any> & { id: number };

type Vehicle = Row & { plate: string; brand: string; model: string; year: string; color: string; mileage: string; driver: string; status: string; client: string; contract: string; purchasePrice?: number; purchaseDate?: string; inServiceDate?: string; expenseTotal?: number; revenueTotal?: number; netOperatingReturn?: number };
type ProjectRow = Row & { ref: string; name: string; client: string; contract: string; manager: string; startDate: string; endDate: string; requiredVehicles: number; actualVehicles: number | null; status: string };
type Driver = Row & { name: string; phone: string; idNo: string; status: string; vehicle: string; license: string; renewal: string };
type Client = Row & { name: string; location: string; vat: string; commercial: string; contact: string; phone: string; contracts: number };
type Maintenance = Row & { ref: string; vehicle: string; type: string; manager: string; start: string; due: string; status: string; priority?: string; workflowStage?: MaintenanceStage; approvalStatus?: string; estimatedCost?: number; quotedPartsCost?: number; reportedBy?: string; diagnosis?: string; technician?: string; workshop?: string; warrantyUntil?: string; cost?: string };
type Document = Row & { name: string; entity: string; entityType?: string | null; entityId?: number | string | null; type: string; expiry: string; status: string; owner: string; hasFile?: boolean; fileUrl?: string | null; fileName?: string | null };
type Contract = Row & { ref: string; client: string; type: string; total: number; collected: number; expiry: string; status: string };
type Claim = Row & { ref: string; client: string; contract: string; amount: number; due: string; paid: number; status: string };
type PaymentRow = Row & { amount: number; paidAt: string; method: string; reference: string; contractId?: number | null; claimId?: number | null; clientId?: number | null };
const taskRelatedLabels: Record<TaskRelatedEntityType, string> = { vehicle: "مركبة", maintenance: "طلب صيانة", project: "مشروع", document: "مستند", driver: "سائق", employee: "موظف", client: "عميل", contract: "عقد", claim: "مطالبة مالية", payable: "فاتورة مورد" };

const navGroups: { label: string; items: { key: ModuleKey; label: string; icon: any; count?: string }[] }[] = [
  { label: "نظرة عامة", items: [{ key: "dashboard", label: "الإحصائيات", icon: LayoutDashboard }] },
  { label: "التشغيل", items: [
    { key: "vehicles", label: "المركبات", icon: CarFront },
    { key: "projects", label: "المشاريع", icon: Truck },
    { key: "maintenance", label: "الصيانة", icon: Wrench },
    { key: "accidents", label: "الحوادث", icon: ShieldAlert },
    { key: "inventory", label: "المخزون وقطع الغيار", icon: Package },
    { key: "documents", label: "المستندات", icon: FileCheck2 },
    { key: "drivers", label: "السائقون", icon: UserRound },
    { key: "employees", label: "الموظفون", icon: UsersRound },
    { key: "clients", label: "العملاء", icon: UsersRound },
  ] },
  { label: "المالية", items: [{ key: "finance", label: "المالية", icon: CircleDollarSign }, { key: "payables", label: "المستحقات علينا", icon: ArrowUpLeft }] },
  { label: "الإدارة", items: [{ key: "reports", label: "التقارير", icon: Activity }] },
  { label: "النظام", items: [{ key: "settings", label: "الإعدادات", icon: Settings2 }] },
];

function moduleForLocation(location: string): ModuleKey {
  const path = location.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/dashboard") return "dashboard";
  if (path.startsWith("/dashboard/financial/")) return "finance";
  const segment = path.slice("/dashboard/".length).split("/")[0];
  return (["vehicles", "projects", "maintenance", "accidents", "inventory", "documents", "drivers", "employees", "clients", "payables", "reports", "settings"] as const).includes(segment as any)
    ? segment as ModuleKey
    : "dashboard";
}

const statusTone: Record<string, string> = {
  "متاحة": "green", "متاح": "green", "ساري": "green", "مكتمل": "green", "مغلق": "green", "معتمد": "green", "نشط": "green", "قائم": "green", "مدفوعة": "green", "مدفوعة جزئيًا": "amber", "معتمدة": "blue", "بانتظار الاعتماد": "amber", "مخطط": "blue", "تم اعتمادها": "blue", "تم صرفها": "green",
  "مؤجرة": "blue", "مشغولة": "blue", "طارئ": "red", "عاجل": "red", "متوسط": "amber", "عادي": "gray", "جاري العمل": "amber", "قريبًا": "amber", "مستحقة": "amber", "جديد": "amber", "جديدة": "amber", "غير مرفوعة": "gray", "تحت الإجراء": "amber", "قيد التجهيز": "amber", "إجازة": "amber", "منتهي الخدمة": "gray",
  "في الصيانة": "red", "متوقفة": "red", "موقوف": "red", "متأخر": "red", "متأخرة": "red", "مرفوضة": "red", "مرفوض": "red", "متوقف": "red", "متأخر 2 يوم": "red", "ملغاة": "gray",
};

function Badge({ children }: { children: string }) {
  return <span className={`status-badge ${statusTone[children] || "gray"}`}><i />{children}</span>;
}
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-mark ${compact ? "compact" : ""}`}><span className="brand-monogram">هـ</span>{!compact && <span><strong>الهتاري</strong><small>PLUS</small></span>}</div>;
}
function formatSAR(value: number) { return `${value.toLocaleString("en-US")} SAR`; }
function addCalendarDays(value: string, days: number) { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function formatCurrencyText(value: unknown) { return String(value ?? "0 SAR").replace(/ر\.س/g, "SAR"); }
function exportCsv(rows: Row[], columns: string[], filename: string, headers: string[] = columns) {
  const csv = serializeCsv(headers, rows.map(row => columns.map(column => row[column])));
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = downloadUrl; link.download = `${filename}.csv`; link.style.display = "none";
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  toast.success("تم تجهيز ملف التصدير بنجاح");
}

function MetricCard({ title, value, helper, icon: Icon, tone, trend }: { title: string; value: string; helper: string; icon: any; tone: string; trend?: string }) {
  return <div className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
    <div className="metric-content"><span>{title}</span><strong>{value}</strong><small className={trend?.startsWith("+") ? "trend-up" : ""}>{trend || helper}</small></div>
    <span className="metric-helper">{helper}</span>
  </div>;
}

function Chart({ maintenance, range }: { maintenance: Maintenance[]; range: "month" | "quarter" | "year" }) {
  const today = formatCompanyDate();
  const start = new Date(`${today}T00:00:00.000Z`);
  if (range === "month") start.setUTCDate(1);
  else if (range === "quarter") start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
  else start.setUTCMonth(0, 1);
  const rangeStart = start.toISOString().slice(0, 10);
  const rangeMaintenance = maintenance.filter(item => String(item.start || "").slice(0, 10) >= rangeStart && String(item.start || "").slice(0, 10) <= today);
  const labels = ["بلاغ", "تقدير تكلفة", "اعتماد", "تنفيذ", "فحص بعد الإصلاح", "مغلق"];
  const counts = labels.map(label => rangeMaintenance.filter(item => (item.workflowStage || (item.status === "مكتمل" ? "مغلق" : "بلاغ")) === label).length);
  const max = Math.max(1, ...counts);
  return <div className="chart-wrap">
    <div className="chart-y"><span>{max}</span><span>{Math.round(max * .75)}</span><span>{Math.round(max * .5)}</span><span>{Math.round(max * .25)}</span><span>٠</span></div>
    <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="chart-svg" role="img" aria-label="توزيع طلبات الصيانة حسب المرحلة خلال الفترة المحددة">
      <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a9814d" stopOpacity=".18"/><stop offset="1" stopColor="#a9814d" stopOpacity="0"/></linearGradient></defs>
      {[28,58,88,118,148].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#e9eeec" strokeWidth="1" />)}
      {counts.map((count, i) => { const x = 50 + i * 100; const y = 148 - (count / max) * 120; return <g key={labels[i]}><rect x={x - 19} y={y} width="38" height={148 - y} rx="8" fill="#a9814d" opacity=".82" /><text x={x} y={Math.max(16, y - 8)} textAnchor="middle" fill="#25364c" fontSize="12">{count}</text></g>; })}
    </svg>
    <div className="chart-x">{labels.map(label => <span key={label}>{label}</span>)}</div>
    <div className="field-note" style={{ marginTop: "1rem" }}>طلبات بدأت ضمن الفترة المحددة · {rangeMaintenance.length.toLocaleString("en-US")} طلب</div>
  </div>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
      <div className="modal-head"><div><h3>{title}</h3><p>أدخل البيانات المطلوبة ثم احفظ التغييرات</p></div><button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>;
}
function Field({ label, value, onChange, placeholder, type = "text", disabled = false, maxLength, inputMode }: { label: string; value?: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; maxLength?: number; inputMode?: "numeric" | "text" }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ""} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} maxLength={maxLength} inputMode={inputMode} /></label>;
}
function FormActions({ onCancel, label = "حفظ التغييرات" }: { onCancel: () => void; label?: string }) { return <div className="form-actions"><button className="btn primary" type="submit"><Check size={16} />{label}</button><button className="btn ghost" type="button" onClick={onCancel}>إلغاء</button></div>; }

function LinkedDocumentsSection({ entityType, entityId, canViewDocuments }: { entityType: string; entityId: number; canViewDocuments: boolean }) {
  const query = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canViewDocuments });
  const linked = ((query.data as Document[] | undefined) ?? []).filter(document => isLinkedDocument(document, entityType, entityId));
  return <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>المستندات المرتبطة</h3><span>{canViewDocuments ? `${linked.length} مستند` : "يلزم إذن المستندات لعرض المرفقات"}</span></div></div>{!canViewDocuments ? <div className="field-note" role="status">يلزم منح صلاحية «المستندات» لعرض المرفقات.</div> : linked.length ? <div className="compact-list">{linked.map(document => <div className="compact-row" key={document.id}><div className="compact-main"><strong>{document.name}</strong><small>{document.type} · ينتهي {document.expiry}</small></div><Badge>{document.status}</Badge><DocumentFileActions file={document} /></div>)}</div> : <div className="empty-state" style={{ padding: "1.25rem" }}>لا توجد مستندات مرتبطة بهذا السجل.</div>}</section>;
}

function DocumentFileActions({ file }: { file: Document }) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);
  if (!file.hasFile && !file.fileUrl) return null;
  const retrieve = async (mode: "preview" | "download") => {
    const previewTab = mode === "preview" ? window.open("about:blank", "_blank") : null;
    if (previewTab) previewTab.opener = null;
    setLoading(true);
    try {
      const attachment = file.fileUrl ? { name: file.fileName || file.name, url: file.fileUrl } : await utils.documents.file.fetch({ id: file.id });
      if (!attachment?.url) throw new Error("لم يتم العثور على ملف المستند");
      if (mode === "preview") {
        if (previewTab) previewTab.location.href = attachment.url;
        else window.location.assign(attachment.url);
      } else {
        if (previewTab) previewTab.close();
        const link = document.createElement("a");
        link.href = attachment.url;
        link.download = attachment.name || file.fileName || file.name || "document";
        link.click();
      }
    } catch (error: any) {
      previewTab?.close();
      toast.error(error.message || "تعذر فتح المستند");
    } finally { setLoading(false); }
  };
  return <div className="row-actions"><button className="row-menu-btn" title="تحميل المستند" aria-label={`تحميل ${file.name}`} disabled={loading} onClick={() => void retrieve("download")}><Download size={16} /></button><button className="row-menu-btn" title="معاينة المستند" aria-label={`معاينة ${file.name}`} disabled={loading} onClick={() => void retrieve("preview")}><BookOpen size={16} /></button></div>;
}

function DetailModal({ row, module, canAccess, onClose, onEdit }: { row: Row; module: ModuleKey; canAccess: (key: ModuleKey) => boolean; onClose: () => void; onEdit?: () => void }) {
  const title = module === "vehicles" ? `تفاصيل المركبة · ${row.plate}` : module === "drivers" ? `ملف السائق · ${row.name}` : module === "clients" ? `ملف العميل · ${row.name}` : module === "dashboard" && row.title ? `تفاصيل المهمة · ${row.title}` : "تفاصيل السجل";
  const linkedEntityType = module === "clients" ? "عميل" : module === "employees" ? "موظف" : module === "projects" ? "مشروع" : module === "maintenance" ? "صيانة" : module === "finance" ? (row.recordType === "payment" ? null : row.recordType === "claim" || String(row.ref || "").startsWith("CL-") ? "مطالبة" : "عقد") : null;
  const entries = Object.entries(row).filter(([key]) => key !== "id" && key !== "fileUrl");
  const displayValue = (value: unknown) => {
    if (value instanceof Date) return value.toLocaleString("en-US");
    if (typeof value === "number") return value.toLocaleString("en-US");
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  return <Modal title={title} onClose={onClose} wide><div className="detail-grid">{entries.map(([key, value]) => <div className="detail-cell" key={key}><span>{key === "plate" ? "رقم اللوحة" : key === "brand" ? "الشركة" : key === "model" ? "الموديل" : key === "status" ? "الحالة" : key === "driver" ? "السائق" : key === "client" ? "العميل" : key === "phone" ? "رقم الهاتف" : key === "location" ? "الموقع" : key === "vehicle" ? "المركبة الحالية" : key === "contracts" ? "العقود" : key === "fileName" ? "اسم الملف" : key}</span><strong>{displayValue(value)}</strong></div>)}</div>{linkedEntityType && <LinkedDocumentsSection entityType={linkedEntityType} entityId={row.id} canViewDocuments={canAccess("documents")} />}<div className="detail-footer"><button className="btn ghost" onClick={onClose}>إغلاق</button>{module === "documents" && <DocumentFileActions file={row as Document} />}{onEdit && <button className="btn primary" onClick={() => { onClose(); onEdit(); }}><Pencil size={15} />تعديل البيانات</button>}</div></Modal>;
}

function RecordForm({ module, row, canAccess, onClose, onSave }: { module: ModuleKey; row?: Row | null; canAccess: (key: ModuleKey) => boolean; onClose: () => void; onSave: (data: Row) => void }) {
  const isEdit = Boolean(row);
  const isClaim = module === "finance" && (row?.recordType === "claim" || String(row?.ref || "").startsWith("CL-"));
  const isPayment = module === "finance" && row?.recordType === "payment";
  const claimStatusTransitions: Record<string, string[]> = { "غير مرفوعة": ["جديدة", "ملغاة"], "جديدة": ["تحت الإجراء", "مرفوضة", "ملغاة"], "تحت الإجراء": ["جديدة", "تم اعتمادها", "مرفوضة", "ملغاة"], "تم اعتمادها": ["تحت الإجراء", "ملغاة"], "تم صرفها": [], "مرفوضة": ["جديدة", "ملغاة"], "ملغاة": ["جديدة"] };
  const defaults: Row = module === "maintenance"
    ? { id: Date.now(), ref: `MT-${Math.floor(24000 + Math.random() * 900)}`, vehicle: "", type: "صيانة دورية", priority: "متوسط", workflowStage: "اعتماد", approvalStatus: "بانتظار الاعتماد", reportedBy: "—", reason: "", diagnosis: "", workDone: "", parts: "", technician: "—", workshop: "", manager: "", start: formatCompanyDate(), due: "", expectedReturn: "", estimatedCost: 0, quotedPartsCost: 0, laborCost: 0, partsCost: 0, warrantyUntil: "—", status: "جديد", cost: "0 SAR" }
    : module === "documents"
      ? { id: Date.now(), name: "", entity: "", entityType: "مركبة", entityId: null, type: "مركبة", expiry: "", status: "ساري", owner: "" }
      : module === "finance"
        ? (isPayment ? { id: Date.now(), recordType: "payment", clientId: null, contractId: null, claimId: null, amount: 0, paidAt: "", method: "تحويل بنكي", reference: "—", notes: "" } : isClaim ? { id: Date.now(), recordType: "claim", ref: `CL-${Math.floor(10000 + Math.random() * 900)}`, client: "", contract: "", amount: 0, paid: 0, due: "", submittedAt: "", followUpAt: "", notes: "", status: "جديدة" } : { id: Date.now(), ref: `CN-${Math.floor(24000 + Math.random() * 900)}`, client: "", type: "تشغيل أسطول", total: 0, collected: 0, expiry: "", status: "قائم", items: [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }] })
        : module === "drivers"
          ? { id: Date.now(), name: "", phone: "", idNo: "", license: "خصوصي", renewal: "", vehicle: "—", status: "متاح" }
          : module === "clients"
            ? { id: Date.now(), name: "", location: "", vat: "", commercial: "", contact: "", phone: "", contracts: 0 }
            : { id: Date.now(), plate: "", brand: "تويوتا", model: "", year: "2026", color: "أبيض", mileage: "0 كم", purchasePrice: 0, purchaseDate: "—", inServiceDate: "—", projectId: null, project: "—", driver: "—", employeeId: null, employee: "—", status: "متاحة", client: "—", contract: "—" };
  const [form, setForm] = useState<Row>(() => row || defaults);
  const editableClaimStatuses = Array.from(new Set([String(form.status || "جديدة"), ...(claimStatusTransitions[String(form.status || "جديدة")] || [])]));
  const set = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const vehicleQuery = trpc.vehicles.list.useQuery(undefined, { enabled: canAccess("vehicles") });
  const driverQuery = trpc.drivers.list.useQuery(undefined, { enabled: canAccess("drivers") });
  const clientQuery = trpc.clients.list.useQuery(undefined, { enabled: canAccess("clients") });
  const contractQuery = trpc.contracts.list.useQuery(undefined, { enabled: canAccess("finance") });
  const claimQuery = trpc.claims.list.useQuery(undefined, { enabled: canAccess("finance") });
  const projectQuery = trpc.projects.list.useQuery(undefined, { enabled: canAccess("projects") });
  const employeeQuery = trpc.employees.list.useQuery(undefined, { enabled: canAccess("employees") });
  const maintenanceQuery = trpc.maintenance.list.useQuery(undefined, { enabled: canAccess("maintenance") });
  const vehicles = canAccess("vehicles") ? vehicleQuery.data ?? [] : [];
  const drivers = canAccess("drivers") ? driverQuery.data ?? [] : [];
  const clients = canAccess("clients") ? clientQuery.data ?? [] : [];
  const contracts = canAccess("finance") ? contractQuery.data ?? [] : [];
  const claims = canAccess("finance") ? claimQuery.data ?? [] : [];
  const projects = canAccess("projects") ? projectQuery.data ?? [] : [];
  const employees = canAccess("employees") ? employeeQuery.data ?? [] : [];
  const maintenance = canAccess("maintenance") ? maintenanceQuery.data ?? [] : [];
  const getDocumentEntities = (type: string): Row[] => type === "مركبة" ? vehicles : type === "سائق" ? drivers : type === "موظف" ? employees : type === "مشروع" ? projects : type === "عميل" ? clients : type === "عقد" ? contracts : type === "مطالبة" ? claims : type === "صيانة" ? maintenance : [];
  const { data: settings = [] } = trpc.settingsCatalog.list.useQuery();
  const configuredLicenseTypes = (settings ?? []).filter(setting => setting.category === "license_types" && setting.active).map(setting => ({ value: setting.value, label: setting.label }));
  const defaultLicenseTypes = ["خصوصي", "سائق نقل ثقيل", "سائق نقل خفيف", "سائق حافلة كبير", "سائق عمومي مركبات", "سائق حافلة"].map(value => ({ value, label: value }));
  const licenseTypes = Array.from(new Map([...defaultLicenseTypes, ...configuredLicenseTypes, ...(form.license ? [{ value: String(form.license), label: String(form.license) }] : [])].map(option => [option.value, option])).values());
  const selectedClaimClient = clients.find(client => String(client.id) === String(form.clientId)) ?? clients.find(client => client.name === String(form.client || ""));
  const claimClientContracts = contracts.filter(contract => selectedClaimClient && (contract.clientId === selectedClaimClient.id || (!contract.clientId && contract.client === selectedClaimClient.name)));
  const selectedVehicleClient = module === "vehicles" ? clients.find(client => String(client.id) === String(form.clientId)) : undefined;
  const vehicleContracts = contracts.filter(contract => !selectedVehicleClient || contract.clientId === selectedVehicleClient.id || (!contract.clientId && contract.client === selectedVehicleClient.name));
  const selectedVehicleContract = vehicleContracts.find(contract => String(contract.id) === String(form.contractId));
  const vehicleProjects = projects.filter(project => {
    const belongsToClient = !selectedVehicleClient || project.clientId === selectedVehicleClient.id || (!project.clientId && project.client === selectedVehicleClient.name);
    const matchesContract = !selectedVehicleContract || !project.contractId || project.contractId === selectedVehicleContract.id;
    return belongsToClient && matchesContract;
  });
  const contractItems = Array.isArray(form.items) ? form.items as Array<Row & { vehicleId?: number | null; vehiclePlate?: string; driver?: string; coverage?: string; description?: string }> : [];
  const updateContractItem = (index: number, changes: Partial<Row>) => setForm(current => ({ ...current, items: contractItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) }));
  const contractVehicleOptions = vehicles.filter(vehicle => (!vehicle.contractId || vehicle.contractId === form.id) && (!form.clientId || vehicle.clientId === form.clientId || !vehicle.clientId));
  const submit = (e: React.FormEvent) => { e.preventDefault(); const required = isPayment ? form.amount && form.paidAt : module === "vehicles" ? form.plate : module === "maintenance" ? form.vehicle : module === "documents" ? form.name : module === "finance" ? form.client : form.name; if (!required) { toast.error("أكمل الحقول المطلوبة أولًا"); return; } if (module === "maintenance" && !isEdit && (!form.quoteName || !form.quoteUrl || Number(form.estimatedCost || 0) + Number(form.quotedPartsCost || 0) <= 0)) { toast.error("أرفق عرض سعر الورشة وأدخل قيمة العرض أو قطع الغيار"); return; } if (module === "clients" && !isEdit && (!form.vat || !form.commercial)) { toast.error("الرقم الضريبي والسجل التجاري حقول مطلوبة"); return; } if (module === "clients" && (form.vat !== row?.vat || !isEdit) && !isOptionalFixedLengthIdentity(form.vat, 15)) { toast.error("الرقم الضريبي يجب أن يتكون من 15 رقمًا"); return; } if (module === "clients" && (form.commercial !== row?.commercial || !isEdit) && !isOptionalFixedLengthIdentity(form.commercial, 10)) { toast.error("السجل التجاري يجب أن يتكون من 10 أرقام"); return; } if (module === "drivers" && (form.idNo !== row?.idNo || !isEdit) && !isOptionalFixedLengthIdentity(form.idNo, 10)) { toast.error("رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام"); return; } const payload: Row = { ...form, ...(module === "clients" ? { vat: normalizeIdentityNumber(form.vat), commercial: normalizeIdentityNumber(form.commercial) } : {}), ...(module === "drivers" ? { idNo: normalizeIdentityNumber(form.idNo) } : {}) }; onSave(module === "finance" && !isPayment && !isClaim ? { ...payload, notes: payload.notes ?? "", items: ((payload.items as any[])?.length ? payload.items : [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }]).map((item: any) => ({ ...item, coverage: ["مركبة وسائق", "سائق فقط", "مركبة فقط"].includes(item.coverage) ? item.coverage : "مركبة وسائق" })) } : payload); };
  if (module === "vehicles") return <Modal title={isEdit ? "تعديل بيانات المركبة" : "إضافة مركبة جديدة"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><Field label="رقم اللوحة *" value={form.plate} onChange={set("plate")} placeholder="مثال: أ ب ج 4821" /><label className="field"><span>شركة السيارة</span><select value={form.brand} onChange={e => set("brand")(e.target.value)}><option value="—">اختر الماركة</option>{(settings ?? []).filter(s => s.category === "car_companies" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><label className="field"><span>الموديل</span><select value={form.model} onChange={e => set("model")(e.target.value)}><option value="">اختر الموديل</option>{(settings ?? []).filter(s => s.category === "car_models" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="سنة الصنع" value={form.year} onChange={set("year")} /><label className="field"><span>اللون</span><select value={form.color} onChange={e => set("color")(e.target.value)}><option value="">اختر اللون</option>{(settings ?? []).filter(s => s.category === "colors" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="عداد المسافة" value={form.mileage} onChange={set("mileage")} />{canAccess("finance") && <><Field label="قيمة الشراء (SAR)" value={String(form.purchasePrice ?? 0)} onChange={value => setForm(prev => ({ ...prev, purchasePrice: Number(value.replace(/[^0-9]/g, "")) || 0 }))} type="number" /><Field label="تاريخ الشراء" value={form.purchaseDate && form.purchaseDate !== "—" ? form.purchaseDate : ""} onChange={set("purchaseDate")} type="date" /><Field label="تاريخ دخول الشركة / الخدمة" value={form.inServiceDate && form.inServiceDate !== "—" ? form.inServiceDate : ""} onChange={set("inServiceDate")} type="date" /></>}<label className="field"><span>الحالة</span><select value={form.status} onChange={e => set("status")(e.target.value)}><option>متاحة</option><option>مؤجرة</option><option>مشغولة</option><option>في الصيانة</option><option>قيد التجهيز</option><option>متوقفة</option></select></label><label className="field"><span>السائق</span><select value={form.driverId || ""} onChange={e => { const d = drivers.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, driverId: d ? d.id : null, driver: d ? d.name : "—"})); }}><option value="">بدون سائق</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>{canAccess("employees") && <label className="field"><span>الموظف المسؤول</span><select value={form.employeeId || ""} onChange={e => { const employee = employees.find(item => String(item.id) === e.target.value); setForm(prev => ({ ...prev, employeeId: employee?.id ?? null, employee: employee?.name ?? "—" })); }}><option value="">بدون موظف مسؤول</option>{employees.filter(employee => employee.status === "نشط").map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.jobTitle}</option>)}</select></label>}<label className="field"><span>العميل</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—", contractId: null, contract: "—", projectId: null, project: "—"})); }}><option value="">بدون عميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>العقد</span><select value={form.contractId || ""} onChange={e => { const cn = vehicleContracts.find(x => String(x.id) === e.target.value); const project = projects.find(item => String(item.id) === String(form.projectId)); setForm(prev => ({...prev, contractId: cn ? cn.id : null, contract: cn ? cn.ref : "—", ...(project?.contractId && project.contractId !== cn?.id ? { projectId: null, project: "—" } : {})})); }}><option value="">بدون عقد</option>{vehicleContracts.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label>{canAccess("projects") ? <label className="field"><span>المشروع</span><select value={form.projectId || ""} onChange={e => { const project = vehicleProjects.find(item => String(item.id) === e.target.value); const linkedContract = project?.contractId ? contracts.find(contract => contract.id === project.contractId) : undefined; setForm(prev => ({ ...prev, projectId: project?.id ?? null, project: project?.name ?? "—", ...(project?.clientId ? { clientId: project.clientId, client: project.client } : {}), ...(linkedContract ? { contractId: linkedContract.id, contract: linkedContract.ref } : {}) })); }}><option value="">بدون مشروع</option>{vehicleProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : <label className="field"><span>المشروع المرتبط</span><input value={form.project || "—"} disabled /></label>}</div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إضافة المركبة"} /></form></Modal>;
  if (module === "maintenance") return <Modal title={isEdit ? "تعديل طلب الصيانة" : "طلب صيانة جديد"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <label className="field"><span>المركبة *</span><select value={form.vehicleId || ""} onChange={e => { const v = vehicles.find(x => String(x.id) === e.target.value); setForm(prev => ({ ...prev, vehicleId: v ? v.id : null, vehicle: v ? v.plate : "" })); }}><option value="">اختر مركبة</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand}</option>)}</select></label>
    <label className="field"><span>نوع الصيانة</span><select value={form.type} onChange={e => set("type")(e.target.value)}><option value="—">اختر النوع</option>{(settings ?? []).filter(s => s.category === "pm" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label>
    <label className="field"><span>الأولوية</span><select value={form.priority || "متوسط"} onChange={e => set("priority")(e.target.value)}>{["طارئ", "عاجل", "متوسط", "عادي"].map(value => <option key={value}>{value}</option>)}</select></label>
    <Field label="مسؤول الصيانة" value={form.manager} onChange={set("manager")} />
    <Field label="تاريخ البلاغ" value={form.start} onChange={set("start")} type="date" />
    <Field label="سبب البلاغ" value={form.reason} onChange={set("reason")} />
    <Field label="التشخيص" value={form.diagnosis} onChange={set("diagnosis")} />
    <Field label="الفني" value={form.technician} onChange={set("technician")} />
    <Field label="الورشة" value={form.workshop} onChange={set("workshop")} />
    <Field label="موعد الفحص / التنفيذ" value={form.due} onChange={set("due")} type="date" />
    <Field label="العودة المتوقعة للتشغيل" value={form.expectedReturn} onChange={set("expectedReturn")} type="date" />
    <Field label="قطع الغيار المستخدمة" value={form.parts} onChange={set("parts")} />
    <Field label="العمل المنجز" value={form.workDone} onChange={set("workDone")} />
    {!isEdit ? <><Field label="قيمة عرض الورشة (SAR)" value={String(form.estimatedCost ?? 0)} onChange={value => setForm(prev => ({ ...prev, estimatedCost: Number(value.replace(/[^0-9]/g, "")) || 0 }))} type="number" /><Field label="قيمة قطع الغيار حسب العرض (SAR)" value={String(form.quotedPartsCost ?? 0)} onChange={value => setForm(prev => ({ ...prev, quotedPartsCost: Number(value.replace(/[^0-9]/g, "")) || 0 }))} type="number" /><label className="field"><span>عرض سعر الورشة *</span><input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={e => { const file=e.target.files?.[0]; if(!file)return; void readUploadDataUrl(file).then(quoteUrl=>setForm(prev=>({...prev,quoteName:file.name,quoteUrl}))).catch(error=>toast.error(error.message)); }} />{form.quoteName && <small>{form.quoteName}</small>}</label></> : form.approvalStatus === "بانتظار الاعتماد" && canAccess("finance") && <><Field label="قيمة عرض الورشة (SAR)" value={String(form.estimatedCost ?? 0)} onChange={value => setForm(prev => ({ ...prev, estimatedCost: Number(value.replace(/[^0-9]/g, "")) || 0 }))} type="number" /><Field label="قيمة قطع الغيار حسب العرض (SAR)" value={String(form.quotedPartsCost ?? 0)} onChange={value => setForm(prev => ({ ...prev, quotedPartsCost: Number(value.replace(/[^0-9]/g, "")) || 0 }))} type="number" />{form.quoteName && <small>{form.quoteName}</small>}</>}
    {canAccess("finance") && form.approvalStatus === "معتمد" && ["تنفيذ", "فحص بعد الإصلاح"].includes(String(form.workflowStage)) && <div className="field-note">التكلفة الفعلية المسجلة حاليًا: <strong>{formatSAR(Number(String(form.cost || "0").replace(/[^0-9]/g, "")) || 0)}</strong>. سجّل فاتورة المورد من زر «تسجيل فاتورة» في صف الطلب؛ بعد اعتمادها تُحدّث تكلفة الطلب والمركبة تلقائيًا. لا تُسجّل عرض السعر كتكلفة فعلية.</div>}
    <Field label="الضمان حتى" value={form.warrantyUntil === "—" ? "" : form.warrantyUntil} onChange={set("warrantyUntil")} type="date" />
    </div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إنشاء طلب الصيانة"} /></form></Modal>;
  if (module === "documents") return <Modal title={isEdit ? "تعديل بيانات المستند" : "رفع مستند جديد"} onClose={onClose}><form onSubmit={submit}><div className="form-grid single"><Field label="اسم المستند *" value={form.name} onChange={set("name")} /><label className="field"><span>نوع الكيان المرتبط</span><select value={form.entityType || "مركبة"} onChange={e => setForm(prev => ({ ...prev, entityType: e.target.value, entityId: null, entity: "—" }))}><option>مركبة</option><option>سائق</option><option>موظف</option><option>مشروع</option><option>عميل</option><option>عقد</option><option>مطالبة</option><option>صيانة</option></select></label><label className="field"><span>الكيان المرتبط</span><select value={form.entityId || ""} onChange={e => { const options = getDocumentEntities(String(form.entityType || "مركبة")); const item = options.find((entity: any) => String(entity.id) === e.target.value); setForm(prev => ({ ...prev, entityId: item?.id ?? null, entity: item ? (item.plate || item.ref || item.name || item.title || `#${item.id}`) : "—" })); }}><option value="">اختر كيان</option>{getDocumentEntities(String(form.entityType || "مركبة")).map((entity: any) => <option key={entity.id} value={entity.id}>{entity.plate || entity.ref || entity.name || entity.title || `#${entity.id}`}</option>)}</select></label><label className="field"><span>النوع</span><select value={form.type} onChange={e => set("type")(e.target.value)}><option value="">اختر نوع المستند</option>{(settings ?? []).filter(s => s.category === "attachment_names" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="تاريخ الانتهاء" value={form.expiry} onChange={set("expiry")} type="date" />{form.hasFile && !form.fileUrl && <div className="assignment-note"><FileText size={15} /><span>مرفق حاليًا: {form.fileName || "ملف المستند"}</span><DocumentFileActions file={form as Document} /></div>}<label className="field"><span>الملف</span><input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={e => { const file = e.target.files?.[0]; if (!file) return; void readUploadDataUrl(file).then(fileUrl=>setForm(prev=>({...prev,fileName:file.name,fileUrl}))).catch(error=>toast.error(error.message)); }} /></label></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "رفع المستند"} /></form></Modal>;
  if (module === "finance" && isPayment && !canAccess("clients")) return <Modal title="تسجيل دفعة مالية" onClose={onClose}><div className="field-note" role="status">يلزم منح المستخدم صلاحية «العملاء» لربط الدفعة بعميل أو عقد أو مطالبة.</div><div className="detail-footer"><button className="btn ghost" onClick={onClose}>إغلاق</button></div></Modal>;
  if (module === "finance" && isPayment) return <Modal title="تسجيل دفعة مالية" onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>رقم العقد</span><select value={form.contractId || ""} onChange={e => { const contract = contracts.find(c => String(c.id) === e.target.value); setForm(prev => ({ ...prev, contractId: contract ? contract.id : null, clientId: contract?.clientId ?? prev.clientId ?? null })); }}><option value="">اختر العقد</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label><label className="field"><span>المطالبة المرتبطة</span><select value={form.claimId || ""} onChange={e => { const claim = claims.find(c => String(c.id) === e.target.value); setForm(prev => ({ ...prev, claimId: claim ? claim.id : null, contractId: claim?.contractId ?? prev.contractId ?? null, clientId: claim?.clientId ?? prev.clientId ?? null })); }}><option value="">بدون مطالبة</option>{claims.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label><label className="field"><span>العميل</span><select value={form.clientId || ""} onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="المبلغ *" value={String(form.amount ?? "")} onChange={v => setForm(prev => ({ ...prev, amount: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الدفع *" value={form.paidAt} onChange={set("paidAt")} type="date" /><label className="field"><span>طريقة الدفع</span><select value={form.method} onChange={e => set("method")(e.target.value)}>{(settings ?? []).filter(s => s.category === "payment_methods" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}<option value="تحويل بنكي">تحويل بنكي</option></select></label><Field label="المرجع" value={form.reference} onChange={set("reference")} /></div><FormActions onCancel={onClose} label="حفظ الدفعة" /></form></Modal>;
  if (module === "finance" && isClaim) return <Modal title={isEdit ? "تعديل المطالبة المالية" : "إنشاء مطالبة مالية"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—", contractId: null, contract: "—"})); }}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>العقد *</span><select value={form.contractId || ""} disabled={!selectedClaimClient} onChange={e => { const cn = claimClientContracts.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, contractId: cn ? cn.id : null, contract: cn ? cn.ref : "—"})); }}><option value="">{selectedClaimClient ? claimClientContracts.length ? "اختر العقد" : "لا توجد عقود لهذا العميل" : "اختر العميل أولًا"}</option>{claimClientContracts.map(c => <option key={c.id} value={c.id}>{c.ref}</option>)}</select></label><Field label="قيمة المطالبة" value={String(form.amount ?? "")} onChange={v => setForm(prev => ({ ...prev, amount: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الرفع" value={form.submittedAt} onChange={set("submittedAt")} type="date" /><Field label="تاريخ الاستحقاق" value={form.due} onChange={set("due")} type="date" /><Field label="موعد المتابعة" value={form.followUpAt} onChange={set("followUpAt")} type="date" /><label className="field"><span>الحالة</span><select value={form.status} disabled={form.status === "تم صرفها"} onChange={e => set("status")(e.target.value)}>{editableClaimStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select>{form.status === "تم صرفها" && <small>تتغير هذه الحالة تلقائيًا عند تسجيل دفعة تغطي كامل قيمة المطالبة.</small>}</label><Field label="ملاحظات المتابعة" value={form.notes} onChange={set("notes")} /></div><FormActions onCancel={onClose} label={isEdit ? "حفظ المطالبة" : "إنشاء المطالبة"} /></form></Modal>;
  if (module === "finance") return <Modal title={isEdit ? "تعديل العقد" : "إنشاء عقد مالي"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">{canAccess("clients") ? <label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—"})); }}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <Field label="العميل *" value={form.client} disabled={isEdit} onChange={set("client")} />}<Field label="نوع العقد" value={form.type} onChange={set("type")} /><Field label="تاريخ البداية" value={form.startDate} onChange={set("startDate")} type="date" /><Field label="القيمة الإجمالية" value={String(form.total ?? "")} onChange={v => setForm(prev => ({ ...prev, total: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="المحصل (تُنشأ دفعة تلقائيًا)" value={String(form.collected ?? "")} onChange={v => setForm(prev => ({ ...prev, collected: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الانتهاء" value={form.expiry} onChange={set("expiry")} type="date" /><div style={{ gridColumn: "1 / -1", display: "grid", gap: ".75rem" }}><div className="section-head"><div><h3>مركبات العقد</h3><span>{contractItems.filter(item => item.vehicleId).length.toLocaleString("en-US")} مركبة مرتبطة · أضف مركبة جديدة أو أزل مركبة أُعيدت للشركة</span></div><button type="button" className="btn outline" disabled={!canAccess("vehicles") || !canAccess("drivers")} onClick={() => setForm(current => ({ ...current, items: [...(Array.isArray(current.items) ? current.items as Row[] : []), { vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }] }))}><Plus size={15} />إضافة مركبة للعقد</button></div>{contractItems.map((item, index) => <div key={item.id ?? `contract-item-${index}`} className="form-grid" style={{ padding: ".75rem", border: "1px solid var(--border)", borderRadius: ".75rem", alignItems: "end" }}><label className="field"><span>المركبة {index + 1}</span><select disabled={!canAccess("vehicles") || !canAccess("drivers")} value={item.vehicleId || ""} onChange={event => { const selected = contractVehicleOptions.find(vehicle => String(vehicle.id) === event.target.value); updateContractItem(index, { vehicleId: selected?.id ?? null, vehiclePlate: selected?.plate ?? "—", driver: selected?.driver || item.driver || "—" }); }}><option value="">بدون مركبة</option>{contractVehicleOptions.filter(vehicle => vehicle.id === item.vehicleId || !contractItems.some((other, otherIndex) => otherIndex !== index && other.vehicleId === vehicle.id)).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.brand} {vehicle.model}</option>)}</select></label><label className="field"><span>التغطية</span><select value={item.coverage || "مركبة وسائق"} onChange={event => updateContractItem(index, { coverage: event.target.value })}><option>مركبة وسائق</option><option>مركبة فقط</option><option>سائق فقط</option></select></label><label className="field"><span>السائق المرتبط</span><input value={item.driver || "—"} onChange={event => updateContractItem(index, { driver: event.target.value })} /></label><label className="field"><span>وصف البند</span><input value={item.description || "خدمة تشغيل"} onChange={event => updateContractItem(index, { description: event.target.value })} /></label><button type="button" className="btn ghost" aria-label={`إرجاع المركبة ${index + 1} وفكها من العقد`} disabled={!canAccess("vehicles") || !canAccess("drivers")} onClick={() => setForm(current => { const nextItems = (Array.isArray(current.items) ? current.items as Row[] : []).filter((_, itemIndex) => itemIndex !== index); return { ...current, items: nextItems.length ? nextItems : [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }] }; })}><Trash size={15} />إرجاع المركبة</button></div>)}<small className="field-note">عند حفظ التعديل، تُفك المركبة التي أُزيلت من العقد وتُحدّث حالتها التشغيلية. لا يمكن فك مركبة ما زالت مرتبطة بمشروع العقد.</small></div></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إنشاء العقد"} /></form></Modal>;
  const config = module === "drivers" ? { title: isEdit ? "تعديل بيانات السائق" : "إضافة سائق جديد", fields: [["name", "الاسم الكامل *"], ["phone", "رقم الهاتف"], ["idNo", "رقم الهوية / الإقامة"], ["license", "نوع الرخصة"], ["renewal", "تاريخ انتهاء الرخصة"]] } : { title: isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد", fields: [["name", "اسم العميل *"], ["vat", "الرقم الضريبي * (15 رقمًا)"], ["commercial", "السجل التجاري * (10 أرقام)"], ["location", "الموقع"], ["contact", "اسم الممثل"], ["phone", "رقم اتصال الممثل"]] };
  return <Modal title={config.title} onClose={onClose}><form onSubmit={submit}><div className="form-grid single">{config.fields.map(([key, label]) => key === "license" ? <label className="field" key={key}><span>{label}</span><select value={form[key]} onChange={e => set(key)(e.target.value)}><option value="">اختر نوع الترخيص</option>{licenseTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : <Field key={key} label={label} value={form[key]} maxLength={key === "idNo" || key === "commercial" ? 10 : key === "vat" ? 15 : undefined} inputMode={key === "idNo" || key === "commercial" || key === "vat" ? "numeric" : undefined} onChange={value => { const cap = key === "idNo" || key === "commercial" ? 10 : key === "vat" ? 15 : undefined; set(key)(cap ? normalizeNumericInput(value, cap) : value); }} />)}</div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إضافة السجل"} /></form></Modal>;
}

function AssignDriverModal({ vehicle, drivers, onClose, onSave }: { vehicle: Vehicle; drivers: Driver[]; onClose: () => void; onSave: (driver: Driver | null) => void }) {
  const current = drivers.find(driver => driver.name === vehicle.driver || vehicle.driver.includes(driver.name.split(" ")[0]))?.id ?? "none";
  const [driverId, setDriverId] = useState(String(current));
  return <Modal title={`إسناد سائق · ${vehicle.plate}`} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave(driverId === "none" ? null : drivers.find(driver => String(driver.id) === driverId) || null); }}><div className="form-grid single"><label className="field"><span>السائق</span><select value={driverId} onChange={e => setDriverId(e.target.value)}><option value="none">بدون سائق</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} · {driver.status}{driver.vehicle !== "—" ? ` · ${driver.vehicle}` : ""}</option>)}</select></label><div className="assignment-note"><UserRound size={16} /><span>سيتم تحديث السائق الحالي في المركبة وحالة السائق معًا.</span></div></div><FormActions onCancel={onClose} label="حفظ الإسناد" /></form></Modal>;
}

function AssignVehicleModal({ driver, vehicles, onClose, onSave }: { driver: Driver; vehicles: Vehicle[]; onClose: () => void; onSave: (vehicle: Vehicle | null) => void }) {
  const [vehicleId, setVehicleId] = useState(String(vehicles.find(vehicle => vehicle.plate === driver.vehicle)?.id ?? "none"));
  return <Modal title={`إسناد مركبة · ${driver.name}`} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave(vehicleId === "none" ? null : vehicles.find(vehicle => String(vehicle.id) === vehicleId) || null); }}><div className="form-grid single"><label className="field"><span>المركبة</span><select value={vehicleId} onChange={e => setVehicleId(e.target.value)}><option value="none">بدون مركبة</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model} · {vehicle.driver === "—" ? "متاحة" : `مع ${vehicle.driver}`}</option>)}</select></label></div><FormActions onCancel={onClose} label="حفظ الإسناد" /></form></Modal>;
}

function QuickActionModal({ action, module, row, onClose, onSave }: { action: string; module: ModuleKey; row: Row; onClose: () => void; onSave: (value: string, details?: { reference?: string; amount?: number; recipient?: string }) => void }) {
  const statusOptions = module === "drivers" ? ["متاح", "مشغول", "موقوف"] : ["قائم", "مكتمل", "عرض سعر", "ملغي"];
  const maintenanceOptions = action === "stage" ? nextMaintenanceStages((row.workflowStage || "بلاغ") as MaintenanceStage) : ["عهدة", "تحويل مباشر", "رفض"];
  const config: Record<string, { title: string; label: string; placeholder?: string; options?: string[] }> = {
    status: { title: "تغيير الحالة", label: "الحالة الجديدة", options: statusOptions },
    stage: { title: "تقدم طلب الصيانة", label: "المرحلة التالية", options: maintenanceOptions },
    approval: { title: "اعتماد طلب الصيانة وتحديد التمويل", label: "طريقة التمويل", options: maintenanceOptions },
    "settle-advance": { title: "تسوية عهدة الصيانة", label: "مرجع التسوية", placeholder: "رقم الفاتورة أو مستند التسوية" },
    extend: { title: "تمديد تاريخ الانتهاء", label: "التاريخ الجديد", placeholder: "مثال: 30 ديسمبر 2026" },
    cost: { title: "تسجيل تكلفة أو فاتورة", label: "التكلفة", placeholder: "مثال: 1,250 SAR" },
    item: { title: "إضافة بند صيانة", label: "وصف البند", placeholder: "مثال: تغيير زيت وفلتر" },
  };
  const entry = config[action] || config.status;
  const [value, setValue] = useState(entry.options?.[0] || "");
  const [fundingReference, setFundingReference] = useState("");
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingRecipient, setFundingRecipient] = useState("");
  return <Modal title={entry.title} onClose={onClose}><form onSubmit={e => { e.preventDefault(); if (!value.trim()) { toast.error("أدخل قيمة صحيحة"); return; } if (action === "approval" && value !== "رفض" && (!fundingReference.trim() || !fundingAmount || !fundingRecipient.trim())) { toast.error("أدخل رقم العملية والمبلغ والجهة المستلمة"); return; } onSave(value, { reference: fundingReference, amount: Number(fundingAmount), recipient: fundingRecipient }); }}><div className="form-grid single"><div className="action-context"><strong>{row.ref || row.name || row.plate || "السجل المحدد"}</strong><span>سيتم تطبيق الإجراء على هذا السجل فقط.</span></div>{entry.options ? <label className="field"><span>{entry.label}</span><select value={value} onChange={e => setValue(e.target.value)}>{entry.options.map(option => <option key={option}>{option}</option>)}</select></label> : <Field label={entry.label} value={value} onChange={setValue} placeholder={entry.placeholder} />}{action === "approval" && value !== "رفض" && <><Field label="رقم أمر الصرف / التحويل" value={fundingReference} onChange={setFundingReference} /><Field label="المبلغ (SAR)" type="number" value={fundingAmount} onChange={setFundingAmount} /><Field label={value === "عهدة" ? "اسم موظف المشتريات المستلم" : "اسم الورشة / المورد المستلم"} value={fundingRecipient} onChange={setFundingRecipient} /></>}</div><FormActions onCancel={onClose} label="حفظ الإجراء" /></form></Modal>;
}

function ContextMenu({ row, module, onAction, onClose, canApprove = false }: { row: Row; module: ModuleKey; onAction: (action: string) => void; onClose: () => void; canApprove?: boolean }) {
  const isClaimRecord = module === "finance" && String(row.ref || "").startsWith("CL-");
  const maintenanceActions: [string, string][] = [["عرض التفاصيل", "view"], ["تعديل الطلب", "edit"]];
  const stage = row.workflowStage as MaintenanceStage | undefined;
  if (stage && nextMaintenanceStages(stage).length) maintenanceActions.push(["تقدم في دورة الصيانة", "stage"]);
  if (stage === "اعتماد" && row.approvalStatus === "بانتظار الاعتماد" && canApprove) maintenanceActions.push(["اعتماد / رفض التكلفة", "approval"]);
  if (row.fundingType === "عهدة" && row.advanceStatus === "مفتوحة" && canApprove) maintenanceActions.push(["تسوية العهدة", "settle-advance"]);
  if (stage === "مغلق" || stage === "مرفوض") maintenanceActions.push(["أرشفة الطلب", "archive"]);
  const actions = module === "vehicles" ? [["عرض التفاصيل", "view"], ["تعديل المركبة", "edit"], ["إضافة إلى الصيانة", "maintenance"], ["إسناد سائق", "assign"], ["أرشفة المركبة", "archive"]] : module === "maintenance" ? maintenanceActions : module === "documents" ? [["معاينة المستند", "view"], ["تحميل الملف", "download"], ["تعديل البيانات", "edit"], ["تمديد تاريخ الانتهاء", "extend"], ["أرشفة المستند", "archive"]] : module === "drivers" ? [["عرض الملف الشخصي", "view"], ["تعديل البيانات", "edit"], ["إسناد مركبة", "assign"], ["تغيير الحالة", "status"], ["أرشفة السائق", "archive"]] : module === "clients" ? [["عرض تفاصيل العميل", "view"], ["تعديل العميل", "edit"], ["عرض العقود", "contracts"], ["عرض المطالبات المالية", "claims"], ["إنشاء عقد جديد", "new-contract"]] : module === "finance" && isClaimRecord ? [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["أرشفة المطالبة", "archive"]] : [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["تغيير الحالة", "status"], ["تصدير السجل", "download"]];
  return <div className="context-menu" onMouseLeave={onClose}>{actions.map(([label, action], index) => <button key={action} className={index === actions.length - 1 && action === "archive" ? "danger" : ""} onClick={() => onAction(action)}><span>{action === "view" ? <BookOpen size={15} /> : action === "edit" ? <Pencil size={15} /> : action === "archive" ? <Archive size={15} /> : action === "download" ? <Download size={15} /> : action === "maintenance" ? <Wrench size={15} /> : action === "assign" ? <UserRound size={15} /> : <SlidersHorizontal size={15} />}</span>{label}</button>)}</div>;
}

function TableShell({ children, columns, onExport, search, setSearch, filter, setFilter, tabs, activeTab, setActiveTab, addLabel, onAdd }: { children: React.ReactNode; columns: string[]; onExport: () => void; search: string; setSearch: (s: string) => void; filter?: string; setFilter?: (s: string) => void; tabs: string[]; activeTab: string; setActiveTab: (s: string) => void; addLabel: string; onAdd: () => void }) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const rows = Children.toArray(children);
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  return <div className="table-card"><div className="table-tabs">{tabs.map(tab => <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => { setPage(1); setActiveTab(tab); }}>{tab}</button>)}</div><div className="table-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} placeholder="ابحث في السجلات..." /><kbd>⌘ K</kbd></div><div className="toolbar-actions">{setFilter && <button className="btn outline" onClick={() => setFilter(filter === "all" ? "active" : "all")}><Filter size={15} />{filter === "active" ? "تصفية مفعّلة" : "فلاتر"}</button>}<button className="btn outline" onClick={onExport}><Download size={15} />تصدير</button><button className="btn primary" onClick={onAdd}><Plus size={16} />{addLabel}</button></div></div><div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}<th className="actions-head">إجراءات</th></tr></thead><tbody>{visibleRows}</tbody></table></div><div className="table-footer"><span>صفحة {currentPage} من {pageCount} · {rows.length} سجل</span><div className="rows-select">صفوف لكل صفحة <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></div><div className="pagination"><button aria-label="السابق" disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronRight size={15} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => <button key={pageNumber} className={currentPage === pageNumber ? "current" : ""} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button aria-label="التالي" disabled={currentPage === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}><ChevronLeft size={15} /></button></div></div></div>;
}

function PageHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <button className="btn primary" onClick={onAction}><Plus size={17} />{action}</button>}</div>; }

function DashboardHome({ onNavigate, onNavigateFinanceView, userName, tasks, taskAssignees, relatedRecords, viewerUserId, notifications, vehicles, drivers, maintenance, documents, contracts, claims, payables, projects, canAccess, onTaskToggle, onTaskCreate, canManageTasks, onNotificationOpen, onOpenNotifications, onMaintenanceOpen, onTaskOpenRelated }: { onNavigate: (key: ModuleKey) => void; onNavigateFinanceView: (view: "contracts" | "claims") => void; userName?: string | null; tasks: WorkTask[]; taskAssignees: Array<{ id: number; name: string | null }>; relatedRecords: TaskRelatedOption[]; viewerUserId: number; notifications: Array<{ id: number; title: string; message: string; severity: string; readAt?: Date | string | null; entityType?: string | null; entityId?: number | null }>; vehicles: Vehicle[]; drivers: Driver[]; maintenance: Maintenance[]; documents: Document[]; contracts: Contract[]; claims: Claim[]; payables: PayableRow[]; projects: ProjectRow[]; canAccess: (key: ModuleKey) => boolean; onTaskToggle: (task: { id: number; status: string }) => void; onTaskCreate: (task: { title: string; description: string; dueAt: string; assigneeUserId: number; relatedEntityType: TaskRelatedEntityType | null; relatedEntityId: number | null }) => void; canManageTasks: boolean; onNotificationOpen: (notification: { id: number; entityType?: string | null; entityId?: number | null }) => void; onOpenNotifications: () => void; onMaintenanceOpen: (request: Maintenance) => void; onTaskOpenRelated: (task: WorkTask) => void }) {
  const [maintenanceRange, setMaintenanceRange] = useState<"month" | "quarter" | "year">("month");
  const [taskFilter, setTaskFilter] = useState<WorkTaskQueueFilter>("الكل");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskRelatedSearch, setTaskRelatedSearch] = useState("");
  const [taskLimit, setTaskLimit] = useState(8);
  const [taskDetail, setTaskDetail] = useState<WorkTask | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState({ title: "", description: "", dueAt: formatCompanyDate(), assigneeUserId: "", relatedEntityType: "" as TaskRelatedEntityType | "", relatedEntityId: "" });
  const availableTaskRelatedTypes = Array.from(new Set(relatedRecords.map(record => record.entityType)));
  const selectedTaskRelatedRecords = taskDraft.relatedEntityType ? relatedRecords.filter(record => record.entityType === taskDraft.relatedEntityType && matchesQuickSearch(record.label, taskRelatedSearch)) : [];
  const selectedTaskRelatedType = taskDraft.relatedEntityType;
  const taskRelatedRecordCount = taskDraft.relatedEntityType ? relatedRecords.filter(record => record.entityType === taskDraft.relatedEntityType).length : 0;
  const taskDetailRelatedRecord = taskDetail?.relatedEntityType && taskDetail.relatedEntityId ? relatedRecords.find(record => record.entityType === taskDetail.relatedEntityType && record.id === taskDetail.relatedEntityId) : undefined;
  const activeTasks = orderWorkTasks(tasks.filter(task => task.status !== "ملغاة"));
  const openTasks = activeTasks.filter(task => task.status !== "مكتملة");
  const overdueTasks = openTasks.filter(task => taskUrgency(task) === "متأخرة");
  const todayTasks = openTasks.filter(task => taskUrgency(task) === "اليوم");
  const upcomingTasks = openTasks.filter(task => taskUrgency(task) === "قادمة");
  const filteredTasks = filterWorkTasks(activeTasks, taskFilter).filter(task => matchesQuickSearch(task, taskSearch));
  const shownTasks = filteredTasks.slice(0, taskLimit);
  const totalVehicles = vehicles.length;
  const workingVehicles = vehicles.filter(v => ["مؤجرة", "مشغولة"].includes(v.status)).length;
  const readyVehicles = vehicles.filter(v => v.status === "متاحة").length;
  const maintenanceVehicles = vehicles.filter(v => v.status === "في الصيانة").length;
  const stoppedVehicles = vehicles.filter(v => v.status === "متوقفة").length;
  const setupVehicles = vehicles.filter(v => v.status === "قيد التجهيز").length;
  const operationRate = totalVehicles ? ((workingVehicles / totalVehicles) * 100).toFixed(1).replace(".", "٫") : "٠";
  const receivable = totalOutstandingClaims(claims);
  const payable = payables.filter(item => ["معتمدة", "مدفوعة جزئيًا", "مدفوعة"].includes(item.status)).reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  const pendingPayableAmount = payables.filter(item => item.status === "جديدة").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const openNotification = (item: (typeof notifications)[number]) => onNotificationOpen(item);
  const driverLicenseAlert = summarizeDriverLicenseAlerts(drivers);
  const automaticAlerts: Array<{ id: number; title: string; message: string; severity: string; target: ModuleKey; record?: Row; dueAt?: string }> = [
    ...(driverLicenseAlert ? [driverLicenseAlert] : []),
    ...claims.filter(item => isCompanyDateBeforeToday(item.due) && isReceivableClaimStatus(item.status) && outstandingClaimAmount(item) > 0).map(item => ({ id: 1000000 + item.id, title: `مطالبة متأخرة ${item.ref}`, message: `${item.client} · متبقٍ ${formatSAR(outstandingClaimAmount(item))}`, severity: "حرج", target: "finance" as ModuleKey, record: item, dueAt: item.due })),
    ...claims.filter(item => isCompanyDateBeforeToday(item.followUpAt) && isReceivableClaimStatus(item.status) && outstandingClaimAmount(item) > 0).map(item => ({ id: 1500000 + item.id, title: `متابعة مطلوبة للمطالبة ${item.ref}`, message: `${item.client} · موعد المتابعة ${item.followUpAt}`, severity: "تنبيه", target: "finance" as ModuleKey, record: item, dueAt: item.followUpAt })),
    ...payables.filter(item => item.overdue).map(item => ({ id: 1600000 + item.id, title: `فاتورة مورد متأخرة ${item.ref}`, message: `${item.supplier} · متبقٍ ${formatSAR(item.remaining)}`, severity: "حرج", target: "payables" as ModuleKey, record: item, dueAt: item.dueDate })),
    ...contracts.filter(item => item.status === "قائم" && isWithinUpcomingDays(item.expiry, 30)).map(item => ({ id: 2000000 + item.id, title: `عقد يقترب من الانتهاء ${item.ref}`, message: `${item.client} · ينتهي ${item.expiry}`, severity: "تنبيه", target: "finance" as ModuleKey, record: item, dueAt: item.expiry })),
    ...documents.filter(item => ["قريبًا", "متأخر", "منتهي"].includes(item.status)).map(item => ({ id: 3000000 + item.id, title: `مستند يحتاج مراجعة: ${item.name}`, message: `${item.entity} · ${item.expiry} · ${item.status}`, severity: item.status === "منتهي" || item.status === "متأخر" ? "حرج" : "تنبيه", target: "documents" as ModuleKey, record: item, dueAt: item.expiry })),
    ...maintenance.filter(item => item.status === "متوقف" || (item.status !== "مكتمل" && isCompanyDateBeforeToday(item.expectedReturn)) || (item.status !== "مكتمل" && item.createdAt && Date.now() - new Date(item.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000)).map(item => ({ id: 4000000 + item.id, title: `مركبة متوقفة: ${item.vehicle}`, message: `${item.reason || item.type} · ${item.status}`, severity: "حرج", target: "maintenance" as ModuleKey, record: item, dueAt: item.expectedReturn || item.due })),
  ];
  const manualAlerts = notifications.filter(item => !item.readAt).map(item => ({ ...item, target: notificationTarget(item.entityType) as ModuleKey, onOpen: () => openNotification(item) })).filter(item => canAccess(item.target));
  const alertPriority = (severity: string) => severity === "حرج" ? 0 : severity === "تنبيه" ? 1 : 2;
  const visibleAlerts = [
    ...automaticAlerts.filter(item => canAccess(item.target)).map(item => ({ ...item, onOpen: () => item.record ? onNotificationOpen({ id: item.id, entityType: item.target, entityId: item.record.id }) : onNavigate(item.target) })),
    ...manualAlerts,
  ].sort((a, b) => alertPriority(a.severity) - alertPriority(b.severity) || String(("dueAt" in a && a.dueAt) || "9999-12-31").localeCompare(String(("dueAt" in b && b.dueAt) || "9999-12-31")) || a.title.localeCompare(b.title, "ar")).slice(0, 5);
  const maintenanceRows = maintenance.filter(item => item.status !== "مكتمل").sort((a, b) => {
    const aDate = String(a.expectedReturn || a.due || "9999-12-31").slice(0, 10);
    const bDate = String(b.expectedReturn || b.due || "9999-12-31").slice(0, 10);
    const aOverdue = aDate < formatCompanyDate(); const bOverdue = bDate < formatCompanyDate();
    return Number(bOverdue) - Number(aOverdue) || aDate.localeCompare(bDate);
  }).slice(0, 3);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Aden", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء الخير";
  return <>
    <PageHeader eyebrow="مركز متابعة الشركة" title={`${greeting}، ${userName || "بك"}`} description={`لوحة تشغيل موحدة · ${formatCompanyDate()} · افتح أي مؤشر للانتقال إلى سجلاته.`} action="إضافة مركبة" onAction={() => onNavigate("vehicles")} />
    {canAccess("vehicles") && <div className="metrics-grid"><button className="metric-card metric-card-link" onClick={() => onNavigate("vehicles")}><span className="metric-icon teal"><CarFront size={19} /></span><span className="metric-content"><span>إجمالي المركبات</span><strong>{totalVehicles.toLocaleString("en-US")}</strong><small>كامل الأسطول المسجل</small></span></button><button className="metric-card metric-card-link" onClick={() => onNavigate("vehicles")}><span className="metric-icon blue"><Activity size={19} /></span><span className="metric-content"><span>تعمل / مؤجرة</span><strong>{workingVehicles.toLocaleString("en-US")}</strong><small>معدل تشغيل {operationRate}٪ من الأسطول</small></span></button><button className="metric-card metric-card-link" onClick={() => onNavigate("vehicles")}><span className="metric-icon violet"><CheckCircle2 size={19} /></span><span className="metric-content"><span>جاهزة للتشغيل</span><strong>{readyVehicles.toLocaleString("en-US")}</strong><small>حالتها متاحة</small></span></button><button className="metric-card metric-card-link" onClick={() => onNavigate("maintenance")}><span className="metric-icon orange"><Wrench size={19} /></span><span className="metric-content"><span>في الصيانة</span><strong>{maintenanceVehicles.toLocaleString("en-US")}</strong><small>طلبات الصيانة المفتوحة</small></span></button><button className="metric-card metric-card-link" onClick={() => onNavigate("vehicles")}><span className="metric-icon orange"><AlertCircle size={19} /></span><span className="metric-content"><span>متوقفة</span><strong>{stoppedVehicles.toLocaleString("en-US")}</strong><small>مركبات تتطلب إجراءً</small></span></button><button className="metric-card metric-card-link" onClick={() => onNavigate("vehicles")}><span className="metric-icon blue"><Gauge size={19} /></span><span className="metric-content"><span>قيد التجهيز</span><strong>{setupVehicles.toLocaleString("en-US")}</strong><small>لم تدخل الخدمة بعد</small></span></button></div>}
    <div className="quick-metrics dashboard-shortcuts">{canAccess("finance") && <button onClick={() => onNavigateFinanceView("claims")}><span>المستحق لنا · مطالبات مفتوحة</span><strong className="green-text">{formatSAR(receivable)}</strong><small>فتح سجل المطالبات</small></button>}{canAccess("payables") && <button onClick={() => onNavigate("payables")}><span>المستحق علينا · فواتير معتمدة</span><strong className="red-text">{formatSAR(payable)}</strong><small>{pendingPayableAmount > 0 ? `${formatSAR(pendingPayableAmount)} بانتظار اعتماد المالية` : "فتح سجل المستحقات"}</small></button>}{canAccess("projects") && <button onClick={() => onNavigate("projects")}><span>المشاريع النشطة</span><strong>{projects.filter(project => project.status === "نشط").length.toLocaleString("en-US")}</strong><small>فتح متابعة المشاريع</small></button>}{canAccess("finance") && <button onClick={() => onNavigateFinanceView("contracts")}><span>العقود القائمة</span><strong>{contracts.filter(contract => contract.status === "قائم").length.toLocaleString("en-US")}</strong><small>فتح سجل العقود</small></button>}</div>
    <div className="dashboard-grid">{canAccess("maintenance") && <section className="surface chart-card"><div className="section-head"><div><h2>مسار الصيانة</h2><span>توزيع الطلبات حسب مراحل التشغيل والفترة</span></div><select className="select-like" aria-label="فترة مخطط الصيانة" value={maintenanceRange} onChange={event => setMaintenanceRange(event.target.value as "month" | "quarter" | "year")}><option value="month">هذا الشهر</option><option value="quarter">هذا الربع</option><option value="year">هذه السنة</option></select></div><Chart maintenance={maintenance} range={maintenanceRange} /></section>}<section className="surface alert-card"><div className="section-head"><div><h2>تحتاج إلى انتباه</h2><span>تنبيهات تتطلب إجراءً منك</span></div><button className="icon-btn" aria-label="عرض مركز التنبيهات" onClick={onOpenNotifications}><Bell size={18} /></button></div><div className="alerts-list">{visibleAlerts.length ? visibleAlerts.map(item => <div className="alert-row" key={item.id} role="button" tabIndex={0} onClick={() => item.onOpen ? item.onOpen() : onNavigate(item.target)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); item.onOpen ? item.onOpen() : onNavigate(item.target); } }}><span className={`alert-icon ${item.severity === "حرج" ? "red" : item.severity === "تنبيه" ? "amber" : "blue"}`}><Bell size={16} /></span><div><strong>{item.title}</strong><small>{item.message}</small></div><ChevronLeft size={15} /></div>) : <div className="empty-state"><strong>لا توجد تنبيهات جديدة</strong><span>ستظهر هنا التنبيهات التشغيلية المهمة.</span></div>}</div><button className="text-link" onClick={onOpenNotifications}>عرض كل التنبيهات <ChevronLeft size={14} /></button></section></div>
    <div className="dashboard-grid lower">{canAccess("maintenance") && <section className="surface mini-table"><div className="section-head"><div><h2>طلبات الصيانة المفتوحة</h2><span>افتح الطلب مباشرة لمراجعة المرحلة والتكلفة والفواتير</span></div><button className="text-link" onClick={() => onNavigate("maintenance")}>عرض الكل <ChevronLeft size={14} /></button></div><div className="compact-list">{maintenanceRows.length ? maintenanceRows.map(item => <button className="compact-row compact-row-button" key={item.id} onClick={() => onMaintenanceOpen(item)}><div className="vehicle-avatar"><Wrench size={16} /></div><div className="compact-main"><strong>{item.vehicle} · {item.ref}</strong><small>{item.type} · {item.workflowStage || item.status}</small></div><Badge>{item.status}</Badge><span className="compact-date">{item.expectedReturn || item.due || "—"}</span></button>) : <div className="empty-state"><strong>لا توجد مركبات تحت الصيانة</strong><span>حالة الأسطول التشغيلية مستقرة.</span></div>}</div></section>}<section className="surface mini-table"><div className="section-head"><div><h2>{canManageTasks ? "مهام الفريق" : "مهامي"}</h2><span>{openTasks.length.toLocaleString("en-US")} مفتوحة · {overdueTasks.length.toLocaleString("en-US")} متأخرة · {todayTasks.length.toLocaleString("en-US")} اليوم · {upcomingTasks.length.toLocaleString("en-US")} قادمة{!canManageTasks ? " · المسندة إلى حسابك" : " · جميع المكلفين"}</span></div>{canManageTasks && <button className="btn outline" onClick={() => { setTaskDraft({ title: "", description: "", dueAt: formatCompanyDate(), assigneeUserId: taskAssignees[0] ? String(taskAssignees[0].id) : "", relatedEntityType: "", relatedEntityId: "" }); setTaskFormOpen(true); }}><Plus size={15} />إضافة مهمة</button>}</div><label className="report-search" style={{ margin: "0 0 .65rem", minHeight: 36 }}><Search size={15} /><input value={taskSearch} onChange={event => { setTaskSearch(event.target.value); setTaskLimit(8); }} placeholder="ابحث في عنوان المهمة أو تفاصيلها…" /></label><div className="task-filters" role="group" aria-label="تصفية مهام التشغيل">{(["الكل", "متأخرة", "اليوم", "قادمة", "مكتملة"] as const).map(filter => { const count = filter === "الكل" ? activeTasks.length : filter === "متأخرة" ? overdueTasks.length : filter === "اليوم" ? todayTasks.length : filter === "قادمة" ? upcomingTasks.length : activeTasks.filter(task => task.status === "مكتملة").length; return <button key={filter} className={taskFilter === filter ? "active" : ""} aria-pressed={taskFilter === filter} onClick={() => { setTaskFilter(filter); setTaskLimit(8); }}>{filter}<span>{count}</span></button>; })}</div><div className="tasks">{filteredTasks.length ? shownTasks.map(task => { const urgency = taskUrgency(task); const linkedTaskRecord = task.relatedEntityType && task.relatedEntityId ? relatedRecords.find(record => record.entityType === task.relatedEntityType && record.id === task.relatedEntityId) : undefined; const canUpdateThisTask = canManageTasks || task.assigneeUserId === viewerUserId || (!task.assigneeUserId && task.assignee === userName); return <div className={`task ${task.status === "مكتملة" ? "done" : ""}`} key={task.id}><input type="checkbox" aria-label={task.status === "مكتملة" ? "إعادة فتح المهمة" : "إكمال المهمة"} checked={task.status === "مكتملة"} disabled={!canUpdateThisTask} onChange={() => onTaskToggle(task)} /><button type="button" className="task-open" onClick={() => setTaskDetail(task)}><strong>{task.title}</strong><small>{task.assignee && task.assignee !== "—" ? `المسؤول: ${task.assignee} · ` : ""}{task.dueAt || "بلا موعد"}{task.relatedEntityType ? ` · ${linkedTaskRecord?.label || `${taskRelatedLabels[task.relatedEntityType]} #${task.relatedEntityId}`}` : ""}</small></button>{urgency === "متأخرة" ? <Badge>متأخرة</Badge> : urgency === "اليوم" ? <Badge>اليوم</Badge> : urgency === "قادمة" ? <Badge>قادمة</Badge> : urgency === "مكتملة" ? <Badge>مكتملة</Badge> : null}</div>; }) : <div className="empty-state"><strong>لا توجد مهام تطابق البحث والفلتر</strong><span>{taskFilter === "الكل" ? canManageTasks ? "أضف مهمة وحدد المسؤول وموعد الإنجاز." : "ستظهر هنا المهام المسندة إلى حسابك." : `لا توجد مهام ${taskFilter.toLocaleLowerCase()} حاليًا.`}</span></div>}</div>{filteredTasks.length > shownTasks.length && <div className="task-list-footer">معروض {shownTasks.length.toLocaleString("en-US")} من {filteredTasks.length.toLocaleString("en-US")} نتيجة · <button type="button" className="text-link" onClick={() => setTaskLimit(limit => limit + 8)}>عرض المزيد</button></div>}{taskFormOpen && <Modal title="إضافة مهمة تشغيلية" onClose={() => setTaskFormOpen(false)}><form onSubmit={event => { event.preventDefault(); if (taskDraft.title.trim().length < 2) { toast.error("اكتب عنوانًا واضحًا للمهمة"); return; } if (!taskDraft.assigneeUserId) { toast.error("اختر حساب الموظف المسؤول عن المهمة"); return; } onTaskCreate({ ...taskDraft, title: taskDraft.title.trim(), description: taskDraft.description.trim(), assigneeUserId: Number(taskDraft.assigneeUserId), relatedEntityType: taskDraft.relatedEntityType || null, relatedEntityId: taskDraft.relatedEntityId ? Number(taskDraft.relatedEntityId) : null }); setTaskFormOpen(false); }}><div className="form-grid single"><Field label="عنوان المهمة *" value={taskDraft.title} onChange={value => setTaskDraft(current => ({ ...current, title: value }))} placeholder="مثال: متابعة تجهيز المركبة" /><label className="field"><span>الموظف المسؤول *</span><select required value={taskDraft.assigneeUserId} onChange={event => setTaskDraft(current => ({ ...current, assigneeUserId: event.target.value }))}><option value="">اختر حسابًا نشطًا</option>{taskAssignees.filter(item => item.name?.trim()).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{taskAssignees.length === 0 && <small>لا توجد حسابات نشطة يمكن إسناد المهمة إليها.</small>}</label><Field label="موعد الإنجاز *" value={taskDraft.dueAt} onChange={value => setTaskDraft(current => ({ ...current, dueAt: value }))} type="date" /><Field label="تفاصيل المهمة" value={taskDraft.description} onChange={value => setTaskDraft(current => ({ ...current, description: value }))} /><label className="field"><span>ربط بسجل (اختياري)</span><select value={taskDraft.relatedEntityType} onChange={event => { setTaskRelatedSearch(""); setTaskDraft(current => ({ ...current, relatedEntityType: event.target.value as TaskRelatedEntityType | "", relatedEntityId: "" })); }}><option value="">بدون ربط</option>{availableTaskRelatedTypes.map(type => <option key={type} value={type}>{taskRelatedLabels[type]}</option>)}</select></label>{selectedTaskRelatedType && <><label className="field"><span>ابحث عن {taskRelatedLabels[selectedTaskRelatedType]}</span><input value={taskRelatedSearch} onChange={event => { setTaskRelatedSearch(event.target.value); setTaskDraft(current => ({ ...current, relatedEntityId: "" })); }} placeholder="اكتب الاسم أو الرقم للعثور على السجل" /></label><label className="field"><span>السجل المرتبط · {selectedTaskRelatedRecords.length.toLocaleString("en-US")} نتيجة</span><select required value={taskDraft.relatedEntityId} onChange={event => setTaskDraft(current => ({ ...current, relatedEntityId: event.target.value }))}><option value="">اختر {taskRelatedLabels[selectedTaskRelatedType]}</option>{selectedTaskRelatedRecords.slice(0, 100).map(record => <option key={record.id} value={record.id}>{record.label}</option>)}</select>{taskRelatedRecordCount === 0 ? <small>لا توجد سجلات متاحة في هذه الوحدة للربط.</small> : selectedTaskRelatedRecords.length === 0 ? <small>لا توجد نتائج مطابقة؛ جرّب كلمات بحث أخرى.</small> : selectedTaskRelatedRecords.length > 100 && <small>يعرض أول 100 نتيجة؛ أضف كلمات للبحث لتحديد السجل بسرعة.</small>}</label></>}</div><FormActions onCancel={() => setTaskFormOpen(false)} label="حفظ المهمة" /></form></Modal>}</section></div>
    {taskDetail && <Modal title="تفاصيل المهمة" onClose={() => setTaskDetail(null)}><div className="driver-summary"><span className="avatar"><CheckCircle2 size={20} /></span><div><strong>{taskDetail.title}</strong><span>المسؤول: {taskDetail.assignee || "غير محدد"} · موعد الإنجاز: {taskDetail.dueAt || "غير محدد"}</span><Badge>{taskUrgency(taskDetail)}</Badge></div></div><section className="surface" style={{ marginTop: "1rem", padding: "1rem" }}><strong>تفاصيل العمل</strong><p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{taskDetail.description?.trim() || "لا توجد تفاصيل إضافية لهذه المهمة."}</p>{taskDetail.relatedEntityType && <div className="field-note" style={{ marginTop: ".7rem" }}>السجل المرتبط: {taskDetailRelatedRecord?.label || `${taskRelatedLabels[taskDetail.relatedEntityType]} #${taskDetail.relatedEntityId}`}</div>}</section><div className="form-actions" style={{ marginTop: "1rem" }}><button type="button" className="btn outline" onClick={() => setTaskDetail(null)}>إغلاق</button>{taskDetailRelatedRecord && <button type="button" className="btn outline" onClick={() => { setTaskDetail(null); onTaskOpenRelated(taskDetail); }}>فتح السجل المرتبط</button>}{taskDetail.status !== "ملغاة" && (canManageTasks || taskDetail.assigneeUserId === viewerUserId || (!taskDetail.assigneeUserId && taskDetail.assignee === userName)) && <button type="button" className="btn primary" onClick={() => { onTaskToggle(taskDetail); setTaskDetail(null); }}>{taskDetail.status === "مكتملة" ? "إعادة فتح المهمة" : "إكمال المهمة"}</button>}</div></Modal>}
  </>;
}

function VehicleProfileModal({ vehicle, canAccess, maintenance, documents, onClose }: { vehicle: Vehicle; canAccess: (key: ModuleKey) => boolean; maintenance: Maintenance[]; documents: Document[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const documentsQuery = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canAccess("documents") });
  const profileQuery = trpc.vehicles.financeProfile.useQuery({ vehicleId: vehicle.id }, { enabled: canAccess("finance") });
  const expenseCreate = trpc.vehicles.expenseCreate.useMutation();
  const expenseUpdate = trpc.vehicles.expenseUpdate.useMutation();
  const expenseArchive = trpc.vehicles.expenseArchive.useMutation();
  const revenueCreate = trpc.vehicleRevenues.create.useMutation();
  const revenueArchive = trpc.vehicleRevenues.archive.useMutation();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedExpenseGroup, setExpandedExpenseGroup] = useState<string | null>(null);
  const blankExpense = () => ({ category: "أخرى", amount: "", spentAt: formatCompanyDate(), description: "", vendor: "", notes: "", receiptName: "", receiptUrl: "" });
  const [expense, setExpense] = useState(blankExpense);
  const [revenue, setRevenue] = useState({ paymentId: "", amount: "", receiptName: "", receiptUrl: "", notes: "" });
  const data = profileQuery.data as any;
  const expenseSummaryRows = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; total: number; expenses: any[] }>();
    for (const expense of (data?.expenses ?? []) as any[]) {
      const amount = Number(expense.amount || 0);
      if (amount <= 0) continue;
      const maintenanceItem = String(expense.maintenanceItem || "").trim();
      const category = String(expense.category || "أخرى");
      const key = maintenanceItem ? `maintenance:${maintenanceItem}` : `category:${category}`;
      const label = maintenanceItem || (category === "صيانة" ? "صيانة أخرى" : category);
      const group = groups.get(key) ?? { key, label, total: 0, expenses: [] };
      group.total += amount;
      group.expenses.push(expense);
      groups.set(key, group);
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "ar"));
  }, [data?.expenses]);
  const linkedMaintenance = maintenance.filter(item => item.vehicleId === vehicle.id || item.vehicle === vehicle.plate);
  const linkedDocuments = ((documentsQuery.data as Document[] | undefined) ?? documents).filter(item => isLinkedDocument(item, "مركبة", vehicle.id));
  const updateExpenseField = (key: string, value: string) => setExpense(current => ({ ...current, [key]: value }));
  const readReceipt = (file?: File) => {
    if (!file) return;
    void readUploadDataUrl(file).then(receiptUrl => { updateExpenseField("receiptUrl", receiptUrl); updateExpenseField("receiptName", file.name); }).catch(error => toast.error(error.message));
  };
  const saveExpense = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(expense.amount);
    if (!Number.isInteger(amount) || amount <= 0 || !expense.description.trim() || !expense.spentAt) { toast.error("أدخل المبلغ والتاريخ والسبب بصورة صحيحة"); return; }
    const payload = { vehicleId: vehicle.id, category: expense.category as any, amount, spentAt: expense.spentAt, description: expense.description.trim(), vendor: expense.vendor || "—", notes: expense.notes || undefined, receiptName: expense.receiptName || undefined, receiptUrl: expense.receiptUrl || undefined };
    const onSuccess = () => { utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id }); utils.vehicles.list.invalidate(); setExpenseOpen(false); setEditingId(null); setExpense(blankExpense()); toast.success("تم حفظ مصروف الباص"); };
    if (editingId) expenseUpdate.mutate({ id: editingId, data: payload }, { onSuccess, onError: error => toast.error(error.message) });
    else expenseCreate.mutate(payload, { onSuccess, onError: error => toast.error(error.message) });
  };
  const saveRevenue = (event: React.FormEvent) => {
    event.preventDefault();
    const paymentId = Number(revenue.paymentId); const amount = Number(revenue.amount);
    if (!paymentId || !Number.isInteger(amount) || amount <= 0) { toast.error("اختر دفعة وأدخل مبلغًا صحيحًا"); return; }
    revenueCreate.mutate({ vehicleId: vehicle.id, paymentId, amount, receiptName: revenue.receiptName || undefined, receiptUrl: revenue.receiptUrl || undefined, notes: revenue.notes || undefined }, { onSuccess: () => { utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id }); utils.vehicles.list.invalidate(); setRevenueOpen(false); setRevenue({ paymentId: "", amount: "", receiptName: "", receiptUrl: "", notes: "" }); toast.success("تم تخصيص الإيراد للباص"); }, onError: error => toast.error(error.message) });
  };
  const startEditExpense = (row: any) => { setEditingId(row.id); setExpense({ category: row.category, amount: String(row.amount), spentAt: row.spentAt, description: row.description, vendor: row.vendor || "", notes: row.notes || "", receiptName: row.receiptName || "", receiptUrl: row.receiptUrl || "" }); setExpenseOpen(true); };
  const openAttachment = (name: string, url?: string | null) => { if (!url) return; const link = document.createElement("a"); link.href = url; link.download = name || "receipt"; link.target = "_blank"; link.click(); };
  const openLedgerAttachment = async (kind: "expense" | "revenue" | "maintenance", recordId: number, name: string) => { try { const attachment = await utils.vehicles.receipt.fetch({ vehicleId: vehicle.id, kind, recordId }); if (!attachment?.url) { toast.error("لم يتم العثور على المرفق"); return; } openAttachment(name || attachment.name, attachment.url); } catch (error: any) { toast.error(error.message || "تعذر فتح المرفق"); } };
  return <Modal title={`ملف الباص · ${vehicle.plate}`} onClose={onClose} wide>
    <div className="driver-summary"><span className="avatar"><CarFront size={20} /></span><div><strong>{vehicle.plate} · {vehicle.brand} {vehicle.model} {vehicle.year}</strong><span>{vehicle.status} · {vehicle.mileage} · المشروع {vehicle.project || "—"} · العميل {vehicle.client || "—"}</span><Badge>{vehicle.driver && vehicle.driver !== "—" ? `السائق ${vehicle.driver}` : "بدون سائق مسجل"}</Badge></div></div>
    <div className="quick-metrics"><div><span>الموظف المسؤول</span><strong>{vehicle.employee || "—"}</strong></div><div><span>العقد المرتبط</span><strong>{vehicle.contract || "—"}</strong></div><div><span>دخول الخدمة</span><strong>{vehicle.inServiceDate && vehicle.inServiceDate !== "—" ? vehicle.inServiceDate : "غير مسجل"}</strong></div><div><span>تاريخ الشراء</span><strong>{vehicle.purchaseDate && vehicle.purchaseDate !== "—" ? vehicle.purchaseDate : "غير مسجل"}</strong></div></div>
    <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>السجل التشغيلي</h3><span>الصيانة والمستندات المسجلة لهذا الباص</span></div></div>{canAccess("maintenance") && <div className="compact-list">{linkedMaintenance.length ? linkedMaintenance.map(item => { const actual = Number(String(item.cost || "").replace(/[^0-9]/g, "")) || 0; const estimate = (Number(item.estimatedCost) || 0) + (Number(item.quotedPartsCost) || 0); const displayedCost = actual > 0 ? actual : estimate; return <div className="compact-row" key={item.id}><span className="vehicle-avatar"><Wrench size={16} /></span><div className="compact-main"><strong>{item.type} · {item.start}</strong><small>{item.reason || "بدون سبب مدخل"} · {item.workDone || "لم يسجل العمل المنجز"}{item.parts ? ` · قطع: ${item.parts}` : ""}</small></div><Badge>{item.status}</Badge><div className="compact-main" style={{ textAlign: "left" }}><strong>{formatSAR(displayedCost)}</strong><small>{actual > 0 ? "فعلي حسب الفواتير" : estimate > 0 ? "تقديري حسب العرض" : "لم تسجل التكلفة"}</small></div>{item.receiptName && <button className="btn outline" onClick={() => openLedgerAttachment("maintenance", item.id, String(item.receiptName || "فاتورة صيانة"))}>الفاتورة</button>}</div>;}) : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد أوامر صيانة مرتبطة.</div>}</div>}{canAccess("documents") && <div className="compact-list" style={{ marginTop: ".6rem" }}>{linkedDocuments.length ? linkedDocuments.map(item => <div className="compact-row" key={`doc-${item.id}`}><div className="compact-main"><strong>{item.name}</strong><small>{item.type} · انتهاء {item.expiry}</small></div><Badge>{item.status}</Badge><DocumentFileActions file={item} /></div>) : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد مستندات مرتبطة.</div>}</div>}</section>
    {!canAccess("documents") && <div className="field-note" role="status" style={{ marginTop: ".5rem" }}>المستندات المرتبطة مخفية؛ يلزم منح صلاحية «المستندات» لعرضها.</div>}
    {!canAccess("finance") ? <div className="empty-state" style={{ marginTop: "1rem" }}>لرؤية بيانات التكلفة والإيرادات يلزم منح صلاحية «المالية» بالإضافة إلى «المركبات».</div> : profileQuery.isLoading ? <div className="empty-state" style={{ marginTop: "1rem" }}>جارٍ تحميل الملف المالي…</div> : profileQuery.error ? <div className="empty-state" style={{ marginTop: "1rem" }}>{profileQuery.error.message}</div> : data && <>
      <div className="metrics-grid finance-metrics" style={{ marginTop: "1rem" }}><MetricCard title="قيمة الشراء" value={formatSAR(data.purchasePrice)} helper={data.vehicle.purchaseDate || "تاريخ الشراء غير مسجل"} icon={CarFront} tone="blue" /><MetricCard title="مصروفات التشغيل" value={formatSAR(data.expenseTotal)} helper="من سجل المصروفات حتى الآن" icon={Wrench} tone="orange" /><MetricCard title="الإيراد المحصل المخصص" value={formatSAR(data.revenueTotal)} helper="من دفعات مسجلة وموزعة على هذا الباص" icon={CircleDollarSign} tone="teal" /><MetricCard title="صافي النقد قبل الإهلاك" value={formatSAR(data.netCashReturn)} helper="الإيراد المحصل − الشراء − التشغيل" icon={Activity} tone={data.netCashReturn >= 0 ? "teal" : "orange"} /></div>
      <div className="quick-metrics"><div><span>إجمالي مصروفات التشغيل</span><strong>{formatSAR(data.expenseTotal)}</strong></div><div><span>إجمالي الصيانة المسجلة</span><strong>{formatSAR(data.categoryTotals["صيانة"] || 0)}</strong></div><div><span>عدد عمليات الصرف</span><strong>{data.expenses.length.toLocaleString("en-US")}</strong></div><div><span>المشروع/العميل وقت التخصيص</span><strong>{data.project || "—"} / {data.client || "—"}</strong></div></div>
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>مصروفات الباص</h3><span>إجمالي مدى الحياة؛ أوامر الصيانة وفواتير المورد المرتبطة بالباص تُزامن تلقائيًا</span></div><div style={{ display: "flex", gap: ".5rem" }}><button className="btn outline" onClick={() => { setEditingId(null); setExpense(blankExpense()); setExpenseOpen(!expenseOpen); setRevenueOpen(false); }}><Plus size={15} />تسجيل مصروف</button><button className="btn primary" onClick={() => { setRevenueOpen(!revenueOpen); setExpenseOpen(false); }}><Plus size={15} />تخصيص إيراد محصل</button></div></div>
        <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
          <div className="section-head"><div><h3>إجماليات المصروفات</h3><span>يُجمع كل بند مع عملياته؛ اضغط «إظهار التفاصيل» بجانب الإجمالي لعرض السجل</span></div></div>
          {expenseSummaryRows.length ? <div className="table-scroll"><table><thead><tr><th>البند</th><th>عدد العمليات</th><th>إجمالي التكلفة والتفاصيل</th></tr></thead><tbody>
            {expenseSummaryRows.map((group: any) => {
              const expanded = expandedExpenseGroup === group.key;
              return <Fragment key={group.key}>
                <tr>
                  <td>{group.label}</td>
                  <td>{group.expenses.length.toLocaleString("en-US")}</td>
                  <td><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap" }}><strong>{formatSAR(group.total)}</strong><button type="button" className="btn outline" aria-expanded={expanded} onClick={() => setExpandedExpenseGroup(expanded ? null : group.key)}>{expanded ? "إخفاء التفاصيل" : "إظهار التفاصيل"} <ChevronDown size={14} /></button></div></td>
                </tr>
                {expanded && <tr><td colSpan={3} style={{ padding: ".6rem", background: "var(--muted)" }}>
                  <div style={{ display: "grid", gap: ".6rem" }}>
                    {group.expenses.map((operation: any) => {
                      const synchronized = Boolean(operation.maintenanceRequestId || operation.payableId);
                      return <div className="surface" key={operation.id} style={{ padding: ".75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap", marginBottom: ".5rem" }}><strong>{operation.spentAt} · {formatSAR(operation.amount)}</strong><small>{operation.maintenanceItem || operation.category}</small></div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: ".6rem" }}>
                          <div><small>السبب / البيان</small><strong style={{ display: "block" }}>{operation.description || "—"}</strong></div>
                          <div><small>المورد / الورشة</small><strong style={{ display: "block" }}>{operation.vendor || "—"}</strong></div>
                          <div><small>أُدخل بواسطة</small><strong style={{ display: "block" }}>{operation.createdByName || "—"}</strong></div>
                          <div><small>ملاحظات</small><strong style={{ display: "block" }}>{operation.notes || "—"}</strong></div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", marginTop: ".6rem" }}>
                          <small>{operation.maintenanceRequestId ? "مزامن من أمر الصيانة" : operation.payableId ? `مزامن من فاتورة المورد #${operation.payableId}` : "مصروف مسجل يدويًا"}</small>
                          {operation.hasReceipt && <button type="button" className="btn outline" onClick={() => openLedgerAttachment("expense", operation.id, operation.receiptName || "فاتورة")}>فتح المرفق</button>}
                          {!synchronized && <>
                            <button type="button" className="btn outline" onClick={() => startEditExpense(operation)}><Pencil size={14} /> تعديل</button>
                            <button type="button" className="btn outline" onClick={() => toast("أرشفة عملية الصرف؟", { action: { label: "تأكيد", onClick: () => expenseArchive.mutate({ id: operation.id }, { onSuccess: () => { utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id }); utils.vehicles.list.invalidate(); toast.success("تمت أرشفة المصروف"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })}><Archive size={14} /> أرشفة</button>
                          </>}
                        </div>
                      </div>;
                    })}
                  </div>
                </td></tr>}
              </Fragment>;
            })}
          </tbody></table></div> : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد مصروفات مسجلة لهذا الباص.</div>}
        </section>
        {expenseOpen && <form className="surface" style={{ padding: "1rem", margin: "1rem 0" }} onSubmit={saveExpense}><div className="section-head"><h3>{editingId ? "تعديل عملية صرف" : "إضافة عملية صرف"}</h3><button type="button" className="btn ghost" onClick={() => { setExpenseOpen(false); setEditingId(null); }}>إلغاء</button></div><div className="form-grid"><label className="field"><span>بند الصرف</span><select value={expense.category} onChange={e => updateExpenseField("category", e.target.value)}>{["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"].map(item => <option key={item}>{item}</option>)}</select></label><label className="field"><span>المبلغ (SAR)</span><input type="number" min="1" step="1" required value={expense.amount} onChange={e => updateExpenseField("amount", e.target.value)} /></label><label className="field"><span>تاريخ الصرف</span><input type="date" required value={expense.spentAt} onChange={e => updateExpenseField("spentAt", e.target.value)} /></label><label className="field"><span>المورد / الورشة</span><input value={expense.vendor} onChange={e => updateExpenseField("vendor", e.target.value)} /></label><label className="field"><span>السبب / البيان</span><input required value={expense.description} onChange={e => updateExpenseField("description", e.target.value)} maxLength={300} /></label><label className="field"><span>ملاحظات</span><input value={expense.notes} onChange={e => updateExpenseField("notes", e.target.value)} /></label><label className="field"><span>الفاتورة أو صورة المستند (حد 700 ك.ب)</span><input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={e => readReceipt(e.target.files?.[0])} />{expense.receiptName && <small>{expense.receiptName}</small>}</label></div><div className="detail-footer"><button className="btn primary" disabled={expenseCreate.isPending || expenseUpdate.isPending}>حفظ المصروف</button></div></form>}
        {revenueOpen && <form className="surface" style={{ padding: "1rem", margin: "1rem 0" }} onSubmit={saveRevenue}><div className="section-head"><div><h3>تخصيص إيراد محصل للباص</h3><span>لا يُحسب إيراد العقد كاملًا؛ اختر دفعة مستلمة ووزّع مبلغها، ولن يسمح النظام بتجاوز قيمتها أو تخصيصها لعقد لا يرتبط بالباص.</span></div><button type="button" className="btn ghost" onClick={() => setRevenueOpen(false)}>إلغاء</button></div><div className="form-grid"><label className="field"><span>الدفعة المستلمة</span><select required value={revenue.paymentId} onChange={e => { const item = data.allocatablePayments.find((payment: any) => String(payment.id) === e.target.value); setRevenue(current => ({ ...current, paymentId: e.target.value, amount: item ? String(item.remaining) : current.amount })); }}><option value="">اختر دفعة مرتبطة بعقد هذا الباص</option>{data.allocatablePayments.map((payment: any) => <option key={payment.id} value={payment.id}>{payment.paidAt} · {payment.contractRef} · {payment.client} · متبقٍ للتوزيع {formatSAR(payment.remaining)}</option>)}</select></label><label className="field"><span>المبلغ المخصص (SAR)</span><input type="number" min="1" step="1" required value={revenue.amount} onChange={e => setRevenue(current => ({ ...current, amount: e.target.value }))} /></label><label className="field"><span>إيصال/مستند اختياري (حد 700 ك.ب)</span><input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={e => { const file=e.target.files?.[0]; if(!file)return; void readUploadDataUrl(file).then(receiptUrl=>setRevenue(current=>({...current,receiptName:file.name,receiptUrl}))).catch(error=>toast.error(error.message)); }} />{revenue.receiptName && <small>{revenue.receiptName}</small>}</label><label className="field"><span>ملاحظات</span><input value={revenue.notes} onChange={e => setRevenue(current => ({ ...current, notes: e.target.value }))} /></label></div>{!data.allocatablePayments.length && <div className="empty-state" style={{ padding: "1rem" }}>لا توجد دفعات غير موزعة مرتبطة بعقد هذا الباص.</div>}<div className="detail-footer"><button className="btn primary" disabled={!data.allocatablePayments.length || revenueCreate.isPending}>حفظ تخصيص الإيراد</button></div></form>}
      </section>
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>الإيرادات المحصلة المخصصة لهذا الباص</h3><span>سجل زمني لمبالغ من دفعات مالية موثقة؛ لا يعرض قيمة العقود كإيراد محصل.</span></div></div>{data.revenues.length ? <div className="table-scroll"><table><thead><tr><th>تاريخ التحصيل</th><th>العقد / العميل</th><th>مرجع الدفعة</th><th>المبلغ المخصص</th><th>أُدخل بواسطة</th><th>الإيصال</th><th>إجراء</th></tr></thead><tbody>{data.revenues.map((item: any) => <tr key={item.id}><td>{item.paidAt}</td><td>{item.contractRef}<small>{item.client}</small></td><td>{item.reference}</td><td><strong>{formatSAR(item.amount)}</strong></td><td>{item.createdByName}</td><td>{item.hasReceipt ? <button className="btn outline" onClick={() => openLedgerAttachment("revenue", item.id, item.receiptName || "إيصال")}>فتح المرفق</button> : "—"}</td><td>{item.autoLinked ? <small className="field-note">مرتبط تلقائيًا بالعقد</small> : <button className="row-menu-btn danger" title="إلغاء التخصيص" onClick={() => toast("إلغاء تخصيص هذا الجزء من الدفعة؟ سيصبح متاحًا لإعادة التوزيع.", { action: { label: "تأكيد", onClick: () => revenueArchive.mutate({ id: item.id }, { onSuccess: () => { utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id }); utils.vehicles.list.invalidate(); toast.success("تم إلغاء تخصيص الإيراد"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })}><Archive size={15} /></button>}</td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ padding: "1.5rem" }}>لا توجد إيرادات مخصصة بعد. الإيراد لا يظهر هنا حتى يسجل كدفعة ويخصص لهذا الباص.</div>}</section>
      <p className="field-note">صافي النقد المعروض = الإيراد المحصل المخصص − قيمة الشراء − مصروفات التشغيل المسجلة. لا يمثل ربحًا محاسبيًا بعد الإهلاك أو التمويل أو الضرائب، وقد يختلف عن الربح المستحق إذا لم تُسجل الإيرادات أو المصروفات.</p>
    </>}
    <div className="detail-footer"><button className="btn primary" onClick={onClose}>إغلاق الملف</button></div>
  </Modal>;
}

function VehiclesPage({ vehicles, setVehicles, onOpenForm, onAction, canAccess }: { vehicles: Vehicle[]; setVehicles: (v: Vehicle[]) => void; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void; canAccess: (key: ModuleKey) => boolean }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = vehicles.filter(v => matchesQuickSearch(v, search) && (tab === "الكل" || (tab === "متاح" && v.status === "متاحة") || (tab === "في الصيانة" && v.status === "في الصيانة") || (tab === "مؤجر / مشغول" && ["مؤجرة", "مشغولة"].includes(v.status)) || (tab === "قيد التجهيز" && v.status === "قيد التجهيز") || (tab === "متوقفة" && v.status === "متوقفة")));
  const topSpender = [...vehicles].sort((a, b) => Number(b.expenseTotal || 0) - Number(a.expenseTotal || 0))[0];
  return <><PageHeader eyebrow="التشغيل / إدارة الأسطول" title="المركبات" description="افتح قائمة الإجراءات ثم «عرض التفاصيل» لملف الباص المالي والتشغيلي." action="إضافة مركبة" onAction={() => onOpenForm()} /><div className="quick-metrics"><div><span>كل المركبات</span><strong>{vehicles.length.toLocaleString("en-US")}</strong></div><div><span>متاحة</span><strong className="green-text">{vehicles.filter(v => v.status === "متاحة").length.toLocaleString("en-US")}</strong></div><div><span>في الصيانة</span><strong className="red-text">{vehicles.filter(v => v.status === "في الصيانة").length.toLocaleString("en-US")}</strong></div><div><span>مؤجرة / مشغولة</span><strong className="blue-text">{vehicles.filter(v => ["مؤجرة", "مشغولة"].includes(v.status)).length.toLocaleString("en-US")}</strong></div>{canAccess("finance") && <><div><span>مصروفات التشغيل للأسطول</span><strong>{formatSAR(vehicles.reduce((total, vehicle) => total + Number(vehicle.expenseTotal || 0), 0))}</strong></div><div><span>الأعلى مصروفًا</span><strong>{topSpender ? `${topSpender.plate} · ${formatSAR(Number(topSpender.expenseTotal || 0))}` : "—"}</strong></div></>}</div><TableShell columns={["رقم اللوحة", "المركبة", "السنة", "المسافة", "السائق", "الموظف المسؤول", "الحالة", "العميل", ...(canAccess("finance") ? ["مصروف التشغيل", "إيراد محصل"] : [])]} onExport={() => exportCsv(filtered, ["plate", "brand", "model", "year", "mileage", "driver", "employee", "status", "client", ...(canAccess("finance") ? ["purchasePrice", "expenseTotal", "revenueTotal", "netOperatingReturn"] : [])], "vehicles")} search={search} setSearch={setSearch} tabs={["الكل", "متاح", "في الصيانة", "مؤجر / مشغول", "قيد التجهيز", "متوقفة"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة مركبة" onAdd={() => onOpenForm()}>{filtered.map(v => <tr key={v.id}><td><strong className="table-primary">{v.plate}</strong><small>{v.brand}</small></td><td>{v.model}<small>{v.color}</small></td><td>{v.year}</td><td>{v.mileage}</td><td>{v.driver}</td><td>{v.employee || "—"}</td><td><Badge>{v.status}</Badge></td><td>{v.client}<small>{v.contract}</small></td>{canAccess("finance") && <><td>{formatSAR(Number(v.expenseTotal || 0))}</td><td>{formatSAR(Number(v.revenueTotal || 0))}</td></>}<td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === v.id ? null : v.id)}><MoreHorizontal size={18} /></button>{menu === v.id && <ContextMenu row={v} module="vehicles" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, v); }} />}</td></tr>)}</TableShell></>;
}

function MaintenancePage({ maintenance, onOpenForm, onAction, canApprove, canRecordInvoice, onRegisterInvoice }: { maintenance: Maintenance[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void; canApprove: boolean; canRecordInvoice: boolean; onRegisterInvoice: (request: Maintenance) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = maintenance.filter(m => matchesQuickSearch(m, search) && (tab === "الكل" || (tab === "مكتمل" && m.status === "مكتمل") || (tab === "جاري العمل" && m.status !== "مكتمل")));
  const isOpen = (item: Maintenance) => !["مغلق", "مرفوض"].includes(String(item.workflowStage || ""));
  const overdue = maintenance.filter(item => { const value = String(item.expectedReturn && item.expectedReturn !== "—" ? item.expectedReturn : item.due || "").slice(0, 10); return isOpen(item) && /^\d{4}-\d{2}-\d{2}$/.test(value) && value < formatCompanyDate(); });
  const month = formatCompanyDate().slice(0, 7);
  const actualCost = (item: Maintenance) => Number(String(item.cost || "").replace(/[^0-9]/g, "")) || 0;
  const monthlyCost = maintenance.filter(item => String(item.start || "").startsWith(month)).reduce((sum, item) => sum + actualCost(item), 0);
  const topVehicleCosts = Array.from(maintenance.reduce((totals, item) => totals.set(item.vehicle, (totals.get(item.vehicle) || 0) + actualCost(item)), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <><PageHeader eyebrow="التشغيل / الورش" title="حوكمة الصيانة" description="تابع البلاغات والأولويات والاعتمادات والتنفيذ وسجل المركبات." action="طلب صيانة جديد" onAction={() => onOpenForm()} /><div className="stats-banner"><div><Wrench size={17} /><span>طلبات مفتوحة</span><strong>{maintenance.filter(isOpen).length.toLocaleString("en-US")}</strong></div><div><Clock3 size={17} /><span>متأخرة</span><strong className="red-text">{overdue.length.toLocaleString("en-US")}</strong></div><div><AlertCircle size={17} /><span>طارئة / عاجلة</span><strong className="red-text">{maintenance.filter(item => isOpen(item) && ["طارئ", "عاجل"].includes(String(item.priority))).length.toLocaleString("en-US")}</strong></div><div><CheckCircle2 size={17} /><span>بانتظار الاعتماد</span><strong>{maintenance.filter(item => item.approvalStatus === "بانتظار الاعتماد").length.toLocaleString("en-US")}</strong></div>{canApprove && <><div><CircleDollarSign size={17} /><span>تكلفة الشهر</span><strong>{formatSAR(monthlyCost)}</strong></div><div><CalendarDays size={17} /><span>إجمالي الطلبات</span><strong>{maintenance.length.toLocaleString("en-US")}</strong></div></>}</div>{canApprove && topVehicleCosts.length > 0 && <div className="quick-metrics">{topVehicleCosts.map(([vehicle, amount]) => <div key={vehicle}><span>تكلفة مركبة · {vehicle}</span><strong>{formatSAR(amount)}</strong></div>)}</div>}<TableShell columns={["الطلب", "المركبة", "الأولوية", "مرحلة العمل", "نوع الصيانة", "سبب البلاغ", "مسؤول الصيانة", "العودة المتوقعة", "الحالة", "التقديرية / الفعلية"]} onExport={() => exportCsv(filtered, ["ref", "vehicle", "priority", "workflowStage", "type", "reason", "manager", "expectedReturn", "status", "estimatedCost", "quotedPartsCost", "cost"], "maintenance")} search={search} setSearch={setSearch} tabs={["الكل", "مكتمل", "جاري العمل"]} activeTab={tab} setActiveTab={setTab} addLabel="طلب صيانة جديد" onAdd={() => onOpenForm()}>{filtered.map(m => { const stage = (m.workflowStage || "بلاغ") as MaintenanceStage; const canProgress = nextMaintenanceStages(stage).length > 0; const canReview = canApprove && stage === "اعتماد" && m.approvalStatus === "بانتظار الاعتماد"; const canInvoice = canRecordInvoice && Boolean(m.vehicleId) && m.approvalStatus === "معتمد" && ["تنفيذ", "فحص بعد الإصلاح"].includes(stage); const quoteTotal = Number(m.estimatedCost || 0) + Number(m.quotedPartsCost || 0); const currentCost = actualCost(m); const shownCost = currentCost > 0 ? currentCost : quoteTotal; const hasCost = ["تقدير تكلفة", "اعتماد", "مرفوض", "تنفيذ", "فحص بعد الإصلاح", "مغلق"].includes(stage) && shownCost > 0; return <tr key={m.id}><td><strong className="table-primary">{m.ref}</strong><small>{m.reportedBy || "—"} · {m.start}</small></td><td>{m.vehicle}</td><td><Badge>{m.priority || "متوسط"}</Badge></td><td><Badge>{stage}</Badge>{m.approvalStatus === "بانتظار الاعتماد" && <small>بانتظار اعتماد المالية</small>}</td><td>{m.type}</td><td>{m.reason || "—"}</td><td>{m.technician && m.technician !== "—" ? m.technician : m.manager}</td><td>{m.expectedReturn || m.due}</td><td><Badge>{m.status}</Badge></td><td>{hasCost ? <>{formatSAR(shownCost)}<small>{currentCost > 0 ? "فعلي حسب الفواتير" : "تقديري حسب العرض"}</small></> : "—"}</td><td className="actions-cell">{canReview ? <button className="btn outline" onClick={() => onAction("approval", m)}>مراجعة الاعتماد</button> : canProgress ? <button className="btn outline" onClick={() => onAction("stage", m)}>{nextMaintenanceStages(stage).includes("اعتماد") ? "إرسال للمالية" : "إجراء المرحلة"}</button> : null}{canInvoice && <button className="btn primary" onClick={() => onRegisterInvoice(m)}>تسجيل فاتورة</button>}<button className="row-menu-btn" title="المزيد من الإجراءات" onClick={() => setMenu(menu === m.id ? null : m.id)}><MoreHorizontal size={18} /></button>{menu === m.id && <ContextMenu row={m} module="maintenance" canApprove={canApprove} onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, m); }} />}</td></tr>;})}</TableShell></>;
}

function DriverVehiclesModal({ driver, vehicles, documents, canViewDocuments, onClose }: { driver: Driver; vehicles: Vehicle[]; documents: Document[]; canViewDocuments: boolean; onClose: () => void }) {
  const documentsQuery = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canViewDocuments });
  const linkedVehicles = vehicles.filter(vehicle => vehicle.driverId === driver.id || vehicle.driver === driver.name || (driver.vehicle !== "—" && vehicle.plate === driver.vehicle));
  const linkedDocuments = canViewDocuments ? ((documentsQuery.data as Document[] | undefined) ?? documents).filter(doc => isLinkedDocument(doc, "سائق", driver.id)) : [];
  return <Modal title={`ملف السائق · ${driver.name}`} onClose={onClose} wide><div className="driver-summary"><span className="avatar">{driver.name.slice(0, 1)}</span><div><strong>{driver.name}</strong><span>{driver.phone} · {driver.license}</span><Badge>{driver.status}</Badge></div></div><div className="linked-vehicles-head"><div><h3>المركبات المرتبطة</h3><span>{linkedVehicles.length ? `لديه ${linkedVehicles.length} مركبة مرتبطة حاليًا` : "لا توجد مركبات مرتبطة بهذا السائق"}</span></div><CarFront size={20} /></div>{linkedVehicles.length ? <div className="linked-vehicles-list">{linkedVehicles.map(vehicle => <div className="linked-vehicle" key={vehicle.id}><span className="vehicle-avatar"><CarFront size={17} /></span><div><strong>{vehicle.plate}</strong><span>{vehicle.brand} · {vehicle.model}</span></div><div className="linked-vehicle-meta"><Badge>{vehicle.status}</Badge><small>{vehicle.client !== "—" ? vehicle.client : "بدون عميل"}</small><small>{vehicle.contract !== "—" ? vehicle.contract : "بدون عقد"}</small></div></div>)}</div> : <div className="empty-state"><CarFront size={24} /><strong>لا توجد مركبة مرتبطة</strong><span>يمكن إسناد مركبة من قائمة إجراءات السائق.</span></div>}<section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>المستندات المرتبطة</h3><span>{linkedDocuments.length} مستند</span></div></div>{linkedDocuments.length ? <div className="compact-list">{linkedDocuments.map(doc => <div className="compact-row" key={doc.id}><div className="compact-main"><strong>{doc.name}</strong><small>{doc.type} · ينتهي {doc.expiry}</small></div><Badge>{doc.status}</Badge><DocumentFileActions file={doc} /></div>)}</div> : <div className="empty-state" style={{ padding: "1.5rem" }}>لا توجد مستندات مرتبطة بهذا السائق.</div>}</section><div className="detail-footer"><button className="btn primary" onClick={onClose}>إغلاق</button></div></Modal>;
}

function MaintenanceInvoicesSection({ requestId, invoices, canViewPayables, onOpenPayables }: { requestId: number; invoices: PayableRow[]; canViewPayables: boolean; onOpenPayables: () => void }) {
  const utils = trpc.useUtils();
  const linked = canViewPayables ? invoices.filter(invoice => invoice.maintenanceRequestId === requestId) : [];
  const openReceipt = async (invoice: PayableRow) => {
    try {
      const receipt = await utils.payables.receipt.fetch({ id: invoice.id });
      if (!receipt?.url) throw new Error("لا توجد صورة فاتورة مرفقة");
      window.open(receipt.url, "_blank", "noopener,noreferrer");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر فتح الفاتورة"); }
  };
  return <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>فواتير طلب الصيانة</h3><span>{canViewPayables ? `${linked.length.toLocaleString("en-US")} فاتورة مرتبطة` : "يلزم إذن المستحقات علينا لعرض سجل الفواتير"}</span></div>{canViewPayables && <button className="btn outline" onClick={onOpenPayables}>فتح سجل الفواتير</button>}</div>{!canViewPayables ? <div className="field-note">امنح المستخدم صلاحية «المستحقات علينا» لعرض حالات الفواتير والمدفوعات.</div> : linked.length ? <div className="compact-list">{linked.map(invoice => <div className="compact-row" key={invoice.id}><div className="compact-main"><strong>{invoice.ref} · {invoice.supplier}</strong><small>{invoice.issueDate} · {invoice.description}</small></div><Badge>{invoice.status}</Badge><div className="compact-main" style={{ textAlign: "left" }}><strong>{formatSAR(invoice.amount)}</strong><small>مدفوع {formatSAR(invoice.paid)} · متبقٍ {formatSAR(invoice.remaining)}</small></div>{invoice.hasReceipt && <button className="text-link" onClick={() => void openReceipt(invoice)}>معاينة الفاتورة</button>}</div>)}</div> : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد فواتير مورد مرتبطة بهذا الطلب حتى الآن.</div>}</section>;
}

function MaintenanceCostSummary({ request, invoices }: { request: Maintenance; invoices: PayableRow[] }) {
  const linked = invoices.filter(invoice => invoice.maintenanceRequestId === request.id);
  const summary = summarizeMaintenanceCost({ workshopQuote: request.estimatedCost, partsQuote: request.quotedPartsCost, recordedActual: request.cost, invoices: linked });
  const varianceLabel = summary.variance === null ? "لا يوجد تقدير للمقارنة" : summary.variance > 0 ? `زيادة ${formatSAR(summary.variance)} عن التقدير` : summary.variance < 0 ? `أقل من التقدير بـ ${formatSAR(Math.abs(summary.variance))}` : "مطابق للتقدير";
  return <section className="surface maintenance-cost-summary"><div className="section-head"><div><h3>مطابقة التكلفة</h3><span>الفاتورة المعتمدة تُحتسب تكلفة فعلية؛ الفاتورة الجديدة تبقى معلّقة حتى اعتماد المالية.</span></div></div><div className="quick-metrics"><div><span>التقدير (الورشة + القطع)</span><strong>{formatSAR(summary.estimate)}</strong></div><div><span>فعلي معتمد من الفواتير</span><strong>{formatSAR(summary.approvedActual)}</strong></div><div><span>فواتير بانتظار الاعتماد</span><strong>{formatSAR(summary.pendingTotal)}</strong></div><div><span>الفرق عن التقدير</span><strong>{varianceLabel}</strong></div></div>{summary.hasRecordedActualMismatch && <div className="maintenance-cost-warning" role="alert">قيمة التكلفة الفعلية المسجلة في الطلب ({formatSAR(summary.recordedActual)}) لا تطابق مجموع الفواتير المعتمدة ({formatSAR(summary.approvedActual)}). راجع سجل الفواتير قبل إغلاق الطلب.</div>}</section>;
}

function MaintenanceDetailModal({ request, linkedInvoices, canViewFinance, canViewPayables, canViewDocuments, onOpenPayables, onClose, onEdit }: { request: Maintenance; linkedInvoices: PayableRow[]; canViewFinance: boolean; canViewPayables: boolean; canViewDocuments: boolean; onOpenPayables: () => void; onClose: () => void; onEdit: () => void }) {
  const history = trpc.maintenance.history.useQuery({ id: request.id });
  const entries: Array<[string, unknown]> = [["الطلب", request.ref], ["المركبة", request.vehicle], ["نوع الصيانة", request.type], ["الأولوية", request.priority || "متوسط"], ["المرحلة", request.workflowStage || "بلاغ"], ["مقدم البلاغ", request.reportedBy], ["الفني", request.technician], ["الورشة", request.workshop], ["وصف المشكلة", request.reason], ["التشخيص", request.diagnosis], ["العمل المنفذ", request.workDone], ["العودة المتوقعة", request.expectedReturn || request.due], ["الضمان حتى", request.warrantyUntil]];
  if (canViewFinance) entries.push(["قيمة عرض الورشة", request.estimatedCost], ["قيمة قطع الغيار حسب العرض", request.quotedPartsCost], ["التكلفة الفعلية", request.cost], ["قرار الاعتماد", request.approvalStatus], ["طريقة الصرف", request.fundingType], ["رقم عملية الصرف", request.fundingReference], ["المبلغ المصروف", request.fundingAmount], ["الجهة المستلمة", request.fundingRecipient], ["حالة العهدة", request.advanceStatus], ["مرجع تسوية العهدة", request.advanceSettlementReference], ["المعتمد", request.approvedByName], ["تاريخ الاعتماد", request.approvedAt], ["ملاحظات الاعتماد", request.approvalNotes]);
  return <Modal title={`تفاصيل طلب الصيانة · ${request.ref}`} onClose={onClose} wide><div className="detail-grid">{entries.map(([label, value]) => <div className="detail-cell" key={label}><span>{label}</span><strong>{value instanceof Date ? value.toLocaleString("en-US") : String(value ?? "—")}</strong></div>)}</div>{request.quoteUrl && <div className="detail-footer"><button className="btn outline" onClick={() => window.open(String(request.quoteUrl), "_blank", "noopener,noreferrer")}><BookOpen size={15} />معاينة عرض السعر · {request.quoteName || "الملف"}</button></div>}{canViewFinance && canViewPayables && <MaintenanceCostSummary request={request} invoices={linkedInvoices} />}<LinkedDocumentsSection entityType="صيانة" entityId={request.id} canViewDocuments={canViewDocuments} /><MaintenanceInvoicesSection requestId={request.id} invoices={linkedInvoices} canViewPayables={canViewPayables} onOpenPayables={onOpenPayables} /><section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>سجل الإجراءات</h3><span>المراحل والتعديلات وقرارات الاعتماد</span></div></div>{history.isLoading ? <div className="empty-state">جارٍ تحميل السجل...</div> : history.data?.length ? <div className="compact-list">{history.data.map(event => <div className="compact-row" key={event.id}><div className="compact-main"><strong>{event.eventType}{event.toStage ? ` · ${event.toStage}` : ""}</strong><small>{event.actorName} · {new Date(event.createdAt).toLocaleString("en-US")}</small>{event.details && <small>{event.details}</small>}</div></div>)}</div> : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد أحداث مسجلة لهذا الطلب.</div>}</section><div className="detail-footer"><button className="btn ghost" onClick={onClose}>إغلاق</button><button className="btn primary" onClick={onEdit}><Pencil size={15} />تعديل الطلب</button></div></Modal>;
}

function DocumentsPage({ documents, onAction, onOpenForm }: { documents: Document[]; onAction: (action: string, row: Row) => void; onOpenForm: (row?: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const needsReviewStatuses = new Set(["قريبًا", "متأخر", "منتهي"]);
  const needsReviewDocuments = documents.filter(document => needsReviewStatuses.has(document.status));
  const filtered = documents.filter(d => matchesQuickSearch(d, search) && (tab === "الكل" || (tab === "يحتاج مراجعة" && needsReviewStatuses.has(d.status)) || (tab === "متأخر" && d.status === "متأخر") || (tab === "منتهي" && d.status === "منتهي") || (tab === "قريبًا" && d.status === "قريبًا") || (tab === "مركبة" && d.entityType === "مركبة") || (tab === "سائق" && d.entityType === "سائق") || (tab === "موظف" && d.entityType === "موظف") || (tab === "مشروع" && d.entityType === "مشروع") || (tab === "عميل" && d.entityType === "عميل") || (tab === "عقد" && d.entityType === "عقد") || (tab === "مطالبة" && d.entityType === "مطالبة") || (tab === "صيانة" && d.entityType === "صيانة")));
  return <><PageHeader eyebrow="التشغيل / الامتثال" title="المستندات" description="كل مستندات المركبات والسائقين والعملاء في مكان واحد، مع تنبيهات التجديد." action="رفع مستند" onAction={() => onOpenForm()} />{needsReviewDocuments.length > 0 && <div className="document-alert"><div className="alert-icon amber"><Bell size={17} /></div><div><strong>لديك {needsReviewDocuments.length.toLocaleString("en-US")} مستندات تحتاج إلى مراجعة</strong><span>راجع المستندات المنتهية والقريبة من الانتهاء لتفادي تعطل العمليات.</span></div><button className="btn outline" onClick={() => setTab("يحتاج مراجعة")}>مراجعة الآن</button></div>}<TableShell columns={["المستند", "الكيان المرتبط", "النوع", "تاريخ الانتهاء", "الحالة"]} onExport={() => exportCsv(filtered, ["name", "entity", "type", "expiry", "status"], "documents")} search={search} setSearch={setSearch} tabs={["الكل", "يحتاج مراجعة", "قريبًا", "متأخر", "منتهي", "مركبة", "سائق", "موظف", "مشروع", "عميل", "عقد", "مطالبة", "صيانة"]} activeTab={tab} setActiveTab={setTab} addLabel="رفع مستند" onAdd={() => onOpenForm()}>{filtered.map(d => <tr key={d.id}><td><div className="doc-cell"><span className="file-icon"><FileText size={17} /></span><div><strong>{d.name}</strong><small>{d.owner}</small></div></div></td><td>{d.entity}</td><td>{d.type}</td><td>{d.expiry}</td><td><Badge>{d.status}</Badge></td><td className="actions-cell"><DocumentFileActions file={d} /><button className="row-menu-btn" onClick={() => setMenu(menu === d.id ? null : d.id)}><MoreHorizontal size={18} /></button>{menu === d.id && <ContextMenu row={d} module="documents" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, d); }} />}</td></tr>)}</TableShell></>;
}

function DriversPage({ drivers, onOpenForm, onAction, onView }: { drivers: Driver[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void; onView: (driver: Driver) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const renewalTabs: Record<string, string> = { "رخص منتهية": "منتهية", "رخص قريبة": "قريبة", "رخص سارية": "سارية", "بدون تاريخ تجديد": "غير محددة" };
  const filtered = drivers.filter(driver => {
    const renewalStatus = resolveRenewalStatus(driver.renewal);
    const matchesTab = tab === "الكل" || driver.status === tab || renewalTabs[tab] === renewalStatus;
    return matchesTab && matchesQuickSearch({ ...driver, renewalStatus }, search);
  });
  const tabs = ["الكل", "متاح", "مشغول", ...Object.keys(renewalTabs)];
  return <><PageHeader eyebrow="التشغيل / الفريق" title="السائقون" description="إدارة ملفات السائقين والرخص والتوزيع والحالة التشغيلية." action="إضافة سائق" onAction={() => onOpenForm()} /><div className="quick-metrics"><div><span>إجمالي السائقين</span><strong>{drivers.length.toLocaleString("en-US")}</strong></div><div><span>متاحون</span><strong className="green-text">{drivers.filter(driver => driver.status === "متاح").length.toLocaleString("en-US")}</strong></div><div><span>في مهمة</span><strong className="blue-text">{drivers.filter(driver => driver.status === "مشغول").length.toLocaleString("en-US")}</strong></div><div><span>رخص منتهية أو قريبة</span><strong className="amber-text">{drivers.filter(driver => ["منتهية", "قريبة"].includes(resolveRenewalStatus(driver.renewal))).length.toLocaleString("en-US")}</strong></div></div><TableShell columns={["السائق", "الهاتف", "الهوية", "نوع الرخصة", "المركبة الحالية", "حالة السائق", "تاريخ انتهاء الرخصة", "حالة الرخصة"]} onExport={() => exportCsv(filtered.map(driver => ({ ...driver, renewalStatus: resolveRenewalStatus(driver.renewal) })), ["name", "phone", "idNo", "license", "vehicle", "status", "renewal", "renewalStatus"], "drivers", ["السائق", "الهاتف", "الهوية", "نوع الرخصة", "المركبة الحالية", "حالة السائق", "تاريخ انتهاء الرخصة", "حالة الرخصة"])} search={search} setSearch={setSearch} tabs={tabs} activeTab={tab} setActiveTab={setTab} addLabel="إضافة سائق" onAdd={() => onOpenForm()}>{filtered.map(driver => <tr key={driver.id}><td><button className="driver-name-button" onClick={() => onView(driver)}><span className="avatar">{driver.name.slice(0, 1)}</span><span><strong>{driver.name}</strong><small>اضغط لعرض ملف السائق</small></span></button></td><td>{driver.phone}</td><td>{driver.idNo}</td><td>{driver.license}</td><td>{driver.vehicle}</td><td><Badge>{driver.status}</Badge></td><td>{driver.renewal}</td><td><Badge>{resolveRenewalStatus(driver.renewal)}</Badge></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === driver.id ? null : driver.id)}><MoreHorizontal size={18} /></button>{menu === driver.id && <ContextMenu row={driver} module="drivers" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, driver); }} />}</td></tr>)}</TableShell></>;
}

function ClientsPage({ clients, onOpenForm, onAction }: { clients: Client[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = clients.filter(c => matchesQuickSearch(c, search) && (tab === "الكل" || (tab === "نشط" && c.contracts > 0) || (tab === "غير نشط" && c.contracts === 0)));
  return <><PageHeader eyebrow="التشغيل / الحسابات" title="العملاء" description="ملفات العملاء والعقود والمركبات والمطالبات المرتبطة بكل حساب." action="إضافة عميل" onAction={() => onOpenForm()} />{clients.length > 0 && (() => { const topClient = [...clients].sort((a, b) => b.contracts - a.contracts)[0]; return <div className="client-insight"><div><div className="insight-icon"><Sparkles size={18} /></div><div><strong>العميل الأكثر ارتباطًا</strong><span>{topClient.name} · {topClient.contracts.toLocaleString("en-US")} عقود</span></div></div><div className="insight-value">{topClient.contracts.toLocaleString("en-US")}<small>عقود مرتبطة</small></div></div>; })()}<TableShell columns={["العميل", "الموقع", "الرقم الضريبي", "السجل التجاري", "جهة الاتصال", "العقود"]} onExport={() => exportCsv(filtered, ["name", "location", "vat", "commercial", "contact", "contracts"], "clients")} search={search} setSearch={setSearch} tabs={["الكل", "نشط", "غير نشط"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة عميل" onAdd={() => onOpenForm()}>{filtered.map(c => <tr key={c.id}><td><strong className="table-primary">{c.name}</strong><small>عميل مؤسسي</small></td><td>{c.location}</td><td>{c.vat}</td><td>{c.commercial}</td><td><div><strong>{c.contact}</strong><small>{c.phone}</small></div></td><td><span className="number-pill">{c.contracts}</span></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === c.id ? null : c.id)}><MoreHorizontal size={18} /></button>{menu === c.id && <ContextMenu row={c} module="clients" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, c); }} />}</td></tr>)}</TableShell></>;
}

function ProjectsPage({ canAccess }: { canAccess: (key: ModuleKey) => boolean }) {
  const utils = trpc.useUtils();
  const { data: projects = [] } = trpc.projects.list.useQuery(undefined, { staleTime: 20000 });
  const { data: clients = [] } = trpc.clients.list.useQuery(undefined, { enabled: canAccess("clients") });
  const { data: contracts = [] } = trpc.contracts.list.useQuery(undefined, { enabled: canAccess("finance") });
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, { enabled: canAccess("employees") });
  const createProject = trpc.projects.create.useMutation();
  const updateProject = trpc.projects.update.useMutation();
  const archiveProject = trpc.projects.archive.useMutation();
  const [form, setForm] = useState<Row | null>(null);
  const [profile, setProfile] = useState<ProjectRow | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  useLayoutEffect(() => { setForm(null); setProfile(null); }, [canAccess("clients"), canAccess("finance"), canAccess("employees"), canAccess("vehicles"), canAccess("documents")]);
  const selectedProjectClient = form ? clients.find(client => String(client.id) === String(form.clientId)) : undefined;
  const projectContracts = contracts.filter(contract => !selectedProjectClient || contract.clientId === selectedProjectClient.id || (!contract.clientId && contract.client === selectedProjectClient.name));
  const blank = (): Row => ({ id: Date.now(), ref: `PR-${formatCompanyDate().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`, name: "", client: "", clientId: null, contract: "—", contractId: null, managerEmployeeId: null, manager: "", startDate: "", endDate: "", requiredVehicles: 0, actualVehicles: 0, status: "مخطط", notes: "" });
  const change = (key: string) => (value: string) => setForm(prev => prev ? ({ ...prev, [key]: value }) : prev);
  const scopedProjects = (projects as ProjectRow[]).map(project => ({
    ...project,
    client: canAccess("clients") ? project.client : "—",
    clientId: canAccess("clients") ? project.clientId : null,
    contract: canAccess("finance") ? project.contract : "—",
    contractId: canAccess("finance") ? project.contractId : null,
    manager: canAccess("employees") ? project.manager : "—",
    managerEmployeeId: canAccess("employees") ? project.managerEmployeeId : null,
    actualVehicles: canAccess("vehicles") ? project.actualVehicles : null,
  }));
  const rows = scopedProjects.filter(project => matchesQuickSearch(project, search) && (tab === "الكل" || project.status === tab));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name || !form.client) { toast.error("أدخل اسم المشروع والعميل"); return; }
    const { id, actualVehicles: _actual, createdAt: _created, updatedAt: _updated, archivedAt: _archived, ...raw } = form;
    const payload = { ...raw, requiredVehicles: Math.max(0, Number(raw.requiredVehicles || 0)), clientId: raw.clientId ? Number(raw.clientId) : null, contractId: raw.contractId ? Number(raw.contractId) : null } as any;
    if (projects.some(project => project.id === id)) {
      if (!canAccess("clients")) { delete payload.client; delete payload.clientId; }
      if (!canAccess("finance")) { delete payload.contract; delete payload.contractId; }
      if (!canAccess("employees")) { delete payload.manager; delete payload.managerEmployeeId; }
    }
    const onSuccess = () => { utils.projects.list.invalidate(); setForm(null); toast.success("تم حفظ المشروع"); };
    const onError = (error: { message: string }) => toast.error(`تعذر حفظ المشروع: ${error.message}`);
    if (projects.some(project => project.id === id)) updateProject.mutate({ id, data: payload }, { onSuccess, onError });
    else createProject.mutate(payload, { onSuccess, onError });
  };
  return <>
    <PageHeader eyebrow="التشغيل / إدارة المشاريع" title="المشاريع والجهات" description="ملف موحد لكل مشروع يربط العميل والعقد والمدة والاحتياج الفعلي من المركبات." action="إضافة مشروع" onAction={() => setForm(blank())} />
    <div className="quick-metrics"><div><span>المشاريع النشطة</span><strong className="green-text">{projects.filter(project => project.status === "نشط").length.toLocaleString("en-US")}</strong></div><div><span>المركبات المطلوبة</span><strong>{projects.reduce((sum, project) => sum + Number(project.requiredVehicles || 0), 0).toLocaleString("en-US")}</strong></div>{canAccess("vehicles") && <div><span>المركبات المسندة فعليًا</span><strong className="blue-text">{projects.reduce((sum, project) => sum + Number(project.actualVehicles || 0), 0).toLocaleString("en-US")}</strong></div>}<div><span>المشاريع المتوقفة</span><strong className="red-text">{projects.filter(project => project.status === "موقوف").length.toLocaleString("en-US")}</strong></div></div>
    <TableShell columns={["المشروع", "العميل", "العقد", "بداية / نهاية", "المركبات المطلوبة / المسندة", "المسؤول", "الحالة"]} onExport={() => exportCsv(rows, ["ref", "name", "client", "contract", "startDate", "endDate", "requiredVehicles", "actualVehicles", "manager", "status"], "projects")} search={search} setSearch={setSearch} tabs={["الكل", "نشط", "مخطط", "موقوف", "مكتمل", "ملغي"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة مشروع" onAdd={() => setForm(blank())}>
      {rows.map(project => <tr key={project.id}><td><button className="driver-name-button" onClick={() => setProfile(project)}><strong className="table-primary">{project.name}</strong><small>{project.ref} · عرض التفاصيل والمستندات</small></button></td><td>{project.client}</td><td>{project.contract}</td><td>{project.startDate} / {project.endDate}</td><td>{project.requiredVehicles} / {project.actualVehicles ?? "—"}</td><td>{project.manager}</td><td><Badge>{project.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" title="تعديل المشروع" onClick={() => setForm({ ...project })}><Pencil size={16} /></button><button className="row-menu-btn danger" title="أرشفة المشروع" onClick={() => toast("تأكيد أرشفة المشروع؟ لا يمكن أرشفة مشروع مرتبط بمركبات.", { action: { label: "تأكيد", onClick: () => archiveProject.mutate({ id: project.id }, { onSuccess: result => { if (result.success) { utils.projects.list.invalidate(); toast.success("تمت أرشفة المشروع"); } else toast.error("أزل إسناد المركبات النشطة إلى المشروع قبل أرشفته"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })}><Archive size={16} /></button></td></tr>)}
    </TableShell>
    {profile && <Modal title={`ملف المشروع · ${profile.name}`} onClose={() => setProfile(null)} wide><div className="detail-grid">{[["المرجع", profile.ref], ["العميل", profile.client], ["العقد", profile.contract], ["مدير المشروع", profile.manager], ["الحالة", profile.status], ["بداية المشروع", profile.startDate], ["نهاية المشروع", profile.endDate], ["المركبات المطلوبة", profile.requiredVehicles], ["المركبات المسندة", profile.actualVehicles]].map(([label, value]) => <div className="detail-cell" key={String(label)}><span>{label}</span><strong>{String(value ?? "—")}</strong></div>)}</div><LinkedDocumentsSection entityType="مشروع" entityId={profile.id} canViewDocuments={canAccess("documents")} /><div className="detail-footer"><button className="btn outline" onClick={() => { setForm({ ...profile }); setProfile(null); }}>تعديل المشروع</button><button className="btn primary" onClick={() => setProfile(null)}>إغلاق</button></div></Modal>}
    {form && <Modal title={projects.some(project => project.id === form.id) ? "تعديل المشروع" : "إضافة مشروع"} onClose={() => setForm(null)} wide><form onSubmit={save}><div className="form-grid">
      <Field label="اسم المشروع *" value={form.name} onChange={change("name")} />
      <Field label="الرقم المرجعي" value={form.ref} onChange={change("ref")} />
      {canAccess("clients") ? <label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={event => { const client = clients.find(item => String(item.id) === event.target.value); setForm(prev => prev ? ({ ...prev, clientId: client?.id ?? null, client: client?.name ?? "", contractId: null, contract: "—" }) : prev); }}><option value="">اختر العميل</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label> : <Field label="العميل *" value={form.client} onChange={change("client")} disabled={projects.some(project => project.id === form.id)} />}
      {canAccess("finance") ? <label className="field"><span>العقد</span><select value={form.contractId || ""} onChange={event => { const contract = projectContracts.find(item => String(item.id) === event.target.value); setForm(prev => prev ? ({ ...prev, contractId: contract?.id ?? null, contract: contract?.ref ?? "—", ...(contract?.clientId ? { clientId: contract.clientId, client: contract.client } : {}) }) : prev); }}><option value="">بدون عقد</option>{projectContracts.map(contract => <option key={contract.id} value={contract.id}>{contract.ref} · {contract.client}</option>)}</select></label> : <Field label="مرجع العقد" value={form.contract} onChange={change("contract")} disabled={projects.some(project => project.id === form.id)} />}
      <Field label="تاريخ البداية" value={form.startDate} onChange={change("startDate")} type="date" />
      <Field label="تاريخ النهاية" value={form.endDate} onChange={change("endDate")} type="date" />
      <Field label="عدد المركبات المطلوبة" value={String(form.requiredVehicles ?? 0)} onChange={change("requiredVehicles")} type="number" />
      <label className="field"><span>مدير المشروع</span>{canAccess("employees") ? <select value={form.managerEmployeeId || ""} onChange={event => { const employee = employees.find(item => String(item.id) === event.target.value); setForm(prev => prev ? ({ ...prev, managerEmployeeId: employee?.id ?? null, manager: employee?.name ?? "—" }) : prev); }}><option value="">بدون مدير موظف</option>{employees.filter(employee => employee.status === "نشط").map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select> : <input value={form.manager} disabled={projects.some(project => project.id === form.id)} onChange={event => change("manager")(event.target.value)} />}</label>
      <label className="field"><span>حالة المشروع</span><select value={form.status} onChange={event => change("status")(event.target.value)}><option>مخطط</option><option>نشط</option><option>موقوف</option><option>مكتمل</option><option>ملغي</option></select></label>
      <Field label="ملاحظات" value={form.notes} onChange={change("notes")} />
    </div><FormActions onCancel={() => setForm(null)} label="حفظ المشروع" /></form></Modal>}
  </>;
}


type EmployeeRow = Row & { employeeNo: string; name: string; nationalId: string; phone: string; email: string; department: string; jobTitle: string; hireDate: string; status: string; userId?: number | null; notes?: string };
function EmployeesPage({ canAccess, canManageAccounts }: { canAccess: (key: ModuleKey) => boolean; canManageAccounts: boolean }) {
  const utils = trpc.useUtils();
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, { staleTime: 20000 });
  const { data: userAccounts = [] } = trpc.users.list.useQuery(undefined, { enabled: canManageAccounts, staleTime: 20000 });
  const { data: employeeDocuments = [] } = trpc.documents.list.useQuery(undefined, { enabled: canAccess("documents") });
  const { data: employeeVehicles = [] } = trpc.vehicles.list.useQuery(undefined, { enabled: canAccess("vehicles") });
  const { data: employeeProjects = [] } = trpc.projects.list.useQuery(undefined, { enabled: canAccess("projects") });
  const createEmployee = trpc.employees.create.useMutation();
  const updateEmployee = trpc.employees.update.useMutation();
  const archiveEmployee = trpc.employees.archive.useMutation();
  const linkEmployeeUser = trpc.employees.linkUser.useMutation();
  const [form, setForm] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [profile, setProfile] = useState<EmployeeRow | null>(null);
  useLayoutEffect(() => { setForm(null); setProfile(null); }, [canAccess("documents"), canAccess("vehicles"), canAccess("projects"), canAccess("drivers"), canAccess("clients"), canAccess("finance")]);
  const list = employees as EmployeeRow[];
  const blank = (): Row => ({ id: Date.now(), employeeNo: `EMP-${formatCompanyDate().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`, name: "", nationalId: "—", phone: "—", email: "—", department: "الإدارة", jobTitle: "موظف", hireDate: formatCompanyDate(), status: "نشط", notes: "" });
  const filtered = list.filter(employee => matchesQuickSearch(employee, search) && (tab === "الكل" || employee.status === tab));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name || !form?.employeeNo || !form?.department || !form?.jobTitle) { toast.error("أكمل الاسم والرقم والقسم والمسمى الوظيفي"); return; }
    const original = list.find(item => item.id === form.id);
    const isExisting = Boolean(original);
    if ((!isExisting || form.nationalId !== original?.nationalId) && !isOptionalFixedLengthIdentity(form.nationalId, 10)) { toast.error("رقم هوية الموظف أو إقامته يجب أن يتكون من 10 أرقام"); return; }
    const { id, ...data } = form;
    if (!isExisting || form.nationalId !== original?.nationalId) data.nationalId = normalizeIdentityNumber(form.nationalId);
    const done = () => { setForm(null); utils.employees.list.invalidate(); toast.success("تم حفظ ملف الموظف"); };
    if (list.some(item => item.id === id)) updateEmployee.mutate({ id, data }, { onSuccess: done, onError: error => toast.error(error.message) });
    else createEmployee.mutate(data as any, { onSuccess: done, onError: error => toast.error(error.message) });
  };
  const archive = (employee: EmployeeRow) => toast(`إنهاء ملف الموظف ${employee.name}؟ سيُزال إسناده للمشاريع والمركبات، وسيُعطّل حساب دخوله المرتبط إن وجد، مع إبقاء السجلات التاريخية.`, { action: { label: "تأكيد الإنهاء", onClick: () => archiveEmployee.mutate({ id: employee.id }, { onSuccess: () => { utils.employees.list.invalidate(); utils.vehicles.list.invalidate(); utils.projects.list.invalidate(); if (canManageAccounts) utils.users.list.invalidate(); toast.success("تم إنهاء ملف الموظف وفك إسناداته وتعطيل حسابه المرتبط"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } });
  return <>
    <PageHeader eyebrow="الموارد البشرية / الملفات" title="الموظفون" description="ملفات العاملين غير السائقين، مع حالة العمل وبيانات الاتصال والإسناد التشغيلي." action="إضافة موظف" onAction={() => setForm(blank())} />
    <div className="quick-metrics"><div><span>إجمالي الملفات</span><strong>{list.length.toLocaleString("en-US")}</strong></div><div><span>على رأس العمل</span><strong className="green-text">{list.filter(item => item.status === "نشط").length.toLocaleString("en-US")}</strong></div><div><span>إجازة</span><strong className="amber-text">{list.filter(item => item.status === "إجازة").length.toLocaleString("en-US")}</strong></div><div><span>غير نشط / منتهي</span><strong className="red-text">{list.filter(item => ["موقوف", "منتهي الخدمة"].includes(item.status)).length.toLocaleString("en-US")}</strong></div>{canManageAccounts && <><div><span>مرتبط بحساب دخول</span><strong className="green-text">{list.filter(item => item.userId != null).length.toLocaleString("en-US")}</strong></div><div><span>بلا حساب دخول</span><strong className="amber-text">{list.filter(item => item.userId == null && item.status === "نشط").length.toLocaleString("en-US")}</strong></div></>}</div>
    <TableShell columns={["رقم الموظف", "الموظف", "القسم", "المسمى الوظيفي", "الهاتف", "الهوية", "الحالة", ...(canManageAccounts ? ["حساب الدخول"] : []), "تاريخ المباشرة"]} onExport={() => exportCsv(filtered, ["employeeNo", "name", "department", "jobTitle", "phone", "nationalId", "email", "status", "hireDate"], "employees")} search={search} setSearch={setSearch} tabs={["الكل", "نشط", "إجازة", "موقوف", "منتهي الخدمة"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة موظف" onAdd={() => setForm(blank())}>
      {filtered.map(employee => <tr key={employee.id}><td><strong className="table-primary">{employee.employeeNo}</strong></td><td><button className="driver-name-button" onClick={() => setProfile(employee)}><span className="avatar">{employee.name.slice(0, 1)}</span><span><strong>{employee.name}</strong><small>{employee.email || "اضغط لعرض الملف والمستندات"}</small></span></button></td><td>{employee.department}</td><td>{employee.jobTitle}</td><td>{employee.phone}</td><td>{employee.nationalId}</td><td><Badge>{employee.status}</Badge></td>{canManageAccounts && <td><Badge>{employee.userId ? "مرتبط" : "غير مرتبط"}</Badge></td>}<td>{employee.hireDate}</td><td className="actions-cell"><button className="row-menu-btn" title="تعديل" onClick={() => setForm({ ...employee })}><Pencil size={15} /></button><button className="row-menu-btn danger" title="إنهاء/أرشفة" onClick={() => archive(employee)}><Archive size={15} /></button></td></tr>)}
    </TableShell>
    {profile && <Modal title={`ملف الموظف · ${profile.name}`} onClose={() => setProfile(null)} wide><div className="driver-summary"><span className="avatar">{profile.name.slice(0,1)}</span><div><strong>{profile.name}</strong><span>{profile.employeeNo} · {profile.jobTitle} · {profile.department}</span><Badge>{profile.status}</Badge></div></div><div className="quick-metrics"><div><span>الهاتف</span><strong>{profile.phone}</strong></div><div><span>الهوية</span><strong>{profile.nationalId}</strong></div><div><span>البريد</span><strong>{profile.email}</strong></div><div><span>تاريخ المباشرة</span><strong>{profile.hireDate}</strong></div></div>{canManageAccounts && <section className="surface employee-account-link"><div><h3>حساب النظام</h3><span>اربط ملف الموظف بحساب الدخول والمهام الخاص به. الحساب الواحد يرتبط بملف موظف واحد.</span></div><label className="field"><span>حساب المستخدم</span><select value={profile.userId ?? ""} onChange={event => { const userId = event.target.value ? Number(event.target.value) : null; linkEmployeeUser.mutate({ employeeId: profile.id, userId }, { onSuccess: saved => { setProfile(current => current ? { ...current, userId: saved.userId ?? null } : current); utils.employees.list.invalidate(); toast.success(userId ? "تم ربط حساب الدخول بملف الموظف" : "تم فصل حساب الدخول عن ملف الموظف"); }, onError: error => toast.error(`تعذر ربط الحساب: ${error.message}`) }); }} disabled={linkEmployeeUser.isPending}><option value="">بدون حساب مرتبط</option>{(userAccounts as Array<{ id: number; name: string | null; username: string | null; role: string; isActive: number }>).filter(account => account.isActive === 1 || account.id === profile.userId).map(account => <option key={account.id} value={account.id}>{account.name || account.username} · {account.username} · {account.isActive === 1 ? "نشط" : "موقوف"}</option>)}</select></label>{profile.userId ? (() => { const account = (userAccounts as Array<{ id: number; name: string | null; username: string | null; role: string; isActive: number }>).find(item => item.id === profile.userId); return <div className="employee-account-status">{account ? <><Badge>{account.isActive === 1 ? "نشط" : "موقوف"}</Badge><span>{account.username} · {account.role === "admin" ? "مدير النظام" : "مستخدم"}</span></> : <span>الحساب المرتبط #{profile.userId}</span>}</div>; })() : null}</section>}{(canAccess("vehicles") || canAccess("projects")) && <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>الإسنادات التشغيلية</h3><span>المركبات والمشاريع المرتبطة حاليًا بهذا الموظف</span></div></div><div className="quick-metrics">{canAccess("vehicles") && <div><span>المركبات المسؤول عنها</span><strong>{(employeeVehicles as Vehicle[]).filter(vehicle => vehicle.employeeId === profile.id).length}</strong></div>}{canAccess("projects") && <div><span>المشاريع التي يديرها</span><strong>{(employeeProjects as ProjectRow[]).filter(project => project.managerEmployeeId === profile.id).length}</strong></div>}</div><div className="compact-list">{canAccess("vehicles") && (employeeVehicles as Vehicle[]).filter(vehicle => vehicle.employeeId === profile.id).map(vehicle => <div className="compact-row" key={`vehicle-${vehicle.id}`}><div className="compact-main"><strong>مركبة · {vehicle.plate}</strong><small>{vehicle.brand} {vehicle.model} · السائق {canAccess("drivers") ? vehicle.driver : "—"}</small></div><Badge>{vehicle.status}</Badge></div>)}{canAccess("projects") && (employeeProjects as ProjectRow[]).filter(project => project.managerEmployeeId === profile.id).map(project => <div className="compact-row" key={`project-${project.id}`}><div className="compact-main"><strong>مشروع · {project.name}</strong><small>{project.ref} · العميل {canAccess("clients") ? project.client : "—"}</small></div><Badge>{project.status}</Badge></div>)}</div></section>}<section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>المستندات المرتبطة</h3><span>{canAccess("documents") ? "المستندات المحفوظة باسم هذا الموظف" : "يلزم إذن المستندات لعرض المرفقات"}</span></div></div>{canAccess("documents") ? (employeeDocuments as Document[]).filter(doc => isLinkedDocument(doc, "موظف", profile.id)).length ? <div className="compact-list">{(employeeDocuments as Document[]).filter(doc => isLinkedDocument(doc, "موظف", profile.id)).map(doc => <div className="compact-row" key={doc.id}><div className="compact-main"><strong>{doc.name}</strong><small>{doc.type} · ينتهي {doc.expiry}</small></div><Badge>{doc.status}</Badge><DocumentFileActions file={doc} /></div>)}</div> : <div className="empty-state" style={{ padding: "1.5rem" }}>لا توجد مستندات مرتبطة بهذا الموظف.</div> : null}</section><div className="detail-footer"><button className="btn outline" onClick={() => { setForm({ ...profile }); setProfile(null); }}>تعديل الملف</button><button className="btn primary" onClick={() => setProfile(null)}>إغلاق</button></div></Modal>}
    {form && <Modal title={list.some(item => item.id === form.id) ? "تعديل ملف الموظف" : "إضافة موظف"} onClose={() => setForm(null)} wide><form onSubmit={save}><div className="form-grid"><Field label="رقم الموظف *" value={form.employeeNo} onChange={value => setForm(prev => prev ? ({ ...prev, employeeNo: value }) : prev)} /><Field label="الاسم الكامل *" value={form.name} onChange={value => setForm(prev => prev ? ({ ...prev, name: value }) : prev)} /><Field label="رقم الهوية / الإقامة" value={form.nationalId} maxLength={10} inputMode="numeric" onChange={value => setForm(prev => prev ? ({ ...prev, nationalId: normalizeNumericInput(value, 10) }) : prev)} /><Field label="رقم الهاتف" value={form.phone} onChange={value => setForm(prev => prev ? ({ ...prev, phone: value }) : prev)} /><Field label="البريد الإلكتروني" value={form.email === "—" ? "" : form.email} onChange={value => setForm(prev => prev ? ({ ...prev, email: value || "—" }) : prev)} /><Field label="القسم" value={form.department} onChange={value => setForm(prev => prev ? ({ ...prev, department: value }) : prev)} /><Field label="المسمى الوظيفي" value={form.jobTitle} onChange={value => setForm(prev => prev ? ({ ...prev, jobTitle: value }) : prev)} /><Field label="تاريخ المباشرة" type="date" value={form.hireDate === "—" ? "" : form.hireDate} onChange={value => setForm(prev => prev ? ({ ...prev, hireDate: value }) : prev)} /><label className="field"><span>الحالة</span><select value={form.status} onChange={event => setForm(prev => prev ? ({ ...prev, status: event.target.value }) : prev)}><option>نشط</option><option>إجازة</option><option>موقوف</option><option>منتهي الخدمة</option></select></label><Field label="ملاحظات" value={form.notes} onChange={value => setForm(prev => prev ? ({ ...prev, notes: value }) : prev)} /></div><FormActions onCancel={() => setForm(null)} label="حفظ ملف الموظف" /></form></Modal>}
  </>;
}

function InventoryPage({ canApprove }: { canApprove: boolean }) {
  const utils = trpc.useUtils();
  const itemQuery = trpc.inventory.list.useQuery(undefined, { staleTime: 15000 });
  const movementQuery = trpc.inventory.movements.useQuery(undefined, { staleTime: 15000 });
  const requestQuery = trpc.inventory.requests.useQuery(undefined, { staleTime: 15000 });
  const items = itemQuery.data ?? [];
  const movements = movementQuery.data ?? [];
  const createItem = trpc.inventory.create.useMutation();
  const updateItem = trpc.inventory.update.useMutation();
  const moveStock = trpc.inventory.move.useMutation();
  const createRequest = trpc.inventory.request.useMutation();
  const decideRequest = trpc.inventory.decideRequest.useMutation();
  const issueRequest = trpc.inventory.issueRequest.useMutation();
  const archiveItem = trpc.inventory.archive.useMutation();
  const [search, setSearch] = useState("");
  const [itemForm, setItemForm] = useState<Row | null>(null);
  const [movementItem, setMovementItem] = useState<Row | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestItemId, setRequestItemId] = useState("");
  const [requestQuantity, setRequestQuantity] = useState("");
  const [requestPurpose, setRequestPurpose] = useState("");
  const requests = requestQuery.data ?? [];
  const filtered = (items as Row[]).filter(item => `${item.sku} ${item.name} ${item.category} ${item.location}`.toLowerCase().includes(search.trim().toLowerCase()));
  const low = (items as Row[]).filter(item => item.onHand <= item.reorderLevel).length;
  const saveItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm?.sku || !itemForm.name || !itemForm.category || Number(itemForm.reorderLevel) < 0) { toast.error("أكمل رمز الصنف واسمه وفئته وحد إعادة الطلب"); return; }
    const existing = (items as Row[]).some(item => item.id === itemForm.id);
    const { id, onHand: _onHand, ...data } = itemForm;
    const done = () => { setItemForm(null); void utils.inventory.list.invalidate(); toast.success(existing ? "تم تحديث الصنف" : "تمت إضافة الصنف" ); };
    if (existing) updateItem.mutate({ id, data: data as any }, { onSuccess: done, onError: error => toast.error(`تعذر حفظ الصنف: ${error.message}`) });
    else createItem.mutate(data as any, { onSuccess: done, onError: error => toast.error(`تعذر إضافة الصنف: ${error.message}`) });
  };
  const openMovement = (item: Row) => { setMovementItem(item); setQuantity(""); setReference(""); setRecipient(""); setNotes(""); };
  const submitMovement = (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementItem || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) { toast.error("أدخل كمية صحيحة أكبر من صفر"); return; }
    moveStock.mutate({ itemId: movementItem.id, direction: "استلام", quantity: Number(quantity), reference: reference.trim() || "—", recipient: recipient.trim() || "—", notes: notes.trim() || undefined }, { onSuccess: () => { setMovementItem(null); void utils.inventory.list.invalidate(); void utils.inventory.movements.invalidate(); toast.success("تم تسجيل استلام المخزون"); }, onError: error => toast.error(`تعذر تسجيل الحركة: ${error.message}`) });
  };
  const submitRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestItemId || !Number.isInteger(Number(requestQuantity)) || Number(requestQuantity) <= 0 || requestPurpose.trim().length < 3) { toast.error("اختر الصنف والكمية واكتب سبب الطلب"); return; }
    createRequest.mutate({ ref: `IR-${Date.now()}`, purpose: requestPurpose.trim(), items: [{ itemId: Number(requestItemId), quantity: Number(requestQuantity) }] }, { onSuccess: () => { setRequestOpen(false); setRequestItemId(""); setRequestQuantity(""); setRequestPurpose(""); void utils.inventory.requests.invalidate(); toast.success("أُرسل طلب الصرف إلى المالية للاعتماد"); }, onError: error => toast.error(`تعذر إرسال الطلب: ${error.message}`) });
  };
  return <>
    <PageHeader eyebrow="التشغيل / قطع الغيار" title="المخزون وقطع الغيار" description="أرصدة الإطارات والقطع والمواد، وطلبات صرف تمر بالاعتماد قبل إخراجها من المخزون." action="إضافة صنف" onAction={() => setItemForm({ id: Date.now(), sku: "", name: "", category: "قطع غيار", unit: "قطعة", reorderLevel: 0, location: "—", notes: "" })} />
    <div className="quick-metrics"><div><span>الأصناف النشطة</span><strong>{items.length}</strong></div><div><span>إجمالي الوحدات</span><strong>{(items as Row[]).reduce((sum, item) => sum + Number(item.onHand || 0), 0).toLocaleString("en-US")}</strong></div><div><span>تحت حد إعادة الطلب</span><strong className={low ? "amber-text" : "green-text"}>{low}</strong></div><div><span>حركات محفوظة</span><strong>{movements.length}</strong></div></div>
    <TableShell columns={["رمز الصنف", "الصنف", "الفئة", "الرصيد", "حد الطلب", "الموقع", "الحالة"]} onExport={() => exportCsv(filtered, ["sku", "name", "category", "unit", "onHand", "reorderLevel", "location"], "inventory")} search={search} setSearch={setSearch} tabs={["الكل"]} activeTab="الكل" setActiveTab={() => {}} addLabel="إضافة صنف" onAdd={() => setItemForm({ id: Date.now(), sku: "", name: "", category: "قطع غيار", unit: "قطعة", reorderLevel: 0, location: "—", notes: "" })}>
      {filtered.map(item => <tr key={item.id}><td><strong className="table-primary">{item.sku}</strong></td><td>{item.name}</td><td>{item.category}</td><td>{Number(item.onHand).toLocaleString("en-US")} {item.unit}</td><td>{Number(item.reorderLevel).toLocaleString("en-US")}</td><td>{item.location}</td><td><Badge>{item.onHand <= 0 ? "نفد" : item.onHand <= item.reorderLevel ? "منخفض" : "متوفر"}</Badge></td><td className="actions-cell"><button className="btn outline" onClick={() => openMovement(item)}>استلام</button><button className="btn outline" onClick={() => { setRequestItemId(String(item.id)); setRequestQuantity(""); setRequestPurpose(""); setRequestOpen(true); }}>طلب صرف</button><button className="row-menu-btn" title="تعديل الصنف" onClick={() => setItemForm({ ...item })}><Pencil size={15} /></button><button className="row-menu-btn danger" title="أرشفة الصنف" onClick={() => toast(`أرشفة الصنف ${item.name}؟`, { action: { label: "تأكيد", onClick: () => archiveItem.mutate({ id: item.id }, { onSuccess: () => { void utils.inventory.list.invalidate(); void utils.inventory.movements.invalidate(); toast.success("تمت أرشفة الصنف"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })}><Archive size={15} /></button></td></tr>)}
    </TableShell>
    <section className="surface" style={{ padding: "1.15rem", marginTop: "1rem" }}><div className="section-head"><div><h2>طلبات الصرف</h2><span>طلب الموظف ← اعتماد المالية ← صرف المخزن</span></div><strong>{requests.filter(request => request.status === "بانتظار الاعتماد").length} بانتظار الاعتماد</strong></div><div className="compact-list">{requests.slice(0, 50).map(request => <div className="compact-row" key={request.id}><div className="compact-main"><strong>{request.ref} · {request.requestedByName}</strong><small>{request.purpose} · {request.items.map(line => `${line.itemName} × ${line.requestedQuantity}`).join("، ")}</small>{request.approvalNotes && <small>ملاحظة المالية: {request.approvalNotes}</small>}</div><Badge>{request.status}</Badge>{request.status === "بانتظار الاعتماد" && canApprove && <><button className="btn primary" onClick={() => decideRequest.mutate({ id: request.id, approved: true }, { onSuccess: () => { void utils.inventory.requests.invalidate(); toast.success("تم اعتماد طلب الصرف"); }, onError: error => toast.error(error.message) })}>اعتماد</button><button className="btn outline" onClick={() => { const reason = window.prompt("سبب رفض الطلب"); if (reason === null) return; decideRequest.mutate({ id: request.id, approved: false, notes: reason }, { onSuccess: () => { void utils.inventory.requests.invalidate(); toast.success("تم رفض طلب الصرف"); }, onError: error => toast.error(error.message) }); }}>رفض</button></>}{request.status === "معتمد" && <button className="btn primary" onClick={() => issueRequest.mutate({ id: request.id }, { onSuccess: () => { void utils.inventory.requests.invalidate(); void utils.inventory.list.invalidate(); void utils.inventory.movements.invalidate(); toast.success("صُرفت الأصناف وسُجلت الحركة"); }, onError: error => toast.error(`تعذر صرف الطلب: ${error.message}`) })}>صرف الطلب</button>}</div>)}{requests.length === 0 && <div className="empty-state">لا توجد طلبات صرف بعد.</div>}</div></section>
    <section className="surface" style={{ padding: "1.15rem", marginTop: "1rem" }}><div className="section-head"><div><h2>آخر حركات المخزون</h2><span>سجل الاستلام والصرف والمرجع والجهة المستلمة</span></div></div><div className="compact-list">{(movements as Row[]).slice(0, 20).map(movement => { const item = (items as Row[]).find(record => record.id === movement.itemId); return <div className="compact-row" key={movement.id}><div className="compact-main"><strong>{movement.direction} · {item?.name || `صنف #${movement.itemId}`}</strong><small>{movement.reference} · {movement.actorName} · {movement.createdAt ? new Date(movement.createdAt).toLocaleString("ar-SA") : ""}</small></div><Badge>{`${movement.direction === "استلام" ? "+" : "−"}${movement.quantity} ${item?.unit || ""} · الرصيد ${movement.resultingBalance}`}</Badge>{movement.recipient && movement.recipient !== "—" && <span>{movement.recipient}</span>}</div>; })}{movements.length === 0 && <div className="empty-state">لا توجد حركات مخزون بعد.</div>}</div></section>
    {itemForm && <Modal title={(items as Row[]).some(item => item.id === itemForm.id) ? "تعديل صنف المخزون" : "إضافة صنف مخزون"} onClose={() => setItemForm(null)}><form onSubmit={saveItem}><div className="form-grid"><Field label="رمز الصنف *" value={itemForm.sku} onChange={value => setItemForm(prev => prev ? { ...prev, sku: value } : prev)} /><Field label="اسم الصنف *" value={itemForm.name} onChange={value => setItemForm(prev => prev ? { ...prev, name: value } : prev)} /><Field label="الفئة *" value={itemForm.category} onChange={value => setItemForm(prev => prev ? { ...prev, category: value } : prev)} placeholder="إطار، سير، قطع غيار..." /><Field label="وحدة القياس" value={itemForm.unit} onChange={value => setItemForm(prev => prev ? { ...prev, unit: value } : prev)} /><Field label="حد إعادة الطلب" type="number" value={String(itemForm.reorderLevel ?? 0)} onChange={value => setItemForm(prev => prev ? { ...prev, reorderLevel: Math.max(0, Math.trunc(Number(value) || 0)) } : prev)} /><Field label="موقع التخزين" value={itemForm.location} onChange={value => setItemForm(prev => prev ? { ...prev, location: value || "—" } : prev)} /><Field label="ملاحظات" value={itemForm.notes} onChange={value => setItemForm(prev => prev ? { ...prev, notes: value } : prev)} /></div><FormActions onCancel={() => setItemForm(null)} label="حفظ الصنف" /></form></Modal>}
    {movementItem && <Modal title={`استلام مخزون · ${movementItem.name}`} onClose={() => setMovementItem(null)}><form onSubmit={submitMovement}><div className="form-grid"><Field label="الكمية *" type="number" value={quantity} onChange={setQuantity} /><Field label="رقم الفاتورة" value={reference} onChange={setReference} /><Field label="المورد" value={recipient} onChange={setRecipient} /><Field label="ملاحظات" value={notes} onChange={setNotes} /><div className="field-note">الرصيد الحالي: {movementItem.onHand} {movementItem.unit}. الصرف يتم عبر طلب معتمد.</div></div><FormActions onCancel={() => setMovementItem(null)} label="تسجيل الاستلام" /></form></Modal>}
    {requestOpen && <Modal title="طلب صرف قطع غيار" onClose={() => setRequestOpen(false)}><form onSubmit={submitRequest}><div className="form-grid"><label className="field"><span>الصنف *</span><select value={requestItemId} onChange={event => setRequestItemId(event.target.value)}><option value="">اختر الصنف</option>{(items as Row[]).filter(item => item.onHand > 0).map(item => <option key={item.id} value={item.id}>{item.name} · المتاح {item.onHand} {item.unit}</option>)}</select></label><Field label="الكمية المطلوبة *" type="number" value={requestQuantity} onChange={setRequestQuantity} /><Field label="سبب الطلب *" value={requestPurpose} onChange={setRequestPurpose} placeholder="المركبة أو أمر الصيانة والغرض" /></div><div className="field-note">يرسل الطلب إلى المالية. لن ينقص المخزون إلا بعد الاعتماد وتنفيذ الصرف.</div><FormActions onCancel={() => setRequestOpen(false)} label="إرسال طلب للمالية" /></form></Modal>}
  </>;
}

type ReportData = { period: { from: string; to: string }; fleet: Record<string, number>; finance: Record<string, number>; maintenance: Record<string, number>; projects: Record<string, number>; documents: Record<string, number>; people: Record<string, number>; details: { payments: Row[]; receivablesAging: Row[]; claims: Row[]; contracts: Row[]; payables: Row[]; maintenance: Row[]; operatingExpenses: Row[]; vehicleProfitability: Row[]; projectProfitability: Row[]; clientProfitability: Row[]; employees: Row[]; drivers: Row[] } };
function AccidentDetailModal({ accident, onClose }: { accident: Row; onClose: () => void }) {
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
  const nextStage: Record<string, string | null> = { "بلاغ": "تحديد المسؤولية", "تحديد المسؤولية": "تقدير الإصلاح", "تقدير الإصلاح": "مطالبة التأمين", "مطالبة التأمين": "التسوية", "التسوية": "مغلق", "مغلق": null, "ملغي": null };
  const advanceToNext = () => {
    const toStage = nextStage[String(current.workflowStage)];
    if (!toStage) return;
    const data: Record<string, unknown> = { resolutionNotes: notes.trim() || undefined };
    if (toStage === "تقدير الإصلاح") { data.faultPercent = Number(faultPercent); data.najmReportNo = current.najmReportNo; }
    if (toStage === "مطالبة التأمين") { data.estimatedRepairCost = Number(repairCost); data.insurerName = insurer.trim(); }
    if (toStage === "التسوية") { data.insurerClaimRef = claimRef.trim(); data.insurerClaimStatus = claimStatus; }
    if (toStage === "مغلق") data.settlementAmount = Number(settlement);
    advance.mutate({ id: current.id, toStage: toStage as any, data: data as any }, { onSuccess: () => { void utils.accidents.list.invalidate(); void utils.accidents.detail.invalidate({ id: current.id }); void utils.accidents.events.invalidate({ id: current.id }); toast.success(`تم نقل الحادث إلى مرحلة ${toStage}`); }, onError: error => toast.error(`تعذر نقل الحادث: ${error.message}`) });
  };
  return <Modal title={`بلاغ الحادث · ${current.ref}`} onClose={onClose} wide><div className="quick-metrics"><div><span>المركبة</span><strong>{current.vehiclePlate}</strong></div><div><span>السائق</span><strong>{current.driverName || "—"}</strong></div><div><span>تاريخ الحادث</span><strong>{current.occurredAt}</strong></div><div><span>المرحلة</span><strong>{current.workflowStage}</strong></div></div><div className="detail-grid">{[["الموقع", current.location], ["الوصف", current.description], ["رقم تقرير نجم", current.najmReportNo], ["نسبة المسؤولية", current.faultPercent == null ? "لم تحدد" : `${current.faultPercent}%`], ["تقدير الإصلاح", current.estimatedRepairCost == null ? "لم يسجل" : formatSAR(current.estimatedRepairCost)], ["شركة التأمين", current.insurerName || "—"], ["رقم المطالبة", current.insurerClaimRef || "—"], ["حالة مطالبة التأمين", current.insurerClaimStatus || "—"], ["التسوية النهائية", current.settlementAmount == null ? "لم تسجل" : formatSAR(current.settlementAmount)]].map(([label, value]) => <div className="detail-cell" key={String(label)}><span>{label}</span><strong>{String(value ?? "—")}</strong></div>)}</div>{current.najmReportUrl && <section className="surface" style={{ marginTop: "1rem", padding: "1rem" }}><strong>تقرير نجم · {current.najmReportName || current.najmReportNo}</strong><div style={{ display: "flex", gap: ".75rem", marginTop: ".75rem" }}><a className="btn outline" href={current.najmReportUrl} target="_blank" rel="noreferrer">معاينة التقرير</a><a className="btn outline" href={current.najmReportUrl} download={current.najmReportName || "najm-report"}>تحميل التقرير</a></div></section>}<section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>سجل الإجراءات</h3><span>المرحلة والمنفذ والتوقيت</span></div></div><div className="compact-list">{(events ?? []).map(event => <div className="compact-row" key={event.id}><div className="compact-main"><strong>{event.fromStage ? `${event.fromStage} ← ${event.toStage}` : event.toStage}</strong><small>{event.actorName} · {event.createdAt ? new Date(event.createdAt).toLocaleString("ar-SA") : ""} · {event.details || ""}</small></div></div>)}{(events ?? []).length === 0 && <div className="empty-state">لا يوجد سجل إجراءات.</div>}</div></section>{nextStage[String(current.workflowStage)] && <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><h3 style={{ marginBottom: ".75rem" }}>الانتقال إلى: {nextStage[String(current.workflowStage)]}</h3><div className="form-grid">{nextStage[String(current.workflowStage)] === "تقدير الإصلاح" && <><Field label="نسبة المسؤولية %" type="number" value={faultPercent} onChange={setFaultPercent} /><div className="field-note">رقم تقرير نجم: {current.najmReportNo || "—"}</div></>}{nextStage[String(current.workflowStage)] === "مطالبة التأمين" && <><Field label="تقدير تكلفة الإصلاح (SAR)" type="number" value={repairCost} onChange={setRepairCost} /><Field label="شركة التأمين" value={insurer} onChange={setInsurer} /></>}{nextStage[String(current.workflowStage)] === "التسوية" && <><Field label="رقم مطالبة التأمين" value={claimRef} onChange={setClaimRef} /><label className="field"><span>حالة المطالبة</span><select value={claimStatus} onChange={event => setClaimStatus(event.target.value)}><option>مرفوعة</option><option>مقبولة</option><option>مرفوضة</option><option>مصروفة</option></select></label></>}{nextStage[String(current.workflowStage)] === "مغلق" && <Field label="مبلغ التسوية النهائية (SAR)" type="number" value={settlement} onChange={setSettlement} />}<Field label="ملاحظات الإجراء" value={notes} onChange={setNotes} /></div><div className="detail-footer"><button className="btn primary" disabled={advance.isPending} onClick={advanceToNext}>اعتماد المرحلة التالية</button><button className="btn ghost" onClick={onClose}>إغلاق</button></div></section>}</Modal>;
}

function AccidentsPage({ vehicles, drivers }: { vehicles: Vehicle[]; drivers: Driver[] }) {
  const utils = trpc.useUtils();
  const { data = [] } = trpc.accidents.list.useQuery(undefined, { staleTime: 15000 });
  const createAccident = trpc.accidents.create.useMutation();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [uploading, setUploading] = useState(false);
  const records = data as Row[];
  const filtered = records.filter(row => `${row.ref} ${row.vehiclePlate} ${row.driverName} ${row.location} ${row.najmReportNo}`.toLowerCase().includes(search.trim().toLowerCase()));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.vehicleId || !form.description || !form.occurredAt) { toast.error("اختر المركبة واكتب وصف الحادث وتاريخه"); return; }
    const vehicle = vehicles.find(row => row.id === Number(form.vehicleId));
    const driver = drivers.find(row => row.id === Number(form.driverId));
    if (!vehicle) { toast.error("المركبة المختارة غير متاحة"); return; }
    setUploading(true);
    try {
      let najmReportUrl: string | null = null;
      if (form.reportFile instanceof File) najmReportUrl = await readUploadDataUrl(form.reportFile);
      createAccident.mutate({ ref: `AC-${Date.now()}`, vehicleId: vehicle.id, vehiclePlate: vehicle.plate, driverId: driver?.id ?? null, driverName: driver?.name ?? "—", occurredAt: String(form.occurredAt), location: String(form.location || "—"), description: String(form.description), najmReportNo: String(form.najmReportNo || "—"), najmReportName: form.reportFile instanceof File ? form.reportFile.name : null, najmReportUrl }, { onSuccess: () => { setForm(null); void utils.accidents.list.invalidate(); toast.success("تم تسجيل بلاغ الحادث"); }, onError: error => toast.error(`تعذر تسجيل الحادث: ${error.message}`) });
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إرفاق تقرير نجم"); }
    finally { setUploading(false); }
  };
  const openNew = () => setForm({ id: Date.now(), vehicleId: "", driverId: "", occurredAt: formatCompanyDate(), location: "", description: "", najmReportNo: "", reportFile: null });
  return <>
    <PageHeader eyebrow="التشغيل / الحوادث والتأمين" title="الحوادث" description="سجل بلاغ نجم، تحديد المسؤولية، تقدير الإصلاح، مطالبة شركة التأمين والتسوية النهائية." action="تسجيل حادث" onAction={openNew} />
    <div className="quick-metrics"><div><span>إجمالي البلاغات</span><strong>{records.length}</strong></div><div><span>قيد المعالجة</span><strong>{records.filter(item => !["مغلق", "ملغي"].includes(item.workflowStage)).length}</strong></div><div><span>مطالبات تأمين مفتوحة</span><strong className="amber-text">{records.filter(item => ["مرفوعة", "مقبولة"].includes(item.insurerClaimStatus)).length}</strong></div><div><span>مغلقة</span><strong className="green-text">{records.filter(item => item.workflowStage === "مغلق").length}</strong></div></div>
    <TableShell columns={["رقم البلاغ", "المركبة", "السائق", "تاريخ الحادث", "تقرير نجم", "المرحلة", "شركة التأمين"]} onExport={() => exportCsv(filtered, ["ref", "vehiclePlate", "driverName", "occurredAt", "najmReportNo", "workflowStage", "insurerName", "insurerClaimStatus", "estimatedRepairCost", "settlementAmount"], "accidents")} search={search} setSearch={setSearch} tabs={["الكل"]} activeTab="الكل" setActiveTab={() => {}} addLabel="تسجيل حادث" onAdd={openNew}>
      {filtered.map(row => <tr key={row.id}><td><button className="driver-name-button" onClick={() => setSelected(row)}><strong className="table-primary">{row.ref}</strong><small>عرض تفاصيل الحادث</small></button></td><td>{row.vehiclePlate}</td><td>{row.driverName || "—"}</td><td>{row.occurredAt}</td><td>{row.najmReportNo || "بانتظار التقرير"}{row.hasNajmReport ? " · مرفق" : ""}</td><td><Badge>{row.workflowStage}</Badge></td><td>{row.insurerName || "—"}</td><td className="actions-cell"><button className="btn outline" onClick={() => setSelected(row)}>التفاصيل والإجراء</button></td></tr>)}
    </TableShell>
    {form && <Modal title="تسجيل بلاغ حادث" onClose={() => setForm(null)} wide><form onSubmit={save}><div className="form-grid"><label className="field"><span>المركبة *</span><select value={form.vehicleId} onChange={event => { const chosen = vehicles.find(row => String(row.id) === event.target.value); setForm(prev => prev ? { ...prev, vehicleId: chosen?.id ?? "", driverId: chosen?.driverId ?? "" } : prev); }}><option value="">اختر مركبة</option>{vehicles.map(row => <option key={row.id} value={row.id}>{row.plate} · {row.brand} {row.model}</option>)}</select></label><label className="field"><span>السائق</span><select value={form.driverId} onChange={event => setForm(prev => prev ? { ...prev, driverId: event.target.value } : prev)}><option value="">غير محدد</option>{drivers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><Field label="تاريخ الحادث *" type="date" value={form.occurredAt} onChange={value => setForm(prev => prev ? { ...prev, occurredAt: value } : prev)} /><Field label="موقع الحادث" value={form.location} onChange={value => setForm(prev => prev ? { ...prev, location: value } : prev)} /><Field label="رقم تقرير نجم" value={form.najmReportNo} onChange={value => setForm(prev => prev ? { ...prev, najmReportNo: value } : prev)} /><Field label="وصف الحادث *" value={form.description} onChange={value => setForm(prev => prev ? { ...prev, description: value } : prev)} /><label className="field"><span>تقرير نجم / صور الضرر</span><input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={event => setForm(prev => prev ? { ...prev, reportFile: event.target.files?.[0] ?? null } : prev)} /></label>{form.reportFile && <div className="field-note">المرفق: {form.reportFile.name}</div>}</div><FormActions onCancel={() => setForm(null)} label={uploading || createAccident.isPending ? "جارٍ الحفظ..." : "حفظ بلاغ الحادث"} /></form></Modal>}
    {selected && <AccidentDetailModal accident={selected} onClose={() => setSelected(null)} />}
  </>;
}

function ReportsPage({ canAccess }: { canAccess: (key: ModuleKey) => boolean }) {
  const [location] = useLocation();
  const initialParams = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), []);
  const lastReportLocation = useRef(location);
  const skipReportUrlWrite = useRef(false);
  const companyToday = formatCompanyDate();
  const asUtcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
  const asDateInput = (date: Date) => date.toISOString().slice(0, 10);
  const [from, setFrom] = useState(initialParams.get("from") || `${companyToday.slice(0, 7)}-01`);
  const [to, setTo] = useState(initialParams.get("to") || companyToday);
  const [section, setSection] = useState(initialParams.get("report") || "claims");
  const [search, setSearch] = useState(initialParams.get("q") || "");
  const [status, setStatus] = useState(initialParams.get("status") || "");
  const [scope, setScope] = useState(initialParams.get("scope") || "");
  const [agingBucket, setAgingBucket] = useState(initialParams.get("aging") || "");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(() => {
    const key = initialParams.get("sort");
    const direction = initialParams.get("direction");
    return key && (direction === "asc" || direction === "desc") ? { key, direction } : null;
  });
  const validRange = from <= to;
  const { data, isFetching } = trpc.reports.summary.useQuery({ from, to }, { staleTime: 15000, enabled: validRange });
  const report = data as ReportData | undefined;
  const comparisonPeriod = validRange ? previousReportPeriod({ from, to }) : null;
  const { data: previousData, isFetching: isFetchingPrevious } = trpc.reports.summary.useQuery(comparisonPeriod ?? { from, to }, { staleTime: 15000, enabled: validRange && Boolean(report) });
  const previousReport = previousData as ReportData | undefined;
  const sections: Record<string, { title: string; rows: Row[]; columns: string[]; labels: string[] }> = {
    payments: { title: "دفعات التحصيل خلال الفترة", rows: report?.details.payments ?? [], columns: ["paidAt", "client", "contract", "claim", "amount", "method", "reference"], labels: ["تاريخ التحصيل", "العميل", "العقد", "المطالبة", "المبلغ", "طريقة الدفع", "المرجع"] },
    receivablesAging: { title: "أعمار المستحقات الحالية", rows: report?.details.receivablesAging ?? [], columns: ["ref", "client", "status", "amount", "paid", "outstanding", "due", "daysOverdue", "agingBucket"], labels: ["المطالبة", "العميل", "الحالة", "قيمة المطالبة", "المدفوع", "الرصيد المفتوح", "تاريخ الاستحقاق", "أيام التأخير", "فئة العمر"] },
    claims: { title: "المطالبات الصادرة خلال الفترة", rows: report?.details.claims ?? [], columns: ["ref", "client", "status", "amount", "paidInPeriod", "outstandingNow", "due"], labels: ["المطالبة", "العميل", "الحالة", "قيمة المطالبة", "المحصل بالفترة", "المتبقي الآن", "الاستحقاق"] },
    contracts: { title: "العقود المبدوءة خلال الفترة", rows: report?.details.contracts ?? [], columns: ["ref", "client", "status", "total", "collectedInPeriod", "startDate", "expiry"], labels: ["العقد", "العميل", "الحالة", "قيمة العقد", "المحصل بالفترة", "البداية", "الانتهاء"] },
    payables: { title: "فواتير الموردين الصادرة خلال الفترة", rows: report?.details.payables ?? [], columns: ["ref", "supplier", "status", "amount", "paidInPeriod", "remainingNow", "pendingApprovalAmount", "issueDate", "dueDate"], labels: ["الفاتورة", "المورد", "الحالة", "القيمة", "المسدد بالفترة", "المتبقي المعتمد", "قيد الاعتماد", "تاريخ الفاتورة", "الاستحقاق"] },
    maintenance: { title: "أوامر الصيانة خلال الفترة", rows: report?.details.maintenance ?? [], columns: ["ref", "vehicle", "status", ...(canAccess("finance") ? ["estimatedCost", ...(canAccess("payables") ? ["invoicedCost", "costVariance", "invoiceCount"] : [])] : []), "start", "expectedReturn"], labels: ["الطلب", "المركبة", "الحالة", ...(canAccess("finance") ? ["التقدير المعتمد", ...(canAccess("payables") ? ["الفواتير المعتمدة", "الفرق عن التقدير", "عدد الفواتير"] : [])] : []), "الدخول", "العودة المتوقعة"] },
    vehicleProfitability: { title: "تكلفة وعائد كل باص", rows: report?.details.vehicleProfitability ?? [], columns: ["plate", "expense", "revenue", "purchaseInPeriod", "netReturn", "busCount"], labels: ["الباص", "المصروف بالفترة", "الإيراد المحصل المخصص", "الشراء بالفترة", "الصافي النقدي", "عدد الباصات"] },
    projectProfitability: { title: "التشغيل حسب المشروع", rows: report?.details.projectProfitability ?? [], columns: ["name", "expense", "revenue", "netOperatingResult", "busCount"], labels: ["المشروع", "المصروفات", "الإيراد المحصل المخصص", "صافي التشغيل*", "عدد الباصات"] },
    clientProfitability: { title: "التشغيل حسب العميل", rows: report?.details.clientProfitability ?? [], columns: ["name", "expense", "revenue", "netOperatingResult", "busCount"], labels: ["العميل", "المصروفات", "الإيراد المحصل المخصص", "صافي التشغيل*", "عدد الباصات"] },
    operatingExpenses: { title: "تفاصيل مصروفات التشغيل", rows: report?.details.operatingExpenses ?? [], columns: ["spentAt", "vehicle", "category", "description", "vendor", "amount", "projectName", "clientName"], labels: ["التاريخ", "المركبة", "الفئة", "الوصف", "المورد", "المبلغ", "المشروع", "العميل"] },
    employees: { title: "الموظفون", rows: report?.details.employees ?? [], columns: ["employeeNo", "name", "department", "jobTitle", "hireDate", "status"], labels: ["رقم الموظف", "الاسم", "الإدارة", "المسمى الوظيفي", "تاريخ التعيين", "الحالة"] },
    drivers: { title: "السائقون", rows: report?.details.drivers ?? [], columns: ["name", "status", "vehicle", "renewal", "renewalStatus"], labels: ["السائق", "الحالة", "المركبة", "تاريخ تجديد الرخصة", "حالة الرخصة"] },
  };
  const sectionModules: Record<string, ModuleKey[]> = {
    payments: ["finance"], receivablesAging: ["finance"], claims: ["finance"], contracts: ["finance"], payables: ["payables"], maintenance: ["maintenance"],
    vehicleProfitability: ["finance", "vehicles"], projectProfitability: ["finance", "projects"],
    clientProfitability: ["finance", "clients"], operatingExpenses: ["finance", "vehicles"],
    employees: ["employees"], drivers: ["drivers"],
  };
  const visibleSections = Object.fromEntries(Object.entries(sections).filter(([key]) => sectionModules[key].every(canAccess)));
  const activeSection = visibleSections[section] ? section : Object.keys(visibleSections)[0] ?? "";
  useEffect(() => {
    if (location === lastReportLocation.current) return;
    lastReportLocation.current = location;
    skipReportUrlWrite.current = true;
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    const candidateFrom = params.get("from") || `${companyToday.slice(0, 7)}-01`;
    const candidateTo = params.get("to") || companyToday;
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    setFrom(validDate(candidateFrom) ? candidateFrom : `${companyToday.slice(0, 7)}-01`);
    setTo(validDate(candidateTo) ? candidateTo : companyToday);
    const requestedSection = params.get("report") || "claims";
    setSection(visibleSections[requestedSection] ? requestedSection : Object.keys(visibleSections)[0] ?? "");
    setSearch(params.get("q") || "");
    setStatus(params.get("status") || "");
    setScope(params.get("scope") || "");
    setAgingBucket(params.get("aging") || "");
    const sortKey = params.get("sort");
    const sortDirection = params.get("direction");
    setSort(sortKey && (sortDirection === "asc" || sortDirection === "desc") ? { key: sortKey, direction: sortDirection } : null);
  }, [location, companyToday, visibleSections]);
  useEffect(() => {
    if (skipReportUrlWrite.current) { skipReportUrlWrite.current = false; return; }
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (visibleSections[activeSection]) params.set("report", activeSection);
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (scope) params.set("scope", scope);
    if (agingBucket) params.set("aging", agingBucket);
    if (sort) { params.set("sort", sort.key); params.set("direction", sort.direction); }
    const next = `/dashboard/reports?${params.toString()}`;
    if (`${location}` !== next) window.history.replaceState(window.history.state, "", next);
  }, [location, from, to, activeSection, search, status, scope, agingBucket, sort, visibleSections]);
  const current = visibleSections[activeSection];
  const contextualKey: Record<string, string> = { payments: "client", receivablesAging: "client", claims: "client", contracts: "client", payables: "supplier", maintenance: "vehicle", vehicleProfitability: "plate", projectProfitability: "name", clientProfitability: "name", operatingExpenses: "category", employees: "department", drivers: "renewalStatus" };
  const contextualLabel: Record<string, string> = { payments: "العميل", receivablesAging: "العميل", claims: "العميل", contracts: "العميل", payables: "المورد", maintenance: "المركبة", vehicleProfitability: "المركبة", projectProfitability: "المشروع", clientProfitability: "العميل", operatingExpenses: "الفئة", employees: "الإدارة", drivers: "حالة الرخصة" };
  const categoryKey = contextualKey[activeSection];
  const normalizedReportSearch = normalizeQuickSearch(search);
  const uniqueValues = (key: string) => Array.from(new Set((current?.rows ?? []).map(row => String(row[key] ?? "")).filter(value => value && value !== "—"))).sort((a, b) => a.localeCompare(b, "ar"));
  const visibleRows = (current?.rows ?? []).filter(row => {
    const matchesSearch = !normalizedReportSearch || current.columns.some(column => normalizeQuickSearch(row[column]).includes(normalizedReportSearch));
    const matchesStatus = !status || String(row.status ?? "") === status;
    const matchesScope = !scope || String(row[categoryKey] ?? "") === scope;
    const matchesAgingBucket = activeSection !== "receivablesAging" || !agingBucket || String(row.agingBucket ?? "") === agingBucket;
    return matchesSearch && matchesStatus && matchesScope && matchesAgingBucket;
  }).sort((a, b) => {
    if (!sort) return 0;
    const left = a[sort.key]; const right = b[sort.key];
    const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""), "ar", { numeric: true, sensitivity: "base" });
    return sort.direction === "asc" ? comparison : -comparison;
  });
  const totalFields: Record<string, Array<{ key: string; label: string }>> = {
    payments: [{ key: "amount", label: "إجمالي التحصيل" }],
    receivablesAging: [{ key: "amount", label: "قيمة المطالبات" }, { key: "paid", label: "المدفوع" }, { key: "outstanding", label: "الرصيد المفتوح" }],
    claims: [{ key: "amount", label: "إجمالي المطالبات" }, { key: "paidInPeriod", label: "المحصل بالفترة" }, { key: "outstandingNow", label: "المتبقي الآن" }],
    contracts: [{ key: "total", label: "قيمة العقود" }, { key: "collectedInPeriod", label: "المحصل بالفترة" }],
    payables: [{ key: "amount", label: "إجمالي الفواتير" }, { key: "paidInPeriod", label: "المسدد بالفترة" }, { key: "remainingNow", label: "المتبقي المعتمد" }, { key: "pendingApprovalAmount", label: "فواتير قيد الاعتماد" }],
    maintenance: canAccess("finance") ? [{ key: "estimatedCost", label: "إجمالي التقدير" }, ...(canAccess("payables") ? [{ key: "invoicedCost", label: "إجمالي الفواتير المعتمدة" }, { key: "costVariance", label: "الفرق عن التقدير" }] : [])] : [],
    vehicleProfitability: [{ key: "expense", label: "المصروف" }, { key: "revenue", label: "الإيراد" }, { key: "purchaseInPeriod", label: "شراء الأصول" }, { key: "netReturn", label: "الصافي النقدي" }],
    projectProfitability: [{ key: "expense", label: "المصروف" }, { key: "revenue", label: "الإيراد" }, { key: "netOperatingResult", label: "صافي التشغيل" }],
    clientProfitability: [{ key: "expense", label: "المصروف" }, { key: "revenue", label: "الإيراد" }, { key: "netOperatingResult", label: "صافي التشغيل" }],
    operatingExpenses: [{ key: "amount", label: "إجمالي المصروفات" }],
  };
  const toAmount = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const digits: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
    const normalized = String(value ?? "").replace(/[٠-٩]/g, digit => digits[digit]).replace(/[٬,]/g, "").replace(/[^0-9.\-]/g, "");
    return Number(normalized) || 0;
  };
  const filteredTotals = (totalFields[activeSection] ?? []).map(field => ({ ...field, value: visibleRows.reduce((sum, row) => sum + toAmount(row[field.key]), 0) }));
  const setPeriod = (days: number | "month" | "quarter" | "year") => {
    const endValue = formatCompanyDate();
    const start = asUtcDate(endValue);
    if (days === "month") start.setUTCDate(1);
    else if (days === "quarter") start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
    else if (days === "year") start.setUTCMonth(0, 1);
    else start.setUTCDate(start.getUTCDate() - days + 1);
    setFrom(asDateInput(start)); setTo(endValue);
  };
  const switchSection = (key: string) => { setSection(key); setSearch(""); setStatus(""); setScope(""); setAgingBucket(""); setSort(null); };
  return <>
    <PageHeader eyebrow="الإدارة / التقارير" title="التقارير" description="ملخص موحد للأسطول والمالية والصيانة والمشاريع والموظفين ضمن فترة قابلة للتحديد والتصدير." />
    <div className="surface report-period-panel"><div className="report-period-head"><div><strong>نطاق التقرير</strong><span>اختر فترة جاهزة أو حدّد التواريخ يدويًا</span></div><div className="report-presets">{[["اليوم", 1], ["7 أيام", 7], ["30 يومًا", 30], ["هذا الشهر", "month"], ["هذا الربع", "quarter"], ["هذه السنة", "year"]].map(([label, days]) => <button key={String(label)} className="report-preset" onClick={() => setPeriod(days as number | "month" | "quarter" | "year")}>{label}</button>)}</div></div><div className="report-period-fields"><Field label="من تاريخ" type="date" value={from} onChange={setFrom} /><Field label="إلى تاريخ" type="date" value={to} onChange={setTo} /><div className="report-fetch-state"><span className={`report-state-dot ${isFetching ? "loading" : validRange && report ? "ready" : "error"}`} /><span>{!validRange ? "نطاق التاريخ غير صالح" : isFetching ? "جارٍ تحديث التقرير…" : report ? `${report.period.from} — ${report.period.to}` : "تعذر تحميل البيانات"}</span></div></div>{!validRange && <div className="report-range-error">تاريخ البداية يجب أن يسبق تاريخ النهاية أو يساويه.</div>}</div>
    {report && <>
      <div className="metrics-grid">
        {canAccess("vehicles") && <><MetricCard title="إجمالي الأسطول" value={String(report.fleet.total)} helper={report.fleet.working + " تعمل · " + report.fleet.ready + " جاهزة"} icon={CarFront} tone="teal" /><MetricCard title="في الصيانة / متوقفة" value={report.fleet.maintenance + " / " + report.fleet.stopped} helper="الحالة الحالية" icon={Wrench} tone="orange" /></>}
        {canAccess("finance") && <MetricCard title="المطالبات غير المحصلة" value={formatSAR(report.finance.receivableOutstanding)} helper={"رصيد حالي · " + report.finance.unpaidClaims + " مطالبة · " + report.finance.overdueClaims + " متأخرة"} icon={CircleDollarSign} tone="blue" />}
        {canAccess("payables") && <MetricCard title="المستحقات على الشركة" value={formatSAR(report.finance.payablesOutstanding)} helper={"رصيد حالي معتمد · " + report.finance.overduePayables + " فاتورة متأخرة"} icon={ArrowUpLeft} tone="orange" />}
        {canAccess("payables") && report.finance.payablesPendingApproval > 0 && <MetricCard title="فواتير بانتظار اعتماد المالية" value={formatSAR(report.finance.payablesPendingApprovalAmount)} helper={`${report.finance.payablesPendingApproval.toLocaleString("en-US")} فاتورة مرفوعة ولم تُعتمد بعد`} icon={Clock3} tone="violet" />}
        {canAccess("finance") && <MetricCard title="التحصيل بالفترة" value={formatSAR(report.finance.incomingInPeriod)} helper="الدفعات الواردة المسجلة ضمن الفترة" icon={ArrowDownLeft} tone="blue" />}
        {canAccess("payables") && <MetricCard title="الصرف بالفترة" value={formatSAR(report.finance.outgoingInPeriod)} helper="الدفعات الصادرة المسجلة ضمن الفترة" icon={Activity} tone="violet" />}
        {canAccess("finance") && canAccess("vehicles") && <MetricCard title="تكلفة / إيراد تشغيل الباصات" value={formatSAR(report.finance.vehicleCostsInPeriod) + " / " + formatSAR(report.finance.allocatedVehicleRevenueInPeriod)} helper={"الصافي مع الشراء المسجل بالفترة " + formatSAR(report.finance.fleetVehicleNetInPeriod)} icon={CarFront} tone="teal" />}
        {canAccess("projects") && <MetricCard title="المشاريع النشطة" value={String(report.projects.activeNow)} helper={canAccess("vehicles") ? report.projects.assignedVehicles + " مركبة مسندة · " + report.projects.requiredVehicles + " مطلوبة" : report.projects.requiredVehicles + " مركبة مطلوبة"} icon={Truck} tone="blue" />}
      </div>
      {comparisonPeriod && <section className="surface report-comparison"><div className="section-head"><div><h2>مقارنة بالفترة السابقة</h2><span>مقارنة الفترة {from} — {to} بالفترة المساوية لها {comparisonPeriod.from} — {comparisonPeriod.to}</span></div><span className={`report-state-dot ${isFetchingPrevious ? "loading" : previousReport ? "ready" : "error"}`} aria-label={isFetchingPrevious ? "جار تحميل المقارنة" : previousReport ? "المقارنة جاهزة" : "تعذرت المقارنة"} /></div>{previousReport ? <div className="report-comparison-grid">{[
        ...(canAccess("finance") ? [{ key: "incoming", label: "التحصيل الوارد", current: report.finance.incomingInPeriod, previous: previousReport.finance.incomingInPeriod, increaseIsFavorable: true }] : []),
        ...(canAccess("payables") ? [{ key: "outgoing", label: "الصرف للموردين", current: report.finance.outgoingInPeriod, previous: previousReport.finance.outgoingInPeriod, increaseIsFavorable: false }] : []),
        ...(canAccess("maintenance") ? [{ key: "maintenance", label: "تكلفة الصيانة", current: report.maintenance.costInPeriod, previous: previousReport.maintenance.costInPeriod, increaseIsFavorable: false }] : []),
      ].map(item => { const comparison = compareReportMetric(item.current, item.previous, item.increaseIsFavorable); const trend = comparison.direction === "up" ? `زيادة ${comparison.percent}%` : comparison.direction === "down" ? `انخفاض ${comparison.percent}%` : comparison.direction === "new" ? "بدأ التسجيل" : "دون تغير"; return <div className="report-comparison-item" key={item.key}><span>{item.label}</span><strong>{formatSAR(item.current)}</strong><small className={comparison.tone}>{trend} · السابقة {formatSAR(item.previous)}</small></div>; })}</div> : <div className="field-note">{isFetchingPrevious ? "جار تحميل بيانات المقارنة…" : "تعذر تحميل الفترة السابقة؛ تبقى أرقام الفترة الحالية متاحة."}</div>}</section>}
      <div className="quick-metrics">
        {canAccess("finance") && <div><span>عقود جديدة بالفترة</span><strong>{formatSAR(report.finance.contractsValueInPeriod)}</strong></div>}
        {canAccess("maintenance") && <div><span>أوامر صيانة بالفترة</span><strong>{report.maintenance.openedInPeriod.toLocaleString("en-US")}</strong></div>}
        {canAccess("maintenance") && canAccess("finance") && <div><span>إنفاق الصيانة المثبت بالفترة</span><strong>{formatSAR(report.maintenance.costInPeriod)}</strong></div>}
        {canAccess("employees") && <div><span>الموظفون النشطون</span><strong>{report.people.activeEmployees.toLocaleString("en-US")}</strong></div>}
        {canAccess("drivers") && <div><span>السائقون المتاحون</span><strong>{report.people.availableDrivers.toLocaleString("en-US")}</strong></div>}
        {canAccess("documents") && <><div><span>مستندات تنتهي خلال الفترة</span><strong className="amber-text">{report.documents.expiringInPeriod.toLocaleString("en-US")}</strong></div><div><span>مستندات منتهية الآن</span><strong className="red-text">{report.documents.expiredNow.toLocaleString("en-US")}</strong></div></>}
      </div>
      {current ? <section className="surface report-detail-panel">
        <div className="section-head"><div><h2>{current.title}</h2><span>{visibleRows.length.toLocaleString("en-US")} من {current.rows.length.toLocaleString("en-US")} سجل · {activeSection === "employees" || activeSection === "drivers" || activeSection === "receivablesAging" ? "لقطة من الحالة أو الرصيد الحالي" : "التصدير يحترم الفلاتر الحالية"}</span></div><button className="btn outline" disabled={!visibleRows.length} onClick={() => exportCsv(appendReportSummary(visibleRows, current.columns, filteredTotals), current.columns, "zaity-" + activeSection + "-" + (activeSection === "employees" || activeSection === "drivers" || activeSection === "receivablesAging" ? "snapshot" : `${from}-${to}`), current.labels)}><Download size={15} />تصدير مع الإجمالي</button></div>
        <div className="report-scope-note"><strong>نطاق الأرقام</strong><span>بطاقات الملخص والمقارنة أعلاه تعرض إجمالي الفترة أو الرصيد الحالي ولا تتأثر بمرشحات هذا الجدول. الأرقام في «إجماليات النتائج المطابقة» والتصدير أدناه تخص الصفوف التي تطابق المرشحات فقط.</span></div>
        {activeSection === "receivablesAging" && <div className="field-note">يعرض هذا التقرير المطالبات ذات الرصيد المفتوح فقط. يُحسب التأخير بحسب تقويم الشركة: غير مستحق، 1–30 يومًا، 31–60 يومًا، وأكثر من 60 يومًا. الرصيد لقطة حالية ولا يتغير مع الفترة المختارة.</div>}
        {activeSection === "maintenance" && canAccess("finance") && <div className="field-note">التقدير المعتمد = عرض الورشة + قطع الغيار. الفواتير المعتمدة تجمع الفواتير المرتبطة بطلب الصيانة بعد اعتمادها؛ الفواتير الجديدة أو الملغاة مستبعدة. يظهر الفرق فقط عند وجود فاتورة معتمدة. الفترة تحدد طلبات الصيانة التي بدأت خلالها، وقد تكون فواتيرها اعتمدت لاحقًا.</div>}
        <div className="field-note">* صافي التشغيل للمشروع والعميل = الإيراد المحصل المخصص − مصروفات التشغيل، ولا يتضمن سعر شراء المركبات حتى لا يوزع سعر الأصل على فترة تشغيل اعتباطية. أرقام الباصات تحسب سعر الشراء فقط إذا وقع تاريخ الشراء ضمن الفترة. أرصدة المطالبات وفواتير الموردين معروضة حتى اليوم، أما التحصيل والسداد فمحسوبان للفترة المحددة. إنفاق الصيانة في المؤشر يتبع تاريخ الفاتورة أو قيد المصروف؛ أما جدول الأوامر فيعرض تكلفة الطلبات التي بدأت خلال الفترة.</div>
        <div className="finance-switch report-section-tabs">{Object.entries(visibleSections).map(([key, item]) => <button key={key} className={activeSection === key ? "active" : ""} onClick={() => switchSection(key)}>{item.title}</button>)}</div>
        <div className="report-filter-grid"><label className="report-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في نتائج التقرير…" /></label>{current.columns.includes("status") && <label className="field"><span>الحالة</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">كل الحالات</option>{uniqueValues("status").map(value => <option key={value} value={value}>{value}</option>)}</select></label>}<label className="field"><span>{contextualLabel[activeSection]}</span><select value={scope} onChange={event => setScope(event.target.value)}><option value="">الكل</option>{uniqueValues(categoryKey).map(value => <option key={value} value={value}>{value}</option>)}</select></label>{activeSection === "receivablesAging" && <label className="field"><span>عمر المستحق</span><select value={agingBucket} onChange={event => setAgingBucket(event.target.value)}><option value="">كل الفئات</option>{uniqueValues("agingBucket").map(value => <option key={value} value={value}>{value}</option>)}</select></label>}<button className="btn ghost report-reset" onClick={() => { setSearch(""); setStatus(""); setScope(""); setAgingBucket(""); setSort(null); }}>مسح الفلاتر</button></div>
        {filteredTotals.length > 0 && <><div className="report-filter-total-heading"><strong>إجماليات النتائج المطابقة</strong><span>تُعاد حسابها بعد كل تغيير في البحث أو الفلاتر</span></div><div className="quick-metrics report-filter-totals"><div><span>السجلات المطابقة</span><strong>{visibleRows.length.toLocaleString("en-US")}</strong></div>{filteredTotals.map(total => <div key={total.key}><span>{total.label}</span><strong>{formatSAR(total.value)}</strong></div>)}</div></>}
        <div className="table-scroll"><table><thead><tr>{current.labels.map((label, index) => { const key = current.columns[index]; return <th key={key}><button className="report-sort" onClick={() => setSort(previous => previous?.key === key ? { key, direction: previous.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" })}>{label}{sort?.key === key ? sort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>; })}</tr></thead><tbody>{visibleRows.length ? visibleRows.map((row, rowIndex) => <tr key={row.id ?? activeSection + "-" + rowIndex}>{current.columns.map(column => <td key={column}>{typeof row[column] === "number" && ["amount", "paid", "remaining", "outstanding", "paidInPeriod", "outstandingNow", "remainingNow", "pendingApprovalAmount", "total", "collected", "collectedInPeriod", "expense", "revenue", "purchaseInPeriod", "netReturn", "netOperatingResult", "estimatedCost", "invoicedCost", "costVariance"].includes(column) ? formatSAR(row[column]) : row[column] ?? "—"}</td>)}</tr>) : <tr><td colSpan={current.columns.length}><div className="report-empty">لا توجد نتائج تطابق الفلاتر الحالية.</div></td></tr>}</tbody></table></div>
      </section> : <section className="surface report-detail-panel"><div className="empty-state"><strong>لا توجد بيانات تقارير متاحة لحسابك</strong><span>تواصل مع مدير النظام لإضافة صلاحيات الوحدات التي تحتاجها.</span></div></section>}
    </>}
  </>;
}

type PayableRow = Row & { ref: string; supplier: string; description: string; amount: number; paid: number; remaining: number; issueDate: string; dueDate: string; status: string; overdue: boolean; vehicleId?: number | null; maintenanceRequestId?: number | null; vehicleCategory?: string | null; receiptName?: string | null; receiptUrl?: string | null; hasReceipt?: boolean; payments: Array<{ id: number; amount: number; paidAt: string; method: string; reference: string }> };
function PayablesPage({ canAccess, vehicles, prefillMaintenanceRequest, onPrefillConsumed }: { canAccess: (key: ModuleKey) => boolean; vehicles: Vehicle[]; prefillMaintenanceRequest: Maintenance | null; onPrefillConsumed: () => void }) {
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const { data: data = [] } = trpc.payables.list.useQuery(undefined, { staleTime: 15000 });
  const { data: maintenanceData = [] } = trpc.maintenance.list.useQuery(undefined, { staleTime: 15000, enabled: canAccess("maintenance") });
  const createPayable = trpc.payables.create.useMutation();
  const updatePayable = trpc.payables.update.useMutation();
  const updateStatus = trpc.payables.updateStatus.useMutation();
  const registerPayment = trpc.payables.registerPayment.useMutation();
  const payables = data as PayableRow[];
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [bill, setBill] = useState<Row | null>(null);
  const [paymentFor, setPaymentFor] = useState<PayableRow | null>(null);
  const [historyFor, setHistoryFor] = useState<PayableRow | null>(null);
  const [payment, setPayment] = useState<Row>({ id: 0, amount: 0, paidAt: formatCompanyDate(), method: "تحويل بنكي", reference: "—", notes: "" });
  useEffect(() => {
    const payableId = new URLSearchParams(location.split("?")[1] ?? "").get("payable");
    if (!payableId) return;
    setSearch(payableId);
    setTab("الكل");
    requestAnimationFrame(() => document.querySelector(".table-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [location]);
  const blank = (): Row => ({ id: Date.now(), ref: `AP-${formatCompanyDate().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`, supplier: "", description: "", amount: 0, issueDate: formatCompanyDate(), dueDate: "", notes: "", vehicleId: null, maintenanceRequestId: null, vehicleCategory: "أخرى", receiptName: "", receiptUrl: "" });
  const maintenanceRequests = maintenanceData as Maintenance[];
  useEffect(() => {
    if (!prefillMaintenanceRequest) return;
    setBill({ ...blank(), supplier: String(prefillMaintenanceRequest.workshop || ""), description: `${prefillMaintenanceRequest.type || "صيانة"} · ${prefillMaintenanceRequest.reason || "فاتورة صيانة"}`.slice(0, 300), vehicleId: prefillMaintenanceRequest.vehicleId ?? null, maintenanceRequestId: prefillMaintenanceRequest.id, vehicleCategory: "صيانة" });
    onPrefillConsumed();
  }, [prefillMaintenanceRequest?.id]);
  const rows = payables.filter(row => matchesQuickSearch(row, search) && (tab === "الكل" || (tab === "متأخرة" ? row.overdue : row.status === tab)));
  const invalidate = () => { utils.payables.list.invalidate(); utils.vehicles.list.invalidate(); utils.vehicles.financeProfile.invalidate(); utils.maintenance.list.invalidate(); utils.reports.summary.invalidate(); };
  const openPayableReceipt = async (row: PayableRow) => { try { const file = await utils.payables.receipt.fetch({ id: row.id }); if (!file?.url) { toast.error("لم يتم العثور على الفاتورة"); return; } const link = document.createElement("a"); link.href = file.url; link.download = file.name; link.target = "_blank"; link.click(); } catch (error: any) { toast.error(error.message || "تعذر فتح الفاتورة"); } };
  const saveBill = (event: React.FormEvent) => {
    event.preventDefault();
    if (!bill?.supplier || !bill?.description || Number(bill.amount) <= 0) { toast.error("أدخل المورد والوصف ومبلغًا صالحًا"); return; }
    const { id, ...raw } = bill;
    const payload = { ...raw, amount: Number(raw.amount), vehicleId: raw.vehicleId ? Number(raw.vehicleId) : null, maintenanceRequestId: raw.maintenanceRequestId ? Number(raw.maintenanceRequestId) : null, vehicleCategory: raw.vehicleId ? raw.vehicleCategory : null } as any;
    const onSuccess = () => { invalidate(); setBill(null); toast.success(bill.maintenanceRequestId ? "تم تسجيل الفاتورة وربطها بطلب الصيانة؛ تظهر تكلفتها الفعلية بعد اعتمادها" : bill.vehicleId ? "تم حفظ الفاتورة وربط تكلفتها بملف الباص" : "تم حفظ فاتورة المورد"); };
    if (payables.some(row => row.id === id)) updatePayable.mutate({ id, data: payload }, { onSuccess, onError: error => toast.error(error.message) });
    else createPayable.mutate(payload, { onSuccess, onError: error => toast.error(error.message) });
  };
  const approve = (row: PayableRow) => updateStatus.mutate({ id: row.id, status: "معتمدة" }, { onSuccess: () => { invalidate(); toast.success("تم اعتماد الفاتورة ويمكن الآن تسجيل الصرف"); }, onError: error => toast.error(error.message) });
  const cancel = (row: PayableRow) => updateStatus.mutate({ id: row.id, status: "ملغاة" }, { onSuccess: () => { invalidate(); toast.success("تم إلغاء الفاتورة"); }, onError: error => toast.error(error.message) });
  const submitPayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentFor || Number(payment.amount) <= 0 || Number(payment.amount) > paymentFor.remaining) { toast.error("تحقق من مبلغ الصرف؛ لا يمكن أن يتجاوز الرصيد المتبقي"); return; }
    registerPayment.mutate({ payableId: paymentFor.id, amount: Number(payment.amount), paidAt: String(payment.paidAt), method: String(payment.method), reference: String(payment.reference || "—"), notes: String(payment.notes || "") }, { onSuccess: () => { invalidate(); setPaymentFor(null); toast.success("تم تسجيل الدفعة وتحديث الرصيد"); }, onError: error => toast.error(error.message) });
  };
  const isRecognizedLiability = (row: PayableRow) => ["معتمدة", "مدفوعة جزئيًا", "مدفوعة"].includes(row.status);
  const outstanding = payables.filter(isRecognizedLiability).reduce((sum, row) => sum + row.remaining, 0);
  const pendingApproval = payables.filter(row => row.status === "جديدة");
  const pendingApprovalAmount = pendingApproval.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const overdueTotal = payables.filter(row => row.overdue).reduce((sum, row) => sum + row.remaining, 0);
  return <>
    <PageHeader eyebrow="المالية / الذمم الدائنة" title="المبالغ المستحقة علينا" description="سجل فواتير الموردين واعتمادها ثم تتبع المدفوعات الصادرة والرصيد المتبقي بسجل مستقل." action="إضافة فاتورة مورد" onAction={() => setBill(blank())} />
    <div className="quick-metrics"><div><span>إجمالي الرصيد المعتمد</span><strong>{formatSAR(outstanding)}</strong></div><div><span>قيمة فواتير بانتظار الاعتماد</span><strong className="amber-text">{formatSAR(pendingApprovalAmount)}</strong><small>{pendingApproval.length.toLocaleString("en-US")} فاتورة تنتظر مراجعة المالية</small></div><div><span>أرصدة معتمدة متأخرة</span><strong className="red-text">{formatSAR(overdueTotal)}</strong></div><div><span>فواتير مسجلة</span><strong>{payables.filter(row => row.status !== "ملغاة").length.toLocaleString("en-US")}</strong></div></div>
    <TableShell columns={["رقم الفاتورة", "المورد", "الوصف", "المبلغ", "المدفوع", "المتبقي المعتمد", "تاريخ الاستحقاق", "الحالة", "سجل الصرف"]} onExport={() => exportCsv(rows.map(row => ({ ...row, remaining: isRecognizedLiability(row) ? row.remaining : 0, pendingApprovalAmount: row.status === "جديدة" ? row.amount : 0 })), ["ref", "supplier", "description", "amount", "paid", "remaining", "pendingApprovalAmount", "dueDate", "status"], "payables", ["رقم الفاتورة", "المورد", "الوصف", "المبلغ", "المدفوع", "المتبقي المعتمد", "قيد الاعتماد", "الاستحقاق", "الحالة"])} search={search} setSearch={setSearch} tabs={["الكل", "جديدة", "معتمدة", "مدفوعة جزئيًا", "مدفوعة", "متأخرة", "ملغاة"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة فاتورة" onAdd={() => setBill(blank())}>
      {rows.map(row => <tr key={row.id}><td><strong className="table-primary">{row.ref}</strong><small>{row.issueDate}</small></td><td>{row.supplier}</td><td>{row.description}{row.vehicleId && <small>مربوطة بالباص · {vehicles.find(vehicle => vehicle.id === row.vehicleId)?.plate || `#${row.vehicleId}`} · {row.vehicleCategory}</small>}{row.maintenanceRequestId && <small>أمر الصيانة · {maintenanceRequests.find(request => request.id === row.maintenanceRequestId)?.ref || `#${row.maintenanceRequestId}`}</small>}{row.hasReceipt && <button className="text-link" onClick={() => openPayableReceipt(row)}>فتح الفاتورة المرفقة</button>}</td><td>{formatSAR(row.amount)}</td><td>{formatSAR(row.paid)}</td><td>{isRecognizedLiability(row) ? formatSAR(row.remaining) : <><span>—</span>{row.status === "جديدة" && <small>بانتظار اعتماد المالية</small>}</>}</td><td className={row.overdue ? "red-text" : ""}>{row.dueDate}{row.overdue && <small className="red-text">متأخرة</small>}</td><td><Badge>{row.status}</Badge></td><td><button className="text-link" onClick={() => setHistoryFor(row)}>{row.payments.length.toLocaleString("en-US")} دفعة · التفاصيل</button></td><td className="actions-cell">{row.status === "جديدة" && <button className="btn outline" onClick={() => approve(row)}>اعتماد</button>}{["معتمدة", "مدفوعة جزئيًا"].includes(row.status) && <button className="btn primary" onClick={() => { setPayment({ id: 0, amount: row.remaining, paidAt: formatCompanyDate(), method: "تحويل بنكي", reference: "—", notes: "" }); setPaymentFor(row); }}>تسجيل صرف</button>}{["جديدة", "معتمدة"].includes(row.status) && <button className="btn ghost" onClick={() => cancel(row)}>إلغاء</button>}<button className="row-menu-btn" title="تعديل الفاتورة" onClick={() => setBill({ ...row })}><Pencil size={15} /></button></td></tr>)}
    </TableShell>
    {bill && <Modal title={payables.some(row => row.id === bill.id) ? "تعديل فاتورة مورد" : "إضافة فاتورة مورد"} onClose={() => setBill(null)} wide><form onSubmit={saveBill}><div className="form-grid"><Field label="رقم الفاتورة" value={bill.ref} onChange={value => setBill(prev => prev ? ({ ...prev, ref: value }) : prev)} /><Field label="اسم المورد *" value={bill.supplier} onChange={value => setBill(prev => prev ? ({ ...prev, supplier: value }) : prev)} /><Field label="وصف الفاتورة *" value={bill.description} onChange={value => setBill(prev => prev ? ({ ...prev, description: value }) : prev)} /><Field label="قيمة الفاتورة (SAR) *" type="number" value={String(bill.amount ?? 0)} onChange={value => setBill(prev => prev ? ({ ...prev, amount: Number(value) }) : prev)} /><Field label="تاريخ الإصدار" type="date" value={bill.issueDate} onChange={value => setBill(prev => prev ? ({ ...prev, issueDate: value }) : prev)} /><Field label="تاريخ الاستحقاق" type="date" value={bill.dueDate} onChange={value => setBill(prev => prev ? ({ ...prev, dueDate: value }) : prev)} /><Field label="ملاحظات" value={bill.notes} onChange={value => setBill(prev => prev ? ({ ...prev, notes: value }) : prev)} />{canAccess("vehicles") && canAccess("finance") && <><label className="field"><span>ربط الفاتورة بباص (اختياري)</span><select value={bill.vehicleId ? String(bill.vehicleId) : ""} onChange={event => setBill(prev => prev ? ({ ...prev, vehicleId: event.target.value ? Number(event.target.value) : null, maintenanceRequestId: null }) : prev)}><option value="">فاتورة عامة / غير مرتبطة بباص</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.brand} {vehicle.model}</option>)}</select></label>{bill.vehicleId && <label className="field"><span>فئة مصروف الباص</span><select value={bill.vehicleCategory || "أخرى"} disabled={Boolean(bill.maintenanceRequestId)} onChange={event => setBill(prev => prev ? ({ ...prev, vehicleCategory: event.target.value }) : prev)}>{["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"].map(category => <option key={category}>{category}</option>)}</select><small>تدخل قيمة الفاتورة تلقائيًا في إجمالي هذا الباص، ولا حاجة لإدخالها مرة ثانية في ملف الباص.</small></label>}</>}{canAccess("maintenance") && <label className="field"><span>أمر الصيانة المرتبط</span><select value={bill.maintenanceRequestId || ""} disabled={Boolean(bill.maintenanceRequestId)} onChange={event => { const request = maintenanceRequests.find(item => String(item.id) === event.target.value); setBill(prev => prev ? ({ ...prev, maintenanceRequestId: request?.id ?? null, vehicleId: request?.vehicleId ?? prev.vehicleId, vehicleCategory: request ? "صيانة" : prev.vehicleCategory }) : prev); }}><option value="">بدون ربط بطلب صيانة</option>{maintenanceRequests.filter(request => request.vehicleId && (request.id === Number(bill.maintenanceRequestId) || (["تنفيذ", "فحص بعد الإصلاح"].includes(String(request.workflowStage)) && request.approvalStatus === "معتمد")) && (!bill.vehicleId || request.vehicleId === Number(bill.vehicleId))).map(request => <option key={request.id} value={request.id}>{request.ref} · {request.vehicle} · {request.type}</option>)}</select><small>بعد اعتماد الفاتورة تصبح قيمتها جزءًا من التكلفة الفعلية لهذا الطلب، وتظهر مرة واحدة في مصروف المركبة.</small></label>}<label className="field"><span>صورة الفاتورة (حد 700 ك.ب)</span><input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={event => { const file=event.target.files?.[0]; if(!file)return; void readUploadDataUrl(file).then(receiptUrl=>setBill(prev=>prev?({...prev,receiptName:file.name,receiptUrl}):prev)).catch(error=>toast.error(error.message)); }} />{bill.receiptName && <small>{bill.receiptName}</small>}</label></div><FormActions onCancel={() => setBill(null)} label="حفظ الفاتورة" /></form></Modal>}
    {historyFor && <Modal title={`سجل الصرف · ${historyFor.ref}`} onClose={() => setHistoryFor(null)}><div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th></tr></thead><tbody>{historyFor.payments.length ? historyFor.payments.map(entry => <tr key={entry.id}><td>{entry.paidAt}</td><td>{formatSAR(entry.amount)}</td><td>{entry.method}</td><td>{entry.reference}</td></tr>) : <tr><td colSpan={4}>لا توجد دفعات مسجلة</td></tr>}</tbody></table></div><div className="detail-footer"><button className="btn ghost" onClick={() => setHistoryFor(null)}>إغلاق</button></div></Modal>}
    {paymentFor && <Modal title={`تسجيل صرف · ${paymentFor.ref}`} onClose={() => setPaymentFor(null)}><form onSubmit={submitPayment}><p>المتبقي: <strong>{formatSAR(paymentFor.remaining)}</strong></p><div className="form-grid single"><Field label="مبلغ الصرف (SAR)" type="number" value={String(payment.amount)} onChange={value => setPayment(prev => ({ ...prev, amount: Number(value) }))} /><Field label="تاريخ الصرف" type="date" value={payment.paidAt} onChange={value => setPayment(prev => ({ ...prev, paidAt: value }))} /><label className="field"><span>طريقة الصرف</span><select value={payment.method} onChange={event => setPayment(prev => ({ ...prev, method: event.target.value }))}><option>تحويل بنكي</option><option>نقدًا</option><option>شيك</option></select></label><Field label="مرجع التحويل" value={payment.reference} onChange={value => setPayment(prev => ({ ...prev, reference: value }))} /><Field label="ملاحظات" value={payment.notes} onChange={value => setPayment(prev => ({ ...prev, notes: value }))} /></div><FormActions onCancel={() => setPaymentFor(null)} label="حفظ دفعة الصرف" /></form></Modal>}
  </>;
}

function FinancePage({ onAction, onOpenForm, contracts, claims, payments, onPaymentArchive }: { onAction: (action: string, row: Row) => void; onOpenForm: (row?: Row) => void; contracts: Contract[]; claims: Claim[]; payments: PaymentRow[]; onPaymentArchive: (payment: PaymentRow) => void }) {
  const [location, navigate] = useLocation();
  const view: "contracts" | "claims" = location.startsWith("/dashboard/financial/claims") ? "claims" : "contracts";
  const [tab, setTab] = useState("كل العقود"); const [search, setSearch] = useState(""); const [menu, setMenu] = useState<number | null>(null);
  useEffect(() => setTab(view === "contracts" ? "كل العقود" : "كل المطالبات"), [view]);
  const [paymentPeriod, setPaymentPeriod] = useState("month");
  const [paymentDateFrom, setPaymentDateFrom] = useState(() => `${formatCompanyDate().slice(0, 7)}-01`);
  const [paymentDateTo, setPaymentDateTo] = useState(() => formatCompanyDate());
  const [paymentSearch, setPaymentSearch] = useState("");
  useEffect(() => {
    const requestedPayment = new URLSearchParams(location.split("?")[1] ?? "").get("payment");
    if (!requestedPayment) return;
    setPaymentSearch(requestedPayment);
    choosePaymentPeriod("all");
    requestAnimationFrame(() => document.getElementById("finance-payment-ledger")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [location]);
  const choosePaymentPeriod = (period: string) => {
    const todayText = formatCompanyDate();
    setPaymentPeriod(period);
    if (period === "all") { setPaymentDateFrom(""); setPaymentDateTo(""); return; }
    if (period === "month") { setPaymentDateFrom(`${todayText.slice(0, 7)}-01`); setPaymentDateTo(todayText); return; }
    if (period === "year") { setPaymentDateFrom(`${todayText.slice(0, 4)}-01-01`); setPaymentDateTo(todayText); return; }
    if (period === "30days") { setPaymentDateFrom(addCalendarDays(todayText, -29)); setPaymentDateTo(todayText); }
  };
  const filteredPayments = payments.filter(payment => {
    if (!paymentDateFrom && !paymentDateTo) return true;
    const paidAt = String(payment.paidAt || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(paidAt) && (!paymentDateFrom || paidAt >= paymentDateFrom) && (!paymentDateTo || paidAt <= paymentDateTo);
  }).filter(payment => matchesQuickSearch(payment, paymentSearch));
  const isClaimOverdue = (claim: Row) => { const due = typeof claim.due === "string" ? claim.due.slice(0, 10) : ""; return /^\d{4}-\d{2}-\d{2}$/.test(due) && due < formatCompanyDate() && !["تم صرفها", "مرفوضة", "ملغاة", "غير مرفوعة"].includes(String(claim.status)); };
  const rows = view === "contracts" ? contracts : claims;
  const filtered = rows.filter(r => { const matchesSearch = matchesQuickSearch(r, search); const matchesTab = view === "contracts" ? tab === "كل العقود" || r.status === tab : tab === "كل المطالبات" || (tab === "متأخرة" ? isClaimOverdue(r) : r.status === tab); return matchesSearch && matchesTab; });
  const switchView = (nextView: "contracts" | "claims") => navigate(`/dashboard/financial/${nextView}`);
  const activeContracts = contracts.filter(contract => contract.status === "قائم");
  const totalValue = activeContracts.reduce((sum, contract) => sum + Number(contract.total || 0), 0);
  const collectedValue = activeContracts.reduce((sum, contract) => sum + Number(contract.collected || 0), 0);
  const outstandingValue = Math.max(0, totalValue - collectedValue);
  const collectionRate = totalValue ? ((collectedValue / totalValue) * 100).toFixed(1) : "0.0";
  const expiringSoon = activeContracts.filter(contract => isWithinUpcomingDays(contract.expiry, 60)).length;
  const paymentTotal = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstandingClaims = totalOutstandingClaims(claims);
  const outstandingClaimCount = countOutstandingClaims(claims);
  return <><PageHeader eyebrow="المالية / الأداء" title="المالية" description="إدارة العقود والمطالبات والتحصيل والتقارير المالية في لوحة واحدة." action={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"} onAction={() => onOpenForm(view === "claims" ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` } : undefined)} /><div className="finance-switch"><button className={view === "contracts" ? "active" : ""} onClick={() => switchView("contracts")}>العقود المالية</button><button className={view === "claims" ? "active" : ""} onClick={() => switchView("claims")}>المطالبات المالية</button><button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}>تسجيل دفعة</button></div><div className="metrics-grid finance-metrics"><MetricCard title="قيمة العقود الفعالة" value={formatSAR(totalValue)} helper={`${activeContracts.length} عقود قائمة`} icon={FileText} tone="teal" /><MetricCard title="المحصل" value={formatSAR(collectedValue)} helper={`${collectionRate}% من الإجمالي`} icon={CheckCircle2} tone="blue" /><MetricCard title="المتبقي" value={formatSAR(outstandingValue)} helper="من العقود القائمة" icon={Clock3} tone="orange" /><MetricCard title="عقود قاربت على الانتهاء" value={String(expiringSoon)} helper="خلال ٦٠ يومًا" icon={Activity} tone="violet" /></div><TableShell columns={view === "contracts" ? ["رقم العقد", "العميل", "النوع", "القيمة الإجمالية", "المحصل", "تاريخ الانتهاء", "الحالة"] : ["رقم المطالبة", "العميل", "العقد", "القيمة", "الاستحقاق", "المدفوع", "الحالة"]} onExport={() => exportCsv(filtered, Object.keys(filtered[0] || {}).filter(k => k !== "id"), view)} search={search} setSearch={setSearch} tabs={view === "contracts" ? ["كل العقود", "قائم", "مكتمل", "عرض سعر"] : ["كل المطالبات", "غير مرفوعة", "جديدة", "تحت الإجراء", "تم اعتمادها", "تم صرفها", "متأخرة", "مرفوضة", "ملغاة"]} activeTab={tab} setActiveTab={setTab} addLabel={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"} onAdd={() => onOpenForm(view === "claims" ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` } : undefined)}>{filtered.map((r: any) => view === "contracts" ? <tr key={r.id}><td><strong className="table-primary">{r.ref}</strong><small>{r.createdAt ? `أُنشئ في ${new Date(r.createdAt).toLocaleDateString("en-GB")}` : "تاريخ الإنشاء غير متوفر"}</small></td><td>{r.client}</td><td>{r.type}</td><td>{formatSAR(r.total)}</td><td>{formatSAR(r.collected)}</td><td>{r.expiry}</td><td><Badge>{r.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={18} /></button>{menu === r.id && <ContextMenu row={r} module="finance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, r); }} />}</td></tr> : <tr key={r.id}><td><strong className="table-primary">{r.ref}</strong></td><td>{r.client}</td><td>{r.contract}</td><td>{formatSAR(r.amount)}</td><td>{r.due}</td><td>{formatSAR(r.paid)}</td><td><Badge>{r.status}</Badge>{isClaimOverdue(r) && <small className="red-text">متأخرة الاستحقاق</small>}</td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={18} /></button>{menu === r.id && <ContextMenu row={r} module="finance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, r); }} />}</td></tr>)}</TableShell><section id="finance-payment-ledger" className="surface mini-table" style={{ marginTop: "1rem", scrollMarginTop: "1rem" }}><div className="section-head"><div><h2>سجل الدفعات</h2><span>{filteredPayments.length} من {payments.length} دفعة تطابق البحث والفترة</span></div><div className="row-actions"><button className="btn outline" disabled={!filteredPayments.length} onClick={() => exportCsv(filteredPayments.map(payment => ({ ...payment, link: payment.contractId ? `عقد #${payment.contractId}` : payment.claimId ? `مطالبة #${payment.claimId}` : "غير مرتبط" })), ["paidAt", "amount", "method", "reference", "link"], "payments-ledger", ["التاريخ", "المبلغ (SAR)", "طريقة الدفع", "المرجع", "الربط"])}><Download size={15} />تصدير النتائج</button><button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}><Plus size={15} />تسجيل دفعة</button></div></div><div className="report-filter-grid finance-period-filter"><label className="report-search"><Search size={15} /><input value={paymentSearch} onChange={event => setPaymentSearch(event.target.value)} placeholder="ابحث بالمرجع أو طريقة الدفع…" /></label><label className="field"><span>الفترة</span><select value={paymentPeriod} onChange={event => choosePaymentPeriod(event.target.value)}><option value="all">كل الفترات</option><option value="month">هذا الشهر</option><option value="30days">آخر 30 يومًا</option><option value="year">هذا العام</option><option value="custom">تخصيص الفترة</option></select></label><label className="field"><span>من تاريخ</span><input type="date" value={paymentDateFrom} onChange={event => { setPaymentPeriod("custom"); setPaymentDateFrom(event.target.value); }} /></label><label className="field"><span>إلى تاريخ</span><input type="date" value={paymentDateTo} onChange={event => { setPaymentPeriod("custom"); setPaymentDateTo(event.target.value); }} /></label></div>{filteredPayments.length ? <div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>المرجع</th><th>الربط</th><th>إجراءات</th></tr></thead><tbody>{filteredPayments.map(payment => <tr key={payment.id}><td>{payment.paidAt}</td><td>{formatSAR(payment.amount)}</td><td>{payment.method}</td><td>{payment.reference}</td><td>{payment.contractId ? `عقد #${payment.contractId}` : payment.claimId ? `مطالبة #${payment.claimId}` : "غير مرتبط"}</td><td className="actions-cell"><button className="row-menu-btn" title="تعديل الدفعة" onClick={() => onOpenForm({ ...payment, recordType: "payment" })}><Pencil size={16} /></button><button className="row-menu-btn danger" title="إلغاء الدفعة" onClick={() => onPaymentArchive(payment)}><Archive size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ padding: "1.5rem" }}>{payments.length ? <><strong>لا توجد دفعات تطابق البحث والفترة المحددة</strong><span>غيّر كلمات البحث أو نطاق التاريخ لعرض نتائج أخرى.</span><button className="btn ghost" onClick={() => { setPaymentSearch(""); choosePaymentPeriod("all"); }}>مسح الفلاتر</button></> : <><strong>لا توجد دفعات مسجلة</strong><span>سجّل أول دفعة من زر تسجيل دفعة.</span></>}</div>}</section><section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}><div className="section-head"><div><h2>تقرير مالي مختصر</h2><span>الدفعات ضمن الفترة المحددة؛ رصيد المطالبات والعقود يعكس الحالة الحالية</span></div><button className="btn outline" onClick={() => exportCsv([{ id: 1, metric: "إجمالي العقود القائمة", value: totalValue }, { id: 2, metric: "إجمالي الدفعات", value: paymentTotal }, { id: 3, metric: "المطالبات المتبقية حاليًا", value: outstandingClaims }, { id: 4, metric: "من تاريخ", value: paymentDateFrom || "كل الفترات" }, { id: 5, metric: "إلى تاريخ", value: paymentDateTo || "كل الفترات" }], ["metric", "value"], "financial-report")}><Download size={15} />تصدير التقرير</button></div><div className="metrics-grid finance-metrics"><MetricCard title="إجمالي الدفعات" value={formatSAR(paymentTotal)} helper={`${filteredPayments.length} دفعة في الفترة`} icon={CircleDollarSign} tone="blue" /><MetricCard title="متبقي المطالبات" value={formatSAR(outstandingClaims)} helper={`${outstandingClaimCount} مطالبة غير محصلة`} icon={Clock3} tone="orange" /><MetricCard title="نسبة التحصيل" value={`${collectionRate}%`} helper="من العقود القائمة" icon={CheckCircle2} tone="teal" /></div></section></>;
}

const auditEntityLabels: Record<string, string> = { vehicles: "مركبة", projects: "مشروع", drivers: "سائق", employees: "موظف", clients: "عميل", documents: "مستند", contracts: "عقد", claims: "مطالبة", payments: "دفعة واردة", payables: "فاتورة مورد", maintenance: "طلب صيانة", tasks: "مهمة", users: "حساب مستخدم", settingsCatalog: "قيمة مرجعية" };
const auditActionLabels: Record<string, string> = { create: "إضافة", update: "تعديل", archive: "أرشفة", delete: "حذف", updateStatus: "تغيير الحالة لـ", assignDriver: "تعديل إسناد السائق إلى", decideApproval: "اتخاذ قرار اعتماد لـ", settleAdvance: "تسوية عهدة لـ", advance: "نقل مرحلة لـ", registerPayment: "تسجيل صرف لـ", expenseCreate: "تسجيل مصروف لـ", expenseUpdate: "تعديل مصروف لـ", expenseArchive: "أرشفة مصروف لـ", updateRole: "تغيير دور", updateAccess: "تعديل صلاحيات", linkUser: "ربط حساب بملف", markRead: "قراءة إشعار" };
function auditActionLabel(action: string, entityType: string) {
  const entity = auditEntityLabels[entityType] || entityType;
  const operation = action.split(".").at(-1) || action;
  return `${auditActionLabels[operation] || "تنفيذ إجراء على"} ${entity}`;
}
function formatAuditDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "وقت غير متاح" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function SettingsPage({ settingsCount, auditLogs }: { settingsCount: number; auditLogs: Array<{ id?: number; action: string; entityType: string; entityId?: number | null; details?: string | null; actorName?: string | null; actorUsername?: string | null; createdAt?: Date | string }> }) {
  const [location, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<{ key: string; title: string } | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newUser, setNewUser] = useState({ name: "", username: "", password: "", role: "user" as "user" | "admin", permissions: ["dashboard"] });
  const { data: settings = [], refetch } = trpc.settingsCatalog.list.useQuery(undefined, { staleTime: 30000 });
  const createSetting = trpc.settingsCatalog.create.useMutation();
  const updateSetting = trpc.settingsCatalog.update.useMutation();
  const archiveSetting = trpc.settingsCatalog.archive.useMutation();
  const deleteSetting = trpc.settingsCatalog.delete.useMutation();
  const { data: users = [], refetch: refetchUsers } = trpc.users.list.useQuery(undefined, { enabled: Boolean(location.includes("/users")) });
  const updateUserRole = trpc.users.updateRole.useMutation();
  const createUser = trpc.users.create.useMutation();
  const [editingPermissionsId, setEditingPermissionsId] = useState<number | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const updateUserAccess = trpc.users.updateAccess.useMutation();
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const filteredAuditLogs = auditLogs.filter(log => matchesQuickSearch(log, auditSearch));

  const cards = [
    { key: "pm", icon: Wrench, group: "المركبات", title: "الصيانات الدورية", text: "إضافة وتعديل قواعد الصيانة الدورية" },
    { key: "colors", icon: CarFront, group: "المركبات", title: "ألوان المركبات", text: "إضافة وتعديل ألوان المركبات" },
    { key: "car_models", icon: CarFront, group: "المركبات", title: "موديلات المركبات", text: "إضافة وتعديل موديلات المركبات" },
    { key: "car_companies", icon: CarFront, group: "المركبات", title: "شركات المركبات", text: "إضافة وتعديل شركات المركبات" },
    { key: "license_types", icon: FileText, group: "المركبات", title: "أنواع التراخيص", text: "إضافة وتعديل أنواع تراخيص السائقين والمركبات" },
    { key: "neighborhood", icon: MapPin, group: "الموقع", title: "الأحياء", text: "إضافة وتعديل الأحياء" },
    { key: "states", icon: MapPin, group: "الموقع", title: "المدن", text: "إضافة وتعديل المدن" },
    { key: "countries", icon: MapPin, group: "الموقع", title: "الدول", text: "إضافة وتعديل الدول" },
    { key: "attachment_names", icon: FileText, group: "المستندات", title: "أنواع المستندات", text: "إضافة وتعديل الوثائق" },
    { key: "payment_methods", icon: BookOpen, group: "العقود", title: "طرق الدفع", text: "إضافة وتعديل طرق الدفع" },
    { key: "users", icon: UserRound, group: "الأمان", title: "المستخدمون والصلاحيات", text: "إدارة المستخدمين وتحديد دور المدير أو المستخدم" },
  ];

  const handleAddSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = activeCategory || cards.find(card => location.endsWith(`/${card.key}`));
    if (!newValue.trim() || !category) return;
    try {
      await createSetting.mutateAsync({ category: category.key, key: `item_${Date.now()}`, label: newValue, value: newValue, active: 1 });
      setNewValue("");
      refetch();
      toast.success("تمت الإضافة بنجاح");
    } catch (err: any) { toast.error(err.message); }
  };

  const selectedCard = cards.find(card => location.endsWith(`/${card.key}`));
  if (selectedCard && selectedCard.key === "users") {
    const permissionOptions = [["dashboard", "لوحة التحكم"], ["vehicles", "المركبات"], ["projects", "المشاريع"], ["payables", "المستحقات علينا"], ["maintenance", "الصيانة"], ["accidents", "الحوادث"], ["inventory", "المخزون وقطع الغيار"], ["documents", "المستندات"], ["drivers", "السائقون"], ["employees", "الموظفون"], ["clients", "العملاء"], ["finance", "المالية"], ["reports", "التقارير"]] as const;
    const accounts = users ?? [];
    const readPermissions = (value: string | null | undefined) => { try { return value ? JSON.parse(value) as string[] : []; } catch { return []; } };
    const submitUser = (event: React.FormEvent) => {
      event.preventDefault();
      if (!newUser.name.trim() || !newUser.username.trim() || newUser.password.length < 8) { toast.error("أدخل الاسم واسم المستخدم وكلمة مرور من 8 أحرف على الأقل"); return; }
      createUser.mutate({ ...newUser, name: newUser.name.trim(), username: newUser.username.trim().toLowerCase() }, { onSuccess: () => { setNewUser({ name: "", username: "", password: "", role: "user", permissions: ["dashboard"] }); refetchUsers(); toast.success("تم إنشاء المستخدم بنجاح"); }, onError: error => toast.error(error.message) });
    };
    return <>
      <PageHeader eyebrow="الإعدادات / الأمان" title="المستخدمون والصلاحيات" description="أنشئ حسابات دخول فعلية وحدد دور كل مستخدم والأقسام المسموح له بها." />
      <button className="btn ghost" onClick={() => navigate("/dashboard/settings")}><ChevronRight size={15} />العودة إلى إعدادات النظام</button>
      <section className="surface user-admin-form" style={{ marginTop: "1rem", padding: "1.25rem" }}>
        <div className="section-head"><div><h2>إضافة مستخدم جديد</h2><span>سيتمكن المستخدم من الدخول باسم المستخدم وكلمة المرور التي تحددها.</span></div></div>
        <form onSubmit={submitUser} className="form-grid" style={{ marginTop: "1rem" }}>
          <Field label="الاسم الكامل" value={newUser.name} onChange={value => setNewUser(prev => ({ ...prev, name: value }))} />
          <Field label="اسم المستخدم" value={newUser.username} onChange={value => setNewUser(prev => ({ ...prev, username: value }))} />
          <Field label="كلمة المرور" value={newUser.password} onChange={value => setNewUser(prev => ({ ...prev, password: value }))} type="password" />
          <label className="field"><span>الدور</span><select value={newUser.role} onChange={event => setNewUser(prev => ({ ...prev, role: event.target.value as "user" | "admin" }))}><option value="user">مستخدم</option><option value="admin">مدير النظام</option></select></label>
          <div className="permission-picker"><span>الأقسام المسموح بها</span><div>{permissionOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={newUser.permissions.includes(key)} onChange={event => setNewUser(prev => ({ ...prev, permissions: event.target.checked ? [...prev.permissions, key] : prev.permissions.filter(permission => permission !== key) }))} />{label}</label>)}</div></div>
          <div><button className="btn primary" type="submit" disabled={createUser.isPending}><Plus size={15} />{createUser.isPending ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}</button></div>
        </form>
      </section>
      <section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}><div className="section-head"><div><h2>الحسابات الحالية</h2><span>{accounts.length} مستخدم محفوظ</span></div></div><div className="compact-list">{accounts.length ? accounts.map(account => { const isEditing = editingPermissionsId === account.id; const permissions = isEditing ? permissionDraft : readPermissions(account.permissions); return <div className="compact-row" key={account.id}><div className="compact-main"><strong>{account.name || "مستخدم بلا اسم"}</strong><small>@{account.username || "بدون اسم مستخدم"} · {account.isActive ? "نشط" : "موقوف"}</small></div><select value={account.role} onChange={event => updateUserRole.mutate({ id: account.id, role: event.target.value as "user" | "admin" }, { onSuccess: () => { refetchUsers(); toast.success("تم تحديث دور المستخدم"); }, onError: error => toast.error(error.message) })}><option value="admin">مدير النظام</option><option value="user">مستخدم</option></select><button className="btn outline" type="button" onClick={() => { setEditingPermissionsId(isEditing ? null : account.id); setPermissionDraft(readPermissions(account.permissions)); }}>{isEditing ? "إغلاق الصلاحيات" : "تعديل الصلاحيات"}</button><button className="btn outline" type="button" onClick={() => { const password = window.prompt("أدخل كلمة المرور الجديدة (8 أحرف على الأقل)"); if (!password) return; if (password.length < 8) { toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; } updateUserAccess.mutate({ id: account.id, password }, { onSuccess: () => toast.success("تم تصفير كلمة المرور وتعيين كلمة مرور جديدة"), onError: error => toast.error(error.message) }); }}>تصفير كلمة المرور</button>{isEditing && <div className="permission-picker" style={{ gridColumn: "1 / -1", marginTop: "0.5rem" }}><span>الصلاحيات المسموح بها</span><div>{permissionOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={permissions.includes(key)} onChange={event => setPermissionDraft(current => event.target.checked ? (current.includes(key) ? current : [...current, key]) : current.filter(permission => permission !== key))} />{label}</label>)}</div><button className="btn primary" type="button" disabled={updateUserAccess.isPending} onClick={() => updateUserAccess.mutate({ id: account.id, permissions: permissionDraft }, { onSuccess: () => { setEditingPermissionsId(null); refetchUsers(); toast.success("تم تحديث صلاحيات المستخدم"); }, onError: error => toast.error(error.message) })}>{updateUserAccess.isPending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}</button></div>}</div>; }) : <div className="empty-state" style={{ padding: "2rem" }}><strong>لا يوجد مستخدمون</strong><span>أنشئ أول حساب من النموذج أعلاه.</span></div>}</div></section>
    </>;
  }
  if (selectedCard) {
    const values = (settings ?? []).filter(setting => setting.category === selectedCard.key);
    return <><PageHeader eyebrow={`الإعدادات / ${selectedCard.group}`} title={selectedCard.title} description={selectedCard.text} action="إضافة قيمة" onAction={() => document.getElementById("settings-value-input")?.focus()} /><button className="btn ghost" onClick={() => navigate("/dashboard/settings")}><ChevronRight size={15} />العودة إلى إعدادات النظام</button><section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}><form onSubmit={handleAddSetting} style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem" }}><input id="settings-value-input" className="field-input" placeholder={`إضافة قيمة إلى ${selectedCard.title}`} value={newValue} onChange={e => setNewValue(e.target.value)} /><button type="submit" className="btn primary" disabled={createSetting.isPending}><Plus size={15} />إضافة</button></form>{values.length ? <div className="compact-list">{values.map(value => <div className="compact-row" key={value.id}><div className="compact-main"><strong>{value.label}</strong><small>{value.value}</small></div><Badge>{value.active ? "نشط" : "غير نشط"}</Badge><div className="row-actions"><button className="icon-btn" title="تعديل" onClick={() => { const next = window.prompt("القيمة الجديدة", value.label); if (next?.trim()) updateSetting.mutate({ id: value.id, data: { label: next.trim(), value: next.trim() } }, { onSuccess: () => { refetch(); toast.success("تم تعديل القيمة"); }, onError: error => toast.error(error.message) }); }}><Pencil size={15} /></button><button className="icon-btn" title={value.active ? "تعطيل" : "تفعيل"} onClick={() => updateSetting.mutate({ id: value.id, data: { active: value.active ? 0 : 1 } }, { onSuccess: () => { refetch(); toast.success(value.active ? "تم تعطيل القيمة" : "تم تفعيل القيمة"); }, onError: error => toast.error(error.message) })}><Archive size={15} /></button><button className="icon-btn danger" title="حذف نهائي" onClick={() => { if(window.confirm("هل أنت متأكد من الحذف النهائي؟")) deleteSetting.mutate({ id: value.id }, { onSuccess: () => { refetch(); toast.success("تم الحذف بنجاح"); } }) }}><Trash size={15} /></button></div></div>)}</div> : <div className="empty-state" style={{ padding: "2rem" }}><strong>لا توجد قيم مضافة بعد</strong><span>أضف أول قيمة من النموذج أعلاه.</span></div>}</section></>;
  }

  return <><PageHeader eyebrow="النظام / التهيئة" title="الإعدادات (المرجع)" description={`أضف وعدل القوائم المنسدلة والبيانات المرجعية المستخدمة في جميع أقسام النظام. ${(settings ?? []).length} قيمة مرجعية محفوظة.`} />
    <div className="settings-grid">{cards.map((card, i) => {
      const count = (settings ?? []).filter(s => s.category === card.key).length;
      return <button className="settings-card" key={card.title} onClick={() => navigate(`/dashboard/settings/${card.key}`)}>
        <span className={`settings-icon tone-${i % 4}`}><card.icon size={20} /></span>
        <div><h3>{card.title}</h3><p>{card.text}</p><small>{count} قيمة مرجعية مسجلة</small></div>
        <ChevronLeft size={18} />
      </button>
    })}</div>
    
    <div className="audit-card surface"><div className="section-head"><div><div className="eyebrow">سجل التغييرات</div><h2>تغييرات النظام الأخيرة</h2><span>{auditLogs.length} حدثًا محفوظًا</span></div><button className="btn outline" onClick={() => setAuditOpen(true)}>عرض سجل النشاط</button></div>{auditLogs.slice(0, 5).map((log, i) => <div className="audit-row" key={log.id ?? `${log.action}-${i}`}><span className={`avatar ${i % 2 ? "teal" : ""}`}>{(log.actorName || log.actorUsername || "م").slice(0, 1)}</span><div><strong>{auditActionLabel(log.action, log.entityType)}{log.entityId ? ` #${log.entityId}` : ""}</strong><span>{log.actorName || (log.actorUsername ? `@${log.actorUsername}` : "مستخدم غير معروف")} · {log.details || "لا توجد تفاصيل إضافية"}</span></div><time>{log.createdAt ? formatAuditDate(log.createdAt) : "وقت غير متاح"}</time></div>)}{auditLogs.length === 0 && <div className="empty-state" style={{ padding: "1rem" }}>لا توجد تغييرات مسجلة بعد.</div>}</div>

    {auditOpen && <Modal title="سجل نشاط النظام" onClose={() => { setAuditOpen(false); setAuditSearch(""); }} wide><div className="report-search audit-search"><Search size={15} /><input value={auditSearch} onChange={event => setAuditSearch(event.target.value)} placeholder="ابحث بالمنفذ أو الإجراء أو نوع السجل…" /></div><div className="compact-list audit-history-list">{filteredAuditLogs.length ? filteredAuditLogs.map(log => <div className="compact-row" key={log.id ?? `${log.action}-${log.entityId}-${log.createdAt}`}><span className="avatar">{(log.actorName || log.actorUsername || "م").slice(0, 1)}</span><div className="compact-main"><strong>{auditActionLabel(log.action, log.entityType)}{log.entityId ? ` #${log.entityId}` : ""}</strong><small>{log.actorName || (log.actorUsername ? `@${log.actorUsername}` : "مستخدم غير معروف")} · {log.createdAt ? formatAuditDate(log.createdAt) : "وقت غير متاح"}</small>{log.details && <small>{log.details}</small>}</div></div>) : <div className="empty-state">لا توجد أحداث تطابق البحث.</div>}</div><div className="field-note">يعرض السجل آخر 200 حدث. تفاصيل التعديلات تسجل أسماء الحقول فقط ولا تعرض القيم السرية.</div></Modal>}

    {activeCategory && (
      <Modal title={`إدارة ${activeCategory.title}`} onClose={() => setActiveCategory(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem" }}>
          <form onSubmit={handleAddSetting} style={{ display: "flex", gap: "0.5rem" }}>
            <input type="text" placeholder="إضافة قيمة جديدة..." value={newValue} onChange={e => setNewValue(e.target.value)} className="input-field" style={{ flex: 1, padding: "0.6rem", border: "1px solid var(--border)", borderRadius: "6px" }} />
            <button type="submit" className="btn primary" disabled={createSetting.isPending}>إضافة</button>
          </form>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
            {(settings ?? []).filter(s => s.category === activeCategory.key).map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem", background: "var(--surface-hover)", borderRadius: "6px" }}>
                <span>{s.label}</span>
              </div>
            ))}
            {(settings ?? []).filter(s => s.category === activeCategory.key).length === 0 && (
              <div className="empty-state" style={{ padding: "2rem", textAlign: "center" }}>لا توجد قيم مضافة بعد.</div>
            )}
          </div>
        </div>
        <FormActions onCancel={() => setActiveCategory(null)} label="إغلاق" />
      </Modal>
    )}
  </>;
}

export default function FleetDashboard() {
  const { user, loading: authLoading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const userPermissions = new Set(user?.role === "admin" ? ["dashboard", "vehicles", "projects", "maintenance", "accidents", "inventory", "documents", "drivers", "employees", "clients", "finance", "payables", "reports", "settings"] : (() => { try { return JSON.parse(user?.permissions || "[]") as string[]; } catch { return []; } })());
  const canAccess = (key: ModuleKey) => userPermissions.has(key);
  const vehicleQuery = trpc.vehicles.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("vehicles") });
  const driverQuery = trpc.drivers.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("drivers") });
  const maintenanceQuery = trpc.maintenance.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("maintenance") });
  const documentQuery = trpc.documents.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("documents") });
  const clientQuery = trpc.clients.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("clients") });
  const claimQuery = trpc.claims.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("finance") });
  const contractsQuery = trpc.contracts.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("finance") });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("projects") });
  const employeesSearchQuery = trpc.employees.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("employees") });
  const payablesQuery = trpc.payables.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("payables") });
  const paymentsQuery = trpc.payments.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("finance") });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("dashboard") });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("dashboard") });
  const taskAssigneesQuery = trpc.tasks.assignees.useQuery(undefined, { enabled: user?.role === "admin", staleTime: 30000 });
  const visibleNotifications = canAccess("dashboard") ? notificationsQuery.data ?? [] : [];
  const notificationRead = trpc.notifications.markRead.useMutation();
  const settingsQuery = trpc.settingsCatalog.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const auditQuery = trpc.audit.list.useQuery(undefined, { staleTime: 30000, enabled: user?.role === "admin" });
  const failedWorkspaceSources = [
    { label: "المركبات", query: vehicleQuery, enabled: canAccess("vehicles") },
    { label: "السائقون", query: driverQuery, enabled: canAccess("drivers") },
    { label: "الصيانة", query: maintenanceQuery, enabled: canAccess("maintenance") },
    { label: "المستندات", query: documentQuery, enabled: canAccess("documents") },
    { label: "العملاء", query: clientQuery, enabled: canAccess("clients") },
    { label: "المطالبات", query: claimQuery, enabled: canAccess("finance") },
    { label: "العقود", query: contractsQuery, enabled: canAccess("finance") },
    { label: "الدفعات", query: paymentsQuery, enabled: canAccess("finance") },
    { label: "المشاريع", query: projectsQuery, enabled: canAccess("projects") },
    { label: "الموظفون", query: employeesSearchQuery, enabled: canAccess("employees") },
    { label: "المستحقات علينا", query: payablesQuery, enabled: canAccess("payables") },
    { label: "المهام", query: tasksQuery, enabled: canAccess("dashboard") },
    { label: "الإشعارات", query: notificationsQuery, enabled: canAccess("dashboard") },
    { label: "القوائم المرجعية", query: settingsQuery, enabled: canAccess("settings") },
    { label: "سجل النشاط", query: auditQuery, enabled: user?.role === "admin" },
    { label: "مكلفو المهام", query: taskAssigneesQuery, enabled: user?.role === "admin" },
  ].filter(source => source.enabled && source.query.isError);
  const hasWorkspaceQueryError = failedWorkspaceSources.length > 0;
  const retryFailedWorkspaceSources = () => Promise.all(failedWorkspaceSources.map(source => source.query.refetch()));
  const isWorkspaceQueryLoading = [
    canAccess("vehicles") && vehicleQuery.isLoading,
    canAccess("drivers") && driverQuery.isLoading,
    canAccess("maintenance") && maintenanceQuery.isLoading,
    canAccess("documents") && documentQuery.isLoading,
    canAccess("clients") && clientQuery.isLoading,
    canAccess("finance") && (claimQuery.isLoading || contractsQuery.isLoading || paymentsQuery.isLoading),
    canAccess("projects") && projectsQuery.isLoading,
    canAccess("employees") && employeesSearchQuery.isLoading,
    canAccess("payables") && payablesQuery.isLoading,
    canAccess("dashboard") && (tasksQuery.isLoading || notificationsQuery.isLoading),
    canAccess("settings") && settingsQuery.isLoading,
    user?.role === "admin" && auditQuery.isLoading,
  ].some(Boolean);
  const workspaceStatus = authLoading ? "جارٍ التحقق من الحساب" : !user ? "غير متصل" : hasWorkspaceQueryError ? "تعذر تحميل بعض البيانات" : isWorkspaceQueryLoading ? "جارٍ تحميل البيانات" : "تم تحميل بيانات النظام";
  const workspaceStatusTone = !user && !authLoading || hasWorkspaceQueryError ? "offline" : isWorkspaceQueryLoading || authLoading ? "syncing" : "";
  const vehicleCreate = trpc.vehicles.create.useMutation();
  const vehicleUpdate = trpc.vehicles.update.useMutation();
  const vehicleAssign = trpc.vehicles.assignDriver.useMutation();
  const vehicleArchive = trpc.vehicles.archive.useMutation();
  const driverCreate = trpc.drivers.create.useMutation();
  const driverUpdate = trpc.drivers.update.useMutation();
  const driverArchive = trpc.drivers.archive.useMutation();
  const maintenanceCreate = trpc.maintenance.create.useMutation();
  const maintenanceUpdate = trpc.maintenance.update.useMutation();
  const maintenanceAdvance = trpc.maintenance.advance.useMutation();
  const maintenanceDecideApproval = trpc.maintenance.decideApproval.useMutation();
  const maintenanceSettleAdvance = trpc.maintenance.settleAdvance.useMutation();
  const maintenanceArchive = trpc.maintenance.archive.useMutation();
  const documentCreate = trpc.documents.create.useMutation();
  const documentUpdate = trpc.documents.update.useMutation();
  const documentArchive = trpc.documents.archive.useMutation();
  const clientCreate = trpc.clients.create.useMutation();
  const clientUpdate = trpc.clients.update.useMutation();
  const clientArchive = trpc.clients.archive.useMutation();
  const representativeCreate = trpc.representatives.create.useMutation();
  const claimCreate = trpc.claims.create.useMutation();
  const claimUpdate = trpc.claims.update.useMutation();
  const claimArchive = trpc.claims.archive.useMutation();
  const contractCreate = trpc.contracts.create.useMutation();
  const taskUpdate = trpc.tasks.update.useMutation();
  const taskCreate = trpc.tasks.create.useMutation();
  const paymentCreate = trpc.payments.create.useMutation();
  const paymentUpdate = trpc.payments.update.useMutation();
  const paymentArchive = trpc.payments.archive.useMutation();
  const contractUpdate = trpc.contracts.update.useMutation();
  const contractStatusUpdate = trpc.contracts.updateStatus.useMutation();
  const contractArchive = trpc.contracts.archive.useMutation();
  const [active, setActive] = useState<ModuleKey>(() => moduleForLocation(window.location.pathname));
  useEffect(() => setActive(moduleForLocation(location)), [location]);
  useEffect(() => { if (!user || canAccess(active)) return; const fallback = navGroups.flatMap(group => group.items).find(item => canAccess(item.key))?.key ?? "dashboard"; setActive(fallback); navigate(fallback === "dashboard" ? "/dashboard" : `/dashboard/${fallback === "finance" ? "financial/contracts" : fallback}`); }, [active, user?.id, user?.role, user?.permissions]);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [commandOpen, setCommandOpen] = useState(false); const [commandQuery, setCommandQuery] = useState(""); const [commandActiveIndex, setCommandActiveIndex] = useState(0); const [modal, setModal] = useState<{ module: ModuleKey; row?: Row } | null>(null); const [detail, setDetail] = useState<{ module: ModuleKey; row: Row } | null>(null); const [maintenanceDetail, setMaintenanceDetail] = useState<Maintenance | null>(null); const [vehicleProfile, setVehicleProfile] = useState<Vehicle | null>(null); const [driverDetail, setDriverDetail] = useState<Driver | null>(null); const [assignmentVehicle, setAssignmentVehicle] = useState<Vehicle | null>(null); const [assignmentDriver, setAssignmentDriver] = useState<Driver | null>(null); const [quickAction, setQuickAction] = useState<{ action: string; row: Row } | null>(null);
  const [prefillMaintenanceRequest, setPrefillMaintenanceRequest] = useState<Maintenance | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]); const [documents, setDocuments] = useState<Document[]>([]); const [clients, setClients] = useState<Client[]>([]); const [contracts, setContracts] = useState<Contract[]>([]); const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => { setVehicles(canAccess("vehicles") ? vehicleQuery.data as Vehicle[] ?? [] : []); }, [vehicleQuery.data, user?.permissions, user?.role]);
  useEffect(() => { setDrivers(canAccess("drivers") ? driverQuery.data as Driver[] ?? [] : []); }, [driverQuery.data, user?.permissions, user?.role]);
  useEffect(() => { setMaintenance(canAccess("maintenance") ? maintenanceQuery.data as Maintenance[] ?? [] : []); }, [maintenanceQuery.data, user?.permissions, user?.role]);
  useEffect(() => { setDocuments(canAccess("documents") ? documentQuery.data as Document[] ?? [] : []); }, [documentQuery.data, user?.permissions, user?.role]);
  useEffect(() => { setClients(canAccess("clients") ? clientQuery.data as Client[] ?? [] : []); }, [clientQuery.data, user?.permissions, user?.role]);
  useEffect(() => { setClaims(canAccess("finance") ? claimQuery.data as Claim[] ?? [] : []); }, [claimQuery.data, user?.permissions, user?.role]);
  useEffect(() => { setContracts(canAccess("finance") ? contractsQuery.data as Contract[] ?? [] : []); }, [contractsQuery.data, user?.permissions, user?.role]);
  const accessFingerprint = `${user?.id ?? ""}:${user?.role ?? ""}:${user?.permissions ?? ""}`;
  const previousAccessFingerprint = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (previousAccessFingerprint.current === null) { previousAccessFingerprint.current = accessFingerprint; return; }
    if (previousAccessFingerprint.current === accessFingerprint) return;
    previousAccessFingerprint.current = accessFingerprint;
    setModal(null); setDetail(null); setMaintenanceDetail(null); setVehicleProfile(null); setDriverDetail(null);
    setAssignmentVehicle(null); setAssignmentDriver(null); setQuickAction(null); setCommandOpen(false); setCommandQuery("");
    setVehicles([]); setDrivers([]); setMaintenance([]); setDocuments([]); setClients([]); setClaims([]); setContracts([]);
    void utils.vehicles.list.reset(); void utils.vehicles.financeProfile.reset();
    void utils.drivers.list.reset(); void utils.maintenance.list.reset(); void utils.documents.list.reset();
    void utils.clients.list.reset(); void utils.claims.list.reset(); void utils.contracts.list.reset(); void utils.payments.list.reset();
    void utils.projects.list.reset(); void utils.employees.list.reset(); void utils.payables.list.reset();
    void utils.tasks.list.reset(); void utils.notifications.list.reset();
    void utils.reports.summary.reset();
  }, [accessFingerprint]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); } if (e.key === "Escape") { setCommandOpen(false); setCommandQuery(""); setMobileOpen(false); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const onNavigate = (key: ModuleKey) => { if (!canAccess(key)) { toast.error("ليس لديك صلاحية الوصول إلى هذا القسم"); return; } setActive(key); setMobileOpen(false); navigate(key === "dashboard" ? "/dashboard" : `/dashboard/${key === "finance" ? "financial/contracts" : key}`); };
  const openNotificationRecord = (notification: { id: number; entityType?: string | null; entityId?: number | null }) => {
    const { target, record } = notificationRecord(notification, { vehicles: canAccess("vehicles") ? vehicles : [], drivers: canAccess("drivers") ? drivers : [], employees: canAccess("employees") ? (employeesSearchQuery.data ?? []) as Row[] : [], clients: canAccess("clients") ? clients : [], projects: canAccess("projects") ? (projectsQuery.data ?? []) as Row[] : [], maintenance: canAccess("maintenance") ? maintenance : [], documents: canAccess("documents") ? documents : [], finance: canAccess("finance") ? [...contracts, ...claims] : [], payables: canAccess("payables") ? (payablesQuery.data ?? []) as Row[] : [] });
    setNotificationCenterOpen(false); onNavigate(target); notificationRead.mutate({ id: notification.id }, { onSuccess: () => utils.notifications.list.invalidate() });
    if (!record) { if (notification.entityId) toast.info("فتح القسم؛ تعذر العثور على السجل المرتبط ضمن البيانات المحمّلة"); return; }
    if (target === "vehicles") setVehicleProfile(record as Vehicle); else if (target === "drivers") setDriverDetail(record as Driver); else if (target === "maintenance") setMaintenanceDetail(record as Maintenance); else setDetail({ module: target, row: record });
  };
  const quickSearchSources = useMemo(() => [
    ...(canAccess("vehicles") ? (vehicleQuery.data ?? []).map((row: any) => ({ module: "vehicles" as ModuleKey, label: row.plate, description: `${row.brand} ${row.model} · ${row.status}`, row: row as Row })) : []),
    ...(canAccess("drivers") ? (driverQuery.data ?? []).map((row: any) => ({ module: "drivers" as ModuleKey, label: row.name, description: `سائق · ${row.phone} · ${row.status}`, row: row as Row })) : []),
    ...(canAccess("clients") ? (clientQuery.data ?? []).map((row: any) => ({ module: "clients" as ModuleKey, label: row.name, description: `عميل · ${row.phone}`, row: row as Row })) : []),
    ...(canAccess("maintenance") ? (maintenanceQuery.data ?? []).map((row: any) => ({ module: "maintenance" as ModuleKey, label: row.ref, description: `صيانة · ${row.vehicle} · ${row.type} · ${row.workflowStage || row.status}`, row: row as Row })) : []),
    ...(canAccess("documents") ? (documentQuery.data ?? []).map((row: any) => ({ module: "documents" as ModuleKey, label: row.name, description: `مستند ${row.entityType || row.type} · ${row.entity || row.owner}`, row: row as Row })) : []),
    ...(canAccess("finance") ? (contractsQuery.data ?? []).map((row: any) => ({ module: "finance" as ModuleKey, label: row.ref, description: `عقد · ${row.client} · ${row.status}`, row: row as Row })) : []),
    ...(canAccess("finance") ? (claimQuery.data ?? []).map((row: any) => ({ module: "finance" as ModuleKey, label: row.ref, description: `مطالبة · ${row.client} · ${row.status}`, row: row as Row })) : []),
    ...(canAccess("finance") ? (paymentsQuery.data ?? []).map((row: any) => ({ module: "finance" as ModuleKey, label: `دفعة ${row.reference || row.id}`, description: `تحصيل · ${row.amount} SAR · ${row.paidAt} · ${row.method} · ${row.contractId ? `عقد #${row.contractId}` : row.claimId ? `مطالبة #${row.claimId}` : "غير مرتبطة"}`, row: { ...row, recordType: "payment" } as Row })) : []),
    ...(canAccess("projects") ? (projectsQuery.data ?? []).map((row: any) => ({ module: "projects" as ModuleKey, label: row.name, description: `مشروع ${row.ref} · ${row.client} · ${row.status}`, row: row as Row })) : []),
    ...(canAccess("employees") ? (employeesSearchQuery.data ?? []).map((row: any) => ({ module: "employees" as ModuleKey, label: row.name, description: `موظف ${row.employeeNo} · ${row.department}`, row: row as Row })) : []),
    ...(canAccess("payables") ? (payablesQuery.data ?? []).map((row: any) => ({ module: "payables" as ModuleKey, label: row.ref, description: `فاتورة مورد · ${row.supplier} · ${row.status}`, row: row as Row })) : []),
    ...(canAccess("dashboard") ? (tasksQuery.data ?? []).map((row: any) => ({ module: "dashboard" as ModuleKey, label: row.title, description: `مهمة · ${row.assignee} · ${row.status} · ${row.dueAt}`, row: row as Row })) : []),
    ...(canAccess("dashboard") ? (notificationsQuery.data ?? []).map((row: any) => ({ module: "dashboard" as ModuleKey, label: row.title, description: `تنبيه · ${row.severity} · ${row.message}`, row: row as Row })) : []),
  ], [vehicleQuery.data, driverQuery.data, clientQuery.data, maintenanceQuery.data, documentQuery.data, contractsQuery.data, claimQuery.data, paymentsQuery.data, projectsQuery.data, employeesSearchQuery.data, payablesQuery.data, tasksQuery.data, notificationsQuery.data, user?.id, user?.permissions, user?.role]);
  const quickSearchResults = useMemo(() => filterQuickSearch(quickSearchSources, commandQuery, item => `${item.label} ${item.description} ${searchableRecordText(item.row)}`, 40), [quickSearchSources, commandQuery]);
  const quickSearchLoading = [
    canAccess("vehicles") && vehicleQuery.isLoading,
    canAccess("drivers") && driverQuery.isLoading,
    canAccess("clients") && clientQuery.isLoading,
    canAccess("maintenance") && maintenanceQuery.isLoading,
    canAccess("documents") && documentQuery.isLoading,
    canAccess("finance") && (contractsQuery.isLoading || claimQuery.isLoading),
    canAccess("projects") && projectsQuery.isLoading,
    canAccess("employees") && employeesSearchQuery.isLoading,
    canAccess("payables") && payablesQuery.isLoading,
    canAccess("dashboard") && (tasksQuery.isLoading || notificationsQuery.isLoading),
  ].some(Boolean);
  const quickSearchHasError = [
    canAccess("vehicles") && vehicleQuery.isError,
    canAccess("drivers") && driverQuery.isError,
    canAccess("clients") && clientQuery.isError,
    canAccess("maintenance") && maintenanceQuery.isError,
    canAccess("documents") && documentQuery.isError,
    canAccess("finance") && (contractsQuery.isError || claimQuery.isError || paymentsQuery.isError),
    canAccess("projects") && projectsQuery.isError,
    canAccess("employees") && employeesSearchQuery.isError,
    canAccess("payables") && payablesQuery.isError,
    canAccess("dashboard") && (tasksQuery.isError || notificationsQuery.isError),
  ].some(Boolean);
  const quickSearchResultItems = quickSearchResults.map((result, index) => {
    const ItemIcon = navGroups.flatMap(group => group.items).find(item => item.key === result.module)?.icon ?? Search;
    return <button key={`${result.module}-${result.row.id}-${index}`} id={`quick-search-result-${index}`} role="option" aria-selected={index === commandActiveIndex} onMouseEnter={() => setCommandActiveIndex(index)} onClick={() => openQuickSearchResult(result)}><ItemIcon size={16} /><span><strong>{result.label}</strong><small>{result.description}</small></span><kbd>فتح</kbd></button>;
  });
  const quickSearchEmptyState = quickSearchLoading
    ? <div className="empty-state" role="status" style={{ padding: "1rem" }}>جارٍ تحميل السجلات المسموح بها…</div>
    : quickSearchHasError
      ? <div className="empty-state" role="status" style={{ padding: "1rem" }}>تعذر تحميل بعض الأقسام. تحقق من الاتصال أو أعد فتح البحث.</div>
      : <div className="empty-state" role="status" style={{ padding: "1rem" }}>لا توجد سجلات تطابق البحث ضمن صلاحياتك.</div>;
  const quickSearchResultsContent = <>
    {quickSearchLoading && <div className="field-note" role="status">جارٍ تحميل نتائج بقية الأقسام…</div>}
    {quickSearchHasError && !quickSearchLoading && <div className="field-note" role="status">بعض الأقسام لم تُحمّل؛ النتائج المعروضة قد تكون غير مكتملة.</div>}
    {quickSearchResultItems}
  </>;
  useEffect(() => { setCommandActiveIndex(index => Math.min(index, Math.max(0, quickSearchResults.length - 1))); }, [quickSearchResults.length]);
  useEffect(() => {
    if (!commandOpen || !commandQuery.trim() || !quickSearchResults.length) return;
    document.getElementById(`quick-search-result-${commandActiveIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [commandOpen, commandQuery, commandActiveIndex, quickSearchResults.length]);
  const openQuickSearchResult = (result: (typeof quickSearchSources)[number]) => {
    setCommandOpen(false);
    setCommandQuery("");
    if (result.module === "payables") {
      setActive("payables");
      setMobileOpen(false);
      navigate(`/dashboard/payables?payable=${encodeURIComponent(String(result.row.id))}`);
      return;
    }
    if (result.module === "finance" && result.row.recordType === "payment") {
      setActive("finance");
      setMobileOpen(false);
      navigate(`/dashboard/financial/payments?payment=${encodeURIComponent(String(result.row.reference || result.row.id))}`);
      return;
    }
    onNavigate(result.module);
    if (result.module === "vehicles") setVehicleProfile(result.row as Vehicle);
    else if (result.module === "drivers") setDriverDetail(result.row as Driver);
    else if (result.module === "maintenance") setMaintenanceDetail(result.row as Maintenance);
    else setDetail({ module: result.module, row: result.row });
  };
  const onAction = (action: string, row: Row) => {
    if (action === "view" && active === "vehicles") setVehicleProfile(row as Vehicle);
    else if (action === "view" && active === "maintenance") setMaintenanceDetail(row as Maintenance);
    else if (action === "view") setDetail({ module: active, row });
    else if (action === "edit") setModal({ module: active, row });
    else if (action === "assign" && active === "vehicles") setAssignmentVehicle(row as Vehicle);
    else if (action === "assign" && active === "drivers") setAssignmentDriver(row as Driver);
    else if (action === "archive") toast("هل تريد أرشفة هذا السجل؟", { action: { label: "تأكيد", onClick: () => { if (active === "vehicles") vehicleArchive.mutate({ id: row.id }, { onSuccess: () => { setVehicles(prev => prev.filter(v => v.id !== row.id)); utils.vehicles.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); } }); else if (active === "drivers") driverArchive.mutate({ id: row.id }, { onSuccess: () => { setDrivers(prev => prev.filter(item => item.id !== row.id)); utils.drivers.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة السائق: ${error.message}`) }); else if (active === "maintenance") maintenanceArchive.mutate({ id: row.id }, { onSuccess: () => { setMaintenance(prev => prev.filter(item => item.id !== row.id)); utils.maintenance.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة طلب الصيانة: ${error.message}`) }); else if (active === "documents") documentArchive.mutate({ id: row.id }, { onSuccess: () => { setDocuments(prev => prev.filter(item => item.id !== row.id)); utils.documents.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة المستند: ${error.message}`) }); else if (active === "clients") clientArchive.mutate({ id: row.id }, { onSuccess: () => { setClients(prev => prev.filter(item => item.id !== row.id)); utils.clients.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة العميل: ${error.message}`) }); else if (active === "finance" && String(row.ref || "").startsWith("CL-")) claimArchive.mutate({ id: row.id }, { onSuccess: () => { setClaims(prev => prev.filter(item => item.id !== row.id)); utils.claims.list.invalidate(); toast.success("تمت أرشفة المطالبة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة المطالبة: ${error.message}`) }); else if (active === "finance") contractArchive.mutate({ id: row.id }, { onSuccess: () => { setContracts(prev => prev.filter(item => item.id !== row.id)); utils.contracts.list.invalidate(); toast.success("تمت أرشفة العقد بنجاح"); }, onError: error => toast.error(`تعذر أرشفة العقد: ${error.message}`) }); } }, cancel: { label: "إلغاء", onClick: () => {} } });
    else if (action === "maintenance") { setActive("maintenance"); setModal({ module: "maintenance", row: { id: Date.now(), ref: `MT-${Date.now()}`, vehicle: row.plate, vehicleId: row.id, type: "صيانة دورية", manager: "—", start: formatCompanyDate(), due: "", status: "جديد", cost: "0 SAR" } }); navigate("/dashboard/maintenance"); }
    else if (["item", "cost", "status", "extend", "stage", "approval"].includes(action)) setQuickAction({ action, row });
    else if (action === "download") { if (active === "documents" && (row.hasFile || row.fileUrl)) { void (async () => { try { const attachment = row.fileUrl ? { name: row.fileName || row.name, url: row.fileUrl } : await utils.documents.file.fetch({ id: row.id }); if (!attachment?.url) throw new Error("لم يتم العثور على ملف المستند"); const link = document.createElement("a"); link.href = attachment.url; link.download = attachment.name || String(row.name || "document"); link.click(); } catch (error: any) { toast.error(error.message || "تعذر تنزيل المستند"); } })(); } else { const entries = Object.entries(row).filter(([key]) => key !== "id"); const csv = serializeCsv(["الحقل", "القيمة"], entries.map(([key, value]) => [key, value])); const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${row.name || row.ref || row.plate || "record"}.csv`; link.click(); URL.revokeObjectURL(link.href); toast.success("تم تنزيل السجل"); } }
    else if (["contracts", "claims", "new-contract"].includes(action)) { onNavigate("finance"); if (action === "new-contract") setModal({ module: "finance" }); }
    else toast.info("هذا الإجراء يحتاج تحديد السجل أولًا");
  };
  const refreshAssignments = () => { utils.vehicles.list.invalidate(); utils.drivers.list.invalidate(); };
  const saveAssignment = (driver: Driver | null) => {
    if (!assignmentVehicle) return;
    const vehicleId = assignmentVehicle.id;
    vehicleAssign.mutate({ vehicleId, driverId: driver?.id ?? null }, {
      onSuccess: saved => {
        setVehicles(prev => prev.map(item => item.id === saved.id ? { ...item, ...saved } as Vehicle : item));
        refreshAssignments();
        setAssignmentVehicle(null);
        toast.success(driver ? `تم إسناد ${driver.name} إلى ${assignmentVehicle.plate}` : "تم إلغاء إسناد السائق");
      },
      onError: error => toast.error(`تعذر حفظ الإسناد: ${error.message}`),
    });
  };
  const saveVehicleAssignment = (vehicle: Vehicle | null) => {
    if (!assignmentDriver) return;
    const previousVehicle = vehicles.find(item => item.plate === assignmentDriver.vehicle);
    const vehicleId = vehicle?.id ?? previousVehicle?.id;
    if (!vehicleId) { toast.error("لا توجد مركبة مرتبطة لإلغاء الإسناد"); return; }
    vehicleAssign.mutate({ vehicleId, driverId: vehicle ? assignmentDriver.id : null }, {
      onSuccess: () => {
        refreshAssignments();
        setAssignmentDriver(null);
        toast.success(vehicle ? `تم إسناد ${vehicle.plate} إلى ${assignmentDriver.name}` : "تم إلغاء إسناد المركبة");
      },
      onError: error => toast.error(`تعذر حفظ الإسناد: ${error.message}`),
    });
  };
  const saveRecord = (data: Row) => {
    if (modal?.module === "drivers") {
      const { id: _id, ...payload } = data;
      if (!canAccess("vehicles")) { delete payload.vehicleId; delete payload.vehicle; }
      const onSuccess = (saved: Row) => { setDrivers(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Driver : item) : [saved as Driver, ...prev]); utils.drivers.list.invalidate(); setModal(null); toast.success("تم حفظ السائق"); };
      if (drivers.some(item => item.id === data.id)) driverUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل السائق: ${error.message}`) });
      else driverCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر إضافة السائق: ${error.message}`) });
      return;
    }
    if (modal?.module === "vehicles" && !canAccess("finance")) { delete data.purchasePrice; delete data.purchaseDate; delete data.inServiceDate; }
    if (modal?.module === "clients") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setClients(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Client : item) : [saved as Client, ...prev]); if (payload.contact && payload.phone && saved.id) representativeCreate.mutate({ clientId: saved.id, name: String(payload.contact), phone: String(payload.phone) }); utils.clients.list.invalidate(); setModal(null); toast.success("تم حفظ العميل"); };
      if (clients.some(item => item.id === data.id)) clientUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل العميل: ${error.message}`) });
      else clientCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر إضافة العميل: ${error.message}`) });
      return;
    }
    if (modal?.module === "maintenance") {
      const { id: _id, ...payload } = data;
      const currentMaintenance = maintenance.find(item => item.id === data.id);
      delete payload.status;
      delete payload.workflowStage;
      delete payload.approvalStatus;
      delete payload.cost; delete payload.laborCost; delete payload.partsCost; delete payload.receiptName; delete payload.receiptUrl;
      if (currentMaintenance && currentMaintenance.approvalStatus !== "بانتظار الاعتماد") { delete payload.estimatedCost; delete payload.quotedPartsCost; delete payload.quoteName; delete payload.quoteUrl; }
      payload.ref = String(payload.ref || `MT-${Date.now()}`);
      const onSuccess = (saved: Row) => { setMaintenance(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Maintenance : item) : [saved as Maintenance, ...prev]); utils.maintenance.list.invalidate(); setModal(null); toast.success("تم حفظ طلب الصيانة"); };
      if (maintenance.some(item => item.id === data.id)) maintenanceUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل طلب الصيانة: ${error.message}`) });
      else maintenanceCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر إنشاء طلب الصيانة: ${error.message}`) });
      return;
    }
    if (modal?.module === "documents") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setDocuments(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Document : item) : [saved as Document, ...prev]); utils.documents.list.invalidate(); setModal(null); toast.success("تم حفظ المستند"); };
      if (documents.some(item => item.id === data.id)) documentUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل المستند: ${error.message}`) });
      else documentCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر حفظ المستند: ${error.message}`) });
      return;
    }
    if (modal?.module === "finance" && modal.row?.ref?.startsWith("CL-")) {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setClaims(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Claim : item) : [saved as Claim, ...prev]); utils.claims.list.invalidate(); setModal(null); toast.success("تم حفظ المطالبة"); };
      const claimPayload = { ...payload, clientId: clients.find(item => item.name === String(payload.client))?.id ?? null, contractId: contracts.find(item => item.ref === String(payload.contract))?.id ?? null } as any;
      if (claims.some(item => item.id === data.id)) claimUpdate.mutate({ id: data.id, data: claimPayload }, { onSuccess, onError: error => toast.error(`تعذر تعديل المطالبة: ${error.message}`) });
      else claimCreate.mutate(claimPayload, { onSuccess, onError: error => toast.error(`تعذر إنشاء المطالبة: ${error.message}`) });
      return;
    }
    if (modal?.module === "finance" && data.recordType === "payment") {
      const { id: _id, recordType: _recordType, ...payment } = data;
      const paymentPayload = { ...payment, amount: Number(payment.amount || 0), contractId: payment.contractId || null, claimId: payment.claimId || null, clientId: payment.clientId || null, paidAt: String(payment.paidAt), method: String(payment.method || "تحويل بنكي"), reference: String(payment.reference || "—") } as any;
      const onPaymentSuccess = () => { utils.payments.list.invalidate(); utils.contracts.list.invalidate(); utils.claims.list.invalidate(); setModal(null); toast.success(modal.row?.id ? "تم تعديل الدفعة المالية" : "تم تسجيل الدفعة المالية"); };
      if (modal.row?.id && (paymentsQuery.data ?? []).some(item => item.id === data.id)) paymentUpdate.mutate({ id: data.id, data: paymentPayload }, { onSuccess: onPaymentSuccess, onError: error => toast.error(`تعذر تعديل الدفعة: ${error.message}`) });
      else paymentCreate.mutate(paymentPayload, { onSuccess: onPaymentSuccess, onError: error => toast.error(`تعذر تسجيل الدفعة: ${error.message}`) });
      return;
    }
    if (modal?.module === "finance") {
      const { id: _id, ...contract } = data;
      if (modal.row) {
        const updatePayload: Record<string, unknown> = { ...contract };
        if (!canAccess("clients")) { delete updatePayload.client; delete updatePayload.clientId; }
        if (!canAccess("vehicles") || !canAccess("drivers")) delete updatePayload.items;
        else updatePayload.items = (contract.items as any[])?.length ? contract.items : undefined;
        contractUpdate.mutate({ id: data.id, data: updatePayload as any }, { onSuccess: saved => { setContracts(prev => prev.map(item => item.id === data.id ? { ...item, ...saved } as Contract : item)); utils.contracts.list.invalidate(); setModal(null); toast.success("تم حفظ تعديل العقد في قاعدة البيانات"); }, onError: error => toast.error(`تعذر تعديل العقد: ${error.message}`) });
        return;
      }
      contractCreate.mutate({
        ref: String(contract.ref),
        client: String(contract.client),
        clientId: clients.find(item => item.name === String(contract.client))?.id ?? null,
        type: String(contract.type),
        startDate: String(contract.startDate || formatCompanyDate()),
        expiry: String(contract.expiry),
        total: Number(contract.total || 0),
        collected: Number(contract.collected || 0),
        status: (contract.status || "قائم") as "قائم" | "مكتمل" | "عرض سعر" | "ملغي",
        items: canAccess("vehicles") && canAccess("drivers") && (contract.items as any[])?.length ? (contract.items as any[]) : [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }],
      }, {
        onSuccess: saved => {
          setContracts(prev => [{ ...saved, items: undefined } as Contract, ...prev]);
          utils.contracts.list.invalidate();
          setModal(null);
          toast.success("تم حفظ العقد في قاعدة البيانات");
        },
        onError: error => toast.error(`تعذر حفظ العقد: ${error.message}`),
      });
      return;
    }
    if (modal?.module !== "vehicles") return;
    const payload = {
      plate: String(data.plate || "").trim(),
      brand: String(data.brand || "—"),
      model: String(data.model || "").trim(),
      year: String(data.year || ""),
      color: String(data.color || "—"),
      mileage: String(data.mileage || "0 كم"),
      ...(canAccess("finance") ? {
        purchasePrice: Math.max(0, Math.trunc(Number(data.purchasePrice ?? 0))),
        purchaseDate: String(data.purchaseDate || "—"),
        inServiceDate: String(data.inServiceDate || "—"),
      } : {}),
      ...(canAccess("projects") ? { projectId: data.projectId ? Number(data.projectId) : null, project: String(data.project || "—") } : {}),
      ...(canAccess("drivers") ? { driver: String(data.driver || "—"), driverId: data.driverId ? Number(data.driverId) : null } : {}),
      ...(canAccess("employees") ? { employee: String(data.employee || "—"), employeeId: data.employeeId ? Number(data.employeeId) : null } : {}),
      status: data.status as any,
      ...(canAccess("clients") ? { client: String(data.client || "—"), clientId: data.clientId ? Number(data.clientId) : null } : {}),
      ...(canAccess("finance") ? { contract: String(data.contract || "—"), contractId: data.contractId ? Number(data.contractId) : null } : {}),
      notes: data.notes ? String(data.notes) : undefined,
    };
    const onSuccess = (saved: Row) => { setVehicles(prev => prev.some(v => v.id === saved.id) ? prev.map(v => v.id === saved.id ? saved as Vehicle : v) : [saved as Vehicle, ...prev]); utils.vehicles.list.invalidate(); setModal(null); toast.success("تم حفظ المركبة"); };
    const onError = (error: { message: string }) => toast.error(`تعذر حفظ المركبة: ${error.message}`);
    if (vehicles.some(v => v.id === data.id)) vehicleUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError });
    else vehicleCreate.mutate(payload as any, { onSuccess, onError });
  };
  const saveQuickAction = (value: string, details?: { reference?: string; amount?: number; recipient?: string }) => {
    if (!quickAction) return;
    const id = quickAction.row.id;
    const finish = (message: string, invalidate: () => void) => { invalidate(); setQuickAction(null); toast.success(message); };
    if (active === "maintenance" && quickAction.action === "stage") {
      maintenanceAdvance.mutate({ id, toStage: value as MaintenanceStage }, { onSuccess: () => finish("تم نقل الطلب إلى المرحلة التالية", () => { utils.maintenance.list.invalidate(); utils.vehicles.list.invalidate(); }), onError: e => toast.error(`تعذر نقل طلب الصيانة: ${e.message}`) });
    } else if (active === "maintenance" && quickAction.action === "approval") {
      const approved = value !== "رفض";
      maintenanceDecideApproval.mutate({ id, approved, ...(approved ? { fundingType: value as "عهدة" | "تحويل مباشر", fundingReference: details?.reference, fundingAmount: details?.amount, fundingRecipient: details?.recipient } : {}) }, { onSuccess: () => finish(approved ? `تم اعتماد الطلب وتسجيل ${value}` : "تم رفض الطلب", () => { utils.maintenance.list.invalidate(); utils.vehicles.list.invalidate(); }), onError: e => toast.error(`تعذر حفظ قرار الاعتماد: ${e.message}`) });
    } else if (active === "maintenance" && quickAction.action === "settle-advance") {
      maintenanceSettleAdvance.mutate({ id, reference: value }, { onSuccess: () => finish("تم تسجيل تسوية العهدة", () => utils.maintenance.list.invalidate()), onError: e => toast.error(`تعذر تسوية العهدة: ${e.message}`) });
    } else if (active === "maintenance") {
      const data = quickAction.action === "cost" ? { cost: value } : { type: `${quickAction.row.type} · ${value}` };
      maintenanceUpdate.mutate({ id, data } as any, { onSuccess: () => finish("تم حفظ إجراء الصيانة", () => utils.maintenance.list.invalidate()), onError: e => toast.error(`تعذر حفظ الإجراء: ${e.message}`) });
    } else if (active === "documents" && quickAction.action === "extend") {
      documentUpdate.mutate({ id, data: { expiry: value, status: "ساري" } } as any, { onSuccess: () => finish("تم تمديد المستند", () => utils.documents.list.invalidate()), onError: e => toast.error(`تعذر تمديد المستند: ${e.message}`) });
    } else if (active === "drivers" && quickAction.action === "status") {
      driverUpdate.mutate({ id, data: { status: value } } as any, { onSuccess: () => finish("تم تحديث حالة السائق", () => utils.drivers.list.invalidate()), onError: e => toast.error(`تعذر تحديث السائق: ${e.message}`) });
    } else if (active === "finance" && quickAction.action === "status") {
      contractStatusUpdate.mutate({ id, status: value as "قائم" | "مكتمل" | "عرض سعر" | "ملغي" }, { onSuccess: () => finish("تم تحديث حالة العقد", () => utils.contracts.list.invalidate()), onError: e => toast.error(`تعذر تحديث العقد: ${e.message}`) });
    }
  };
  const sidebarCounts: Partial<Record<ModuleKey, number>> = { vehicles: vehicles.length, projects: projectsQuery.data?.length ?? 0, maintenance: maintenance.length, documents: documents.length, drivers: drivers.length, clients: clients.length, finance: contracts.length + claims.length, payables: payablesQuery.data?.length ?? 0 };
  const registerMaintenanceInvoice = (request: Maintenance) => { setPrefillMaintenanceRequest(request); onNavigate("payables"); };
  const handlePaymentArchive = (payment: PaymentRow) => toast("سيتم إلغاء الدفعة وعكس أثرها المالي؟", { action: { label: "تأكيد", onClick: () => paymentArchive.mutate({ id: payment.id }, { onSuccess: () => { utils.payments.list.invalidate(); utils.contracts.list.invalidate(); utils.claims.list.invalidate(); toast.success("تم إلغاء الدفعة وعكس أثرها"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } });
  const payablesContent = <PayablesPage canAccess={canAccess} vehicles={vehicles} prefillMaintenanceRequest={prefillMaintenanceRequest} onPrefillConsumed={() => setPrefillMaintenanceRequest(null)} />;
  const maintenanceContent = <MaintenancePage maintenance={maintenance} canApprove={canAccess("finance")} canRecordInvoice={canAccess("payables") && canAccess("vehicles")} onRegisterInvoice={registerMaintenanceInvoice} onOpenForm={row => setModal({ module: "maintenance", row })} onAction={onAction} />;
  const content = active === "dashboard" ? <DashboardHome canAccess={canAccess} onNavigateFinanceView={view => { if (!canAccess("finance")) { toast.error("ليس لديك صلاحية الوصول إلى هذا القسم"); return; } setActive("finance"); setMobileOpen(false); navigate(`/dashboard/financial/${view}`); }} onNavigate={onNavigate} userName={user?.name} vehicles={canAccess("vehicles") ? vehicles : []} drivers={canAccess("drivers") ? drivers : []} maintenance={canAccess("maintenance") ? maintenance : []} documents={canAccess("documents") ? documents : []} contracts={canAccess("finance") ? contracts : []} claims={canAccess("finance") ? claims : []} payables={canAccess("payables") ? (payablesQuery.data ?? []) as PayableRow[] : []} projects={canAccess("projects") ? (projectsQuery.data ?? []) as ProjectRow[] : []} tasks={canAccess("dashboard") ? (tasksQuery.data ?? []) as WorkTask[] : []} taskAssignees={(taskAssigneesQuery.data ?? []) as Array<{ id: number; name: string | null }>} relatedRecords={[...(canAccess("vehicles") ? vehicles.map(row => ({ entityType: "vehicle" as const, id: row.id, label: `${row.plate} · ${row.brand} ${row.model}` })) : []), ...(canAccess("maintenance") ? maintenance.map(row => ({ entityType: "maintenance" as const, id: row.id, label: `${row.ref} · ${row.vehicle} · ${row.type}` })) : []), ...(canAccess("projects") ? ((projectsQuery.data ?? []) as ProjectRow[]).map(row => ({ entityType: "project" as const, id: row.id, label: `${row.ref} · ${row.name}` })) : []), ...(canAccess("documents") ? documents.map(row => ({ entityType: "document" as const, id: row.id, label: `${row.name} · ${row.entity}` })) : []), ...(canAccess("drivers") ? drivers.map(row => ({ entityType: "driver" as const, id: row.id, label: row.name })) : []), ...(canAccess("employees") ? ((employeesSearchQuery.data ?? []) as Row[]).map(row => ({ entityType: "employee" as const, id: row.id, label: `${row.employeeNo || ""} · ${row.name}` })) : []), ...(canAccess("clients") ? clients.map(row => ({ entityType: "client" as const, id: row.id, label: row.name })) : []), ...(canAccess("finance") ? contracts.map(row => ({ entityType: "contract" as const, id: row.id, label: `${row.ref} · ${row.client}` })) : []), ...(canAccess("finance") ? claims.map(row => ({ entityType: "claim" as const, id: row.id, label: `${row.ref} · ${row.client}` })) : []), ...(canAccess("payables") ? ((payablesQuery.data ?? []) as PayableRow[]).map(row => ({ entityType: "payable" as const, id: row.id, label: `${row.ref} · ${row.supplier}` })) : [])]} viewerUserId={user?.id ?? 0} notifications={canAccess("dashboard") ? (notificationsQuery.data ?? []) as Array<{ id: number; title: string; message: string; severity: string }> : []} onTaskToggle={task => { const nextStatus = task.status === "مكتملة" ? "مفتوحة" : "مكتملة"; taskUpdate.mutate({ id: task.id, data: { status: nextStatus } }, { onSuccess: () => { utils.tasks.list.invalidate(); toast.success("تم تحديث المهمة"); }, onError: error => toast.error(`تعذر تحديث المهمة: ${error.message}`) }); }} onTaskCreate={task => { taskCreate.mutate({ ...task, status: "مفتوحة" }, { onSuccess: () => { utils.tasks.list.invalidate(); toast.success("تمت إضافة المهمة"); }, onError: error => toast.error(`تعذر إضافة المهمة: ${error.message}`) }); }} canManageTasks={user?.role === "admin"} onNotificationOpen={openNotificationRecord} onOpenNotifications={() => setNotificationCenterOpen(true)} onMaintenanceOpen={setMaintenanceDetail} onTaskOpenRelated={task => { const type = task.relatedEntityType; if (!type || !task.relatedEntityId) return; const module = notificationTarget(type) as ModuleKey; if (!canAccess(module)) { toast.error("لا تملك صلاحية فتح السجل المرتبط بهذه المهمة"); return; } const linkedRows: Record<TaskRelatedEntityType, Row[]> = { vehicle: vehicles, maintenance, project: (projectsQuery.data ?? []) as Row[], document: documents, driver: drivers, employee: (employeesSearchQuery.data ?? []) as Row[], client: clients, contract: contracts, claim: claims, payable: (payablesQuery.data ?? []) as Row[] }; const record = linkedRows[type].find(row => row.id === task.relatedEntityId); if (!record) { toast.error("السجل المرتبط غير موجود أو غير محمّل"); return; } setActive(module); setMobileOpen(false); navigate(module === "finance" ? `/dashboard/financial/${type === "claim" ? "claims" : "contracts"}` : `/dashboard/${module}`); if (module === "vehicles") setVehicleProfile(record as Vehicle); else if (module === "maintenance") setMaintenanceDetail(record as Maintenance); else if (module === "drivers") setDriverDetail(record as Driver); else setDetail({ module, row: record }); }} /> : active === "accidents" ? <AccidentsPage vehicles={vehicles} drivers={drivers} /> : active === "inventory" ? <InventoryPage canApprove={canAccess("finance")} /> : active === "vehicles" ? <VehiclesPage vehicles={vehicles} setVehicles={setVehicles} onOpenForm={row => setModal({ module: "vehicles", row })} onAction={onAction} canAccess={canAccess} /> : active === "projects" ? <ProjectsPage canAccess={canAccess} /> : active === "employees" ? <EmployeesPage canAccess={canAccess} canManageAccounts={user?.role === "admin"} /> : active === "reports" ? <ReportsPage canAccess={canAccess} />: active === "payables" ? payablesContent : active === "maintenance" ? maintenanceContent : active === "documents" ? <DocumentsPage documents={documents} onOpenForm={row => setModal({ module: "documents", row })} onAction={onAction} /> : active === "drivers" ? <DriversPage drivers={drivers} onOpenForm={row => setModal({ module: "drivers", row })} onAction={onAction} onView={setDriverDetail} /> : active === "clients" ? <ClientsPage clients={clients} onOpenForm={row => setModal({ module: "clients", row })} onAction={onAction} /> : active === "finance" ? <FinancePage contracts={contracts} claims={claims} payments={(paymentsQuery.data ?? []) as PaymentRow[]} onAction={onAction} onOpenForm={row => setModal({ module: "finance", row })} onPaymentArchive={handlePaymentArchive} /> : <SettingsPage settingsCount={(settingsQuery.data ?? []).length} auditLogs={(auditQuery.data ?? []) as Array<{ action: string; entityType: string; createdAt?: Date | string }>} />;
  if (authLoading) return <div className="auth-state" dir="rtl">جارٍ التحقق من صلاحية الدخول...</div>;
  if (!user) return <div className="auth-state" dir="rtl">جارٍ تحويلك إلى صفحة تسجيل الدخول...</div>;
  if (!canAccess(active)) return <div className="auth-state" dir="rtl">جارٍ التحقق من صلاحية القسم...</div>;
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}><div className="sidebar-top"><Logo compact={collapsed} /><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="طي القائمة"><ChevronRight size={17} /></button></div><div className="workspace-switch"><span className="workspace-avatar">ه</span><div><strong>الهتاري بلس لإدارة الأسطول</strong><small>الحساب الرئيسي</small></div><ChevronDown size={15} /></div><nav>{navGroups.map(group => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.filter(item => canAccess(item.key as ModuleKey)).map(item => <button key={item.key} className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key as ModuleKey)}><item.icon size={18} /><span>{item.label}</span>{sidebarCounts[item.key] !== undefined && <em>{sidebarCounts[item.key]!.toLocaleString("en-US")}</em>}</button>)}</div>)}</nav><div className="sidebar-bottom"><button className="help-link" onClick={() => toast.info("تواصل مع مسؤول النظام للحصول على المساعدة") }><Headphones size={17} /><span>مركز المساعدة</span></button><div className="sidebar-user"><span className="user-avatar">ع</span><div><strong>{user?.name || "المستخدم"}</strong><small>{user?.role === "admin" ? "مدير النظام" : "مستخدم"}</small></div><button onClick={() => logout()} aria-label="تسجيل الخروج"><LogOut size={16} /></button></div></div></aside>
    {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
    <main className="main-area"><header className="topbar"><div className="topbar-start"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>الرئيسية</span><ChevronLeft size={14} /><strong>{active === "dashboard" ? "الإحصائيات" : navGroups.flatMap(g => g.items).find(i => i.key === active)?.label}</strong></div></div><div className="topbar-actions"><button className="quick-search" onClick={() => { setCommandQuery(""); setCommandOpen(true); }}><Search size={16} /><span>بحث سريع</span><kbd>⌘ K</kbd></button>{canAccess("dashboard") && <button className="top-icon" aria-label="فتح مركز التنبيهات" onClick={() => setNotificationCenterOpen(true)}><Bell size={18} />{Boolean(visibleNotifications.some(item => !item.readAt)) && <i />}</button>}<span className="top-divider" /><div className="top-profile"><span className="user-avatar">ع</span><div><strong>{user?.name || "المستخدم"}</strong><small>{user?.role === "admin" ? "مدير النظام" : "مستخدم"}</small></div><ChevronDown size={14} /></div></div></header><div className="page-content">{hasWorkspaceQueryError && <section className="workspace-data-alert" role="alert"><div><strong>تعذر تحميل بعض بيانات النظام</strong><span>الأقسام المتأثرة: {failedWorkspaceSources.map(source => source.label).join("، ")}. يمكنك متابعة العمل في الأقسام التي تم تحميلها.</span></div><button className="btn outline" onClick={() => void retryFailedWorkspaceSources()} disabled={failedWorkspaceSources.some(source => source.query.isFetching)}>إعادة محاولة التحميل</button></section>}{content}</div><footer className="app-footer"><span>© {new Date().getFullYear()} الهتاري بلس</span><span className={`online ${workspaceStatusTone}`} role="status" aria-live="polite"><i aria-hidden="true" />{workspaceStatus}</span></footer></main>
    {modal && canAccess(modal.module) && <RecordForm module={modal.module} row={modal.row} canAccess={canAccess} onClose={() => setModal(null)} onSave={saveRecord} />}{driverDetail && canAccess("drivers") && <DriverVehiclesModal driver={driverDetail} vehicles={vehicles} documents={documents} canViewDocuments={canAccess("documents")} onClose={() => setDriverDetail(null)} />}{assignmentVehicle && canAccess("vehicles") && <AssignDriverModal vehicle={assignmentVehicle} drivers={drivers} onClose={() => setAssignmentVehicle(null)} onSave={saveAssignment} />}{assignmentDriver && canAccess("drivers") && <AssignVehicleModal driver={assignmentDriver} vehicles={vehicles} onClose={() => setAssignmentDriver(null)} onSave={saveVehicleAssignment} />}{quickAction && canAccess(active) && <QuickActionModal action={quickAction.action} module={active} row={quickAction.row} onClose={() => setQuickAction(null)} onSave={saveQuickAction} />}{vehicleProfile && canAccess("vehicles") && <VehicleProfileModal vehicle={vehicleProfile} canAccess={canAccess} maintenance={maintenance} documents={documents} onClose={() => setVehicleProfile(null)} />}{maintenanceDetail && canAccess("maintenance") && <MaintenanceDetailModal request={maintenanceDetail} linkedInvoices={(payablesQuery.data ?? []) as PayableRow[]} canViewFinance={canAccess("finance")} canViewPayables={canAccess("payables")} canViewDocuments={canAccess("documents")} onOpenPayables={() => { setMaintenanceDetail(null); onNavigate("payables"); }} onClose={() => setMaintenanceDetail(null)} onEdit={() => { setMaintenanceDetail(null); setModal({ module: "maintenance", row: maintenanceDetail }); }} />}{detail && canAccess(detail.module) && <DetailModal module={detail.module} row={detail.row} canAccess={canAccess} onClose={() => setDetail(null)} onEdit={detail.module === "dashboard" ? undefined : () => setModal({ module: detail.module, row: detail.row })} />}
    {notificationCenterOpen && <Modal title="مركز التنبيهات" onClose={() => setNotificationCenterOpen(false)}><div className="compact-list">{visibleNotifications.length ? visibleNotifications.map(notification => { const target = notificationTarget(notification.entityType) as ModuleKey; return <button className="compact-row" key={notification.id} onClick={() => openNotificationRecord(notification)} style={{ width: "100%", textAlign: "right", background: "transparent", border: 0, cursor: "pointer" }}><span className={`alert-icon ${notification.severity === "حرج" ? "red" : notification.severity === "تنبيه" ? "amber" : "blue"}`}><Bell size={16} /></span><span className="compact-main"><strong>{notification.title}</strong><small>{notification.message}{notification.entityId ? ` · فتح ${target}` : ""}</small></span><Badge>{notification.readAt ? "مقروء" : "جديد"}</Badge><ChevronLeft size={15} /></button>; }) : <div className="empty-state"><strong>لا توجد إشعارات</strong><span>ستظهر هنا الإشعارات التشغيلية المرتبطة بسجلاتك.</span></div>}</div></Modal>}
    {commandOpen && <Modal title="البحث السريع" onClose={() => { setCommandOpen(false); setCommandQuery(""); }}><div className="command-search"><Search size={18} /><input autoFocus value={commandQuery} onChange={event => { setCommandQuery(event.target.value); setCommandActiveIndex(0); }} onKeyDown={event => { if (event.key === "ArrowDown" && quickSearchResults.length) { event.preventDefault(); setCommandActiveIndex(index => Math.min(index + 1, quickSearchResults.length - 1)); } else if (event.key === "ArrowUp" && quickSearchResults.length) { event.preventDefault(); setCommandActiveIndex(index => Math.max(0, index - 1)); } else if (event.key === "Enter" && quickSearchResults[commandActiveIndex]) { event.preventDefault(); openQuickSearchResult(quickSearchResults[commandActiveIndex]); } }} aria-label="البحث في سجلات النظام" aria-controls="quick-search-results" aria-activedescendant={commandQuery.trim() && quickSearchResults.length ? `quick-search-result-${commandActiveIndex}` : undefined} placeholder="ابحث برقم اللوحة أو الاسم أو المرجع..." /></div><div className="command-list" id="quick-search-results" role={commandQuery.trim() ? "listbox" : undefined}>{commandQuery.trim() ? (quickSearchResults.length ? quickSearchResultsContent : quickSearchEmptyState) : <><div className="field-note">ابحث في السجلات التي تملك صلاحية عرضها، أو استخدم اختصار Ctrl/⌘ + K.</div><button onClick={() => { onNavigate("vehicles"); setCommandOpen(false); }}><CarFront size={16} /><span>الانتقال إلى المركبات</span><kbd>↵</kbd></button><button onClick={() => { onNavigate("maintenance"); setCommandOpen(false); }}><Wrench size={16} /><span>فتح طلب صيانة جديد</span><kbd>↵</kbd></button><button onClick={() => { onNavigate("documents"); setCommandOpen(false); }}><FileText size={16} /><span>عرض المستندات</span><kbd>↵</kbd></button></>}</div></Modal>}
  </div>;
}
