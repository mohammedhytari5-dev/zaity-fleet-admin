import { Children, Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isLinkedDocument } from "@/lib/documentRelations";
import { useAuth } from "@/_core/hooks/useAuth";
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

type ModuleKey = "dashboard" | "vehicles" | "projects" | "maintenance" | "documents" | "drivers" | "employees" | "clients" | "finance" | "payables" | "reports" | "settings";
type Row = Record<string, any> & { id: number };

type Vehicle = Row & { plate: string; brand: string; model: string; year: string; color: string; mileage: string; driver: string; status: string; client: string; contract: string; purchasePrice?: number; purchaseDate?: string; inServiceDate?: string; expenseTotal?: number; revenueTotal?: number; netOperatingReturn?: number };
type ProjectRow = Row & { ref: string; name: string; client: string; contract: string; manager: string; startDate: string; endDate: string; requiredVehicles: number; actualVehicles: number; status: string };
type Driver = Row & { name: string; phone: string; idNo: string; status: string; vehicle: string; license: string; renewal: string };
type Client = Row & { name: string; location: string; vat: string; commercial: string; contact: string; phone: string; contracts: number };
type Maintenance = Row & { ref: string; vehicle: string; type: string; manager: string; start: string; due: string; status: string; cost?: string };
type Document = Row & { name: string; entity: string; entityType?: string | null; entityId?: number | string | null; type: string; expiry: string; status: string; owner: string };
type Contract = Row & { ref: string; client: string; type: string; total: number; collected: number; expiry: string; status: string };
type Claim = Row & { ref: string; client: string; contract: string; amount: number; due: string; paid: number; status: string };
type PaymentRow = Row & { amount: number; paidAt: string; method: string; reference: string; contractId?: number | null; claimId?: number | null; clientId?: number | null };

const navGroups: { label: string; items: { key: ModuleKey; label: string; icon: any; count?: string }[] }[] = [
  { label: "نظرة عامة", items: [{ key: "dashboard", label: "الإحصائيات", icon: LayoutDashboard }] },
  { label: "التشغيل", items: [
    { key: "vehicles", label: "المركبات", icon: CarFront },
    { key: "projects", label: "المشاريع", icon: Truck },
    { key: "maintenance", label: "الصيانة", icon: Wrench },
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
  return (["vehicles", "projects", "maintenance", "documents", "drivers", "employees", "clients", "payables", "reports", "settings"] as const).includes(segment as any)
    ? segment as ModuleKey
    : "dashboard";
}

const statusTone: Record<string, string> = {
  "متاحة": "green", "متاح": "green", "ساري": "green", "مكتمل": "green", "نشط": "green", "قائم": "green", "مدفوعة": "green", "مدفوعة جزئيًا": "amber", "معتمدة": "blue", "مخطط": "blue", "تم اعتمادها": "blue", "تم صرفها": "green",
  "مؤجرة": "blue", "مشغولة": "blue", "جاري العمل": "amber", "قريبًا": "amber", "مستحقة": "amber", "جديد": "amber", "جديدة": "amber", "غير مرفوعة": "gray", "تحت الإجراء": "amber", "قيد التجهيز": "amber", "إجازة": "amber", "منتهي الخدمة": "gray",
  "في الصيانة": "red", "متوقفة": "red", "موقوف": "red", "متأخر": "red", "متأخرة": "red", "مرفوضة": "red", "متوقف": "red", "متأخر 2 يوم": "red", "ملغاة": "gray",
};

function Badge({ children }: { children: string }) {
  return <span className={`status-badge ${statusTone[children] || "gray"}`}><i />{children}</span>;
}
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-mark ${compact ? "compact" : ""}`}><span className="brand-monogram">هـ</span>{!compact && <span><strong>الهتاري</strong><small>PLUS</small></span>}</div>;
}
function formatSAR(value: number) { return `${value.toLocaleString("en-US")} SAR`; }
function formatCurrencyText(value: unknown) { return String(value ?? "0 SAR").replace(/ر\.س/g, "SAR"); }
function exportCsv(rows: Row[], columns: string[], filename: string) {
  const csv = [columns.join(","), ...rows.map(row => columns.map(c => `"${String(row[c] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${filename}.csv`; link.click(); URL.revokeObjectURL(link.href);
  toast.success("تم تجهيز ملف التصدير بنجاح");
}

function MetricCard({ title, value, helper, icon: Icon, tone, trend }: { title: string; value: string; helper: string; icon: any; tone: string; trend?: string }) {
  return <div className="metric-card">
    <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
    <div className="metric-content"><span>{title}</span><strong>{value}</strong><small className={trend?.startsWith("+") ? "trend-up" : ""}>{trend || helper}</small></div>
    <span className="metric-helper">{helper}</span>
  </div>;
}

function Chart({ maintenance }: { maintenance: Maintenance[] }) {
  const labels = ["جديد", "جاري العمل", "مكتمل", "متوقف"];
  const counts = labels.map(label => maintenance.filter(item => item.status === label).length);
  const max = Math.max(1, ...counts);
  return <div className="chart-wrap">
    <div className="chart-y"><span>{max}</span><span>{Math.round(max * .75)}</span><span>{Math.round(max * .5)}</span><span>{Math.round(max * .25)}</span><span>٠</span></div>
    <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="chart-svg" role="img" aria-label="توزيع طلبات الصيانة">
      <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a9814d" stopOpacity=".18"/><stop offset="1" stopColor="#a9814d" stopOpacity="0"/></linearGradient></defs>
      {[28,58,88,118,148].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#e9eeec" strokeWidth="1" />)}
      {counts.map((count, i) => { const x = 75 + i * 150; const y = 148 - (count / max) * 120; return <g key={labels[i]}><rect x={x - 24} y={y} width="48" height={148 - y} rx="8" fill="#a9814d" opacity=".82" /><text x={x} y={Math.max(16, y - 8)} textAnchor="middle" fill="#25364c" fontSize="12">{count}</text></g>; })}
    </svg>
    <div className="chart-x">{labels.map(label => <span key={label}>{label}</span>)}</div>
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
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value?: string; onChange?: (v: string) => void; placeholder?: string; type?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ""} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} /></label>;
}
function FormActions({ onCancel, label = "حفظ التغييرات" }: { onCancel: () => void; label?: string }) { return <div className="form-actions"><button className="btn primary" type="submit"><Check size={16} />{label}</button><button className="btn ghost" type="button" onClick={onCancel}>إلغاء</button></div>; }

function LinkedDocumentsSection({ entityType, entityId, canViewDocuments }: { entityType: string; entityId: number; canViewDocuments: boolean }) {
  const query = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canViewDocuments });
  const linked = ((query.data as Document[] | undefined) ?? []).filter(document => isLinkedDocument(document, entityType, entityId));
  return <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>المستندات المرتبطة</h3><span>{canViewDocuments ? `${linked.length} مستند` : "يلزم إذن المستندات لعرض المرفقات"}</span></div></div>{!canViewDocuments ? <div className="field-note" role="status">يلزم منح صلاحية «المستندات» لعرض المرفقات.</div> : linked.length ? <div className="compact-list">{linked.map(document => <div className="compact-row" key={document.id}><div className="compact-main"><strong>{document.name}</strong><small>{document.type} · ينتهي {document.expiry}</small></div><Badge>{document.status}</Badge><DocumentFileActions file={document} /></div>)}</div> : <div className="empty-state" style={{ padding: "1.25rem" }}>لا توجد مستندات مرتبطة بهذا السجل.</div>}</section>;
}

function DocumentFileActions({ file }: { file: Document }) {
  if (!file.fileUrl) return null;
  const openPreview = () => window.open(String(file.fileUrl), "_blank", "noopener,noreferrer");
  const download = () => {
    const link = document.createElement("a");
    link.href = String(file.fileUrl);
    link.download = String(file.fileName || file.name || "document");
    link.click();
  };
  return <div className="row-actions"><button className="row-menu-btn" title="تحميل المستند" aria-label={`تحميل ${file.name}`} onClick={download}><Download size={16} /></button><button className="row-menu-btn" title="معاينة المستند" aria-label={`معاينة ${file.name}`} onClick={openPreview}><BookOpen size={16} /></button></div>;
}

function DetailModal({ row, module, canAccess, onClose, onEdit }: { row: Row; module: ModuleKey; canAccess: (key: ModuleKey) => boolean; onClose: () => void; onEdit: () => void }) {
  const title = module === "vehicles" ? `تفاصيل المركبة · ${row.plate}` : module === "drivers" ? `ملف السائق · ${row.name}` : module === "clients" ? `ملف العميل · ${row.name}` : "تفاصيل السجل";
  const linkedEntityType = module === "clients" ? "عميل" : module === "employees" ? "موظف" : module === "projects" ? "مشروع" : module === "maintenance" ? "صيانة" : module === "finance" ? (row.recordType === "payment" ? null : row.recordType === "claim" || String(row.ref || "").startsWith("CL-") ? "مطالبة" : "عقد") : null;
  const entries = Object.entries(row).filter(([key]) => key !== "id" && key !== "fileUrl");
  const displayValue = (value: unknown) => {
    if (value instanceof Date) return value.toLocaleString("en-US");
    if (typeof value === "number") return value.toLocaleString("en-US");
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  return <Modal title={title} onClose={onClose} wide><div className="detail-grid">{entries.map(([key, value]) => <div className="detail-cell" key={key}><span>{key === "plate" ? "رقم اللوحة" : key === "brand" ? "الشركة" : key === "model" ? "الموديل" : key === "status" ? "الحالة" : key === "driver" ? "السائق" : key === "client" ? "العميل" : key === "phone" ? "رقم الهاتف" : key === "location" ? "الموقع" : key === "vehicle" ? "المركبة الحالية" : key === "contracts" ? "العقود" : key === "fileName" ? "اسم الملف" : key}</span><strong>{displayValue(value)}</strong></div>)}</div>{linkedEntityType && <LinkedDocumentsSection entityType={linkedEntityType} entityId={row.id} canViewDocuments={canAccess("documents")} />}<div className="detail-footer"><button className="btn ghost" onClick={onClose}>إغلاق</button>{module === "documents" && row.fileUrl && <button className="btn outline" onClick={() => window.open(String(row.fileUrl), "_blank", "noopener,noreferrer")}><BookOpen size={15} />معاينة الملف</button>}<button className="btn primary" onClick={() => { onClose(); onEdit(); }}><Pencil size={15} />تعديل البيانات</button></div></Modal>;
}

function RecordForm({ module, row, canAccess, onClose, onSave }: { module: ModuleKey; row?: Row | null; canAccess: (key: ModuleKey) => boolean; onClose: () => void; onSave: (data: Row) => void }) {
  const isEdit = Boolean(row);
  const isClaim = module === "finance" && (row?.recordType === "claim" || String(row?.ref || "").startsWith("CL-"));
  const isPayment = module === "finance" && row?.recordType === "payment";
  const claimStatusTransitions: Record<string, string[]> = { "غير مرفوعة": ["جديدة", "ملغاة"], "جديدة": ["تحت الإجراء", "مرفوضة", "ملغاة"], "تحت الإجراء": ["جديدة", "تم اعتمادها", "مرفوضة", "ملغاة"], "تم اعتمادها": ["تحت الإجراء", "ملغاة"], "تم صرفها": [], "مرفوضة": ["جديدة", "ملغاة"], "ملغاة": ["جديدة"] };
  const defaults: Row = module === "maintenance"
    ? { id: Date.now(), ref: `MT-${Math.floor(24000 + Math.random() * 900)}`, vehicle: "", type: "صيانة دورية", reason: "", workDone: "", parts: "", manager: "", start: new Date().toISOString().slice(0, 10), due: "", expectedReturn: "", status: "جديد", cost: "0 SAR" }
    : module === "documents"
      ? { id: Date.now(), name: "", entity: "", entityType: "مركبة", entityId: null, type: "مركبة", expiry: "", status: "ساري", owner: "" }
      : module === "finance"
        ? (isPayment ? { id: Date.now(), recordType: "payment", clientId: null, contractId: null, claimId: null, amount: 0, paidAt: "", method: "تحويل بنكي", reference: "—", notes: "" } : isClaim ? { id: Date.now(), recordType: "claim", ref: `CL-${Math.floor(10000 + Math.random() * 900)}`, client: "", contract: "", amount: 0, paid: 0, due: "", submittedAt: "", followUpAt: "", notes: "", status: "جديدة" } : { id: Date.now(), ref: `CN-${Math.floor(24000 + Math.random() * 900)}`, client: "", type: "تشغيل أسطول", total: 0, collected: 0, expiry: "", status: "قائم", items: [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }] })
        : module === "drivers"
          ? { id: Date.now(), name: "", phone: "", idNo: "", license: "خصوصي", renewal: "", vehicle: "—", status: "متاح" }
          : module === "clients"
            ? { id: Date.now(), name: "", location: "", vat: "", commercial: "", contact: "", phone: "", contracts: 0 }
            : { id: Date.now(), plate: "", brand: "تويوتا", model: "", year: "2026", color: "أبيض", mileage: "0 كم", purchasePrice: 0, purchaseDate: "—", inServiceDate: "—", projectId: null, project: "—", driver: "—", employeeId: null, employee: "—", status: "متاحة", client: "—", contract: "—" };
  const [form, setForm] = useState<Row>(row || defaults);
  const editableClaimStatuses = Array.from(new Set([String(form.status || "جديدة"), ...(claimStatusTransitions[String(form.status || "جديدة")] || [])]));
  const set = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const { data: vehicles = [] } = trpc.vehicles.list.useQuery(undefined, { enabled: canAccess("vehicles") });
  const { data: drivers = [] } = trpc.drivers.list.useQuery(undefined, { enabled: canAccess("drivers") });
  const { data: clients = [] } = trpc.clients.list.useQuery(undefined, { enabled: canAccess("clients") });
  const { data: contracts = [] } = trpc.contracts.list.useQuery(undefined, { enabled: canAccess("finance") });
  const { data: claims = [] } = trpc.claims.list.useQuery(undefined, { enabled: canAccess("finance") });
  const { data: projects = [] } = trpc.projects.list.useQuery(undefined, { enabled: canAccess("projects") });
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, { enabled: canAccess("employees") });
  const { data: maintenance = [] } = trpc.maintenance.list.useQuery(undefined, { enabled: canAccess("maintenance") });
  const getDocumentEntities = (type: string): Row[] => type === "مركبة" ? vehicles : type === "سائق" ? drivers : type === "موظف" ? employees : type === "مشروع" ? projects : type === "عميل" ? clients : type === "عقد" ? contracts : type === "مطالبة" ? claims : type === "صيانة" ? maintenance : [];
  const { data: settings = [] } = trpc.settingsCatalog.list.useQuery();
  const selectedClaimClient = clients.find(client => String(client.id) === String(form.clientId)) ?? clients.find(client => client.name === String(form.client || ""));
  const claimClientContracts = contracts.filter(contract => selectedClaimClient && (contract.clientId === selectedClaimClient.id || (!contract.clientId && contract.client === selectedClaimClient.name)));
  const submit = (e: React.FormEvent) => { e.preventDefault(); const required = isPayment ? form.amount && form.paidAt : module === "vehicles" ? form.plate : module === "maintenance" ? form.vehicle : module === "documents" ? form.name : module === "finance" ? form.client : form.name; if (!required) { toast.error("أكمل الحقول المطلوبة أولًا"); return; } if (module === "clients" && !isEdit && (!form.vat || !form.commercial)) { toast.error("الرقم الضريبي والسجل التجاري حقول مطلوبة"); return; } if (module === "clients" && form.vat && !/^\d{15}$/.test(String(form.vat))) { toast.error("الرقم الضريبي يجب أن يتكون من 15 رقمًا"); return; } if (module === "clients" && form.commercial && !/^\d{10}$/.test(String(form.commercial))) { toast.error("السجل التجاري يجب أن يتكون من 10 أرقام"); return; } onSave(module === "finance" && !isPayment && !isClaim ? { ...form, notes: form.notes ?? "", items: ((form.items as any[])?.length ? form.items : [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }]).map((item: any) => ({ ...item, coverage: ["مركبة وسائق", "سائق فقط", "مركبة فقط"].includes(item.coverage) ? item.coverage : "مركبة وسائق" })) } : form); };
  if (module === "vehicles") return <Modal title={isEdit ? "تعديل بيانات المركبة" : "إضافة مركبة جديدة"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><Field label="رقم اللوحة *" value={form.plate} onChange={set("plate")} placeholder="مثال: أ ب ج 4821" /><label className="field"><span>شركة السيارة</span><select value={form.brand} onChange={e => set("brand")(e.target.value)}><option value="—">اختر الماركة</option>{(settings ?? []).filter(s => s.category === "car_companies" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><label className="field"><span>الموديل</span><select value={form.model} onChange={e => set("model")(e.target.value)}><option value="">اختر الموديل</option>{(settings ?? []).filter(s => s.category === "car_models" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="سنة الصنع" value={form.year} onChange={set("year")} /><label className="field"><span>اللون</span><select value={form.color} onChange={e => set("color")(e.target.value)}><option value="">اختر اللون</option>{(settings ?? []).filter(s => s.category === "colors" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="عداد المسافة" value={form.mileage} onChange={set("mileage")} />{canAccess("finance") && <><Field label="قيمة الشراء (SAR)" value={String(form.purchasePrice ?? 0)} onChange={value => setForm(prev => ({ ...prev, purchasePrice: Number(value.replace(/[^0-9]/g, "")) || 0 }))} type="number" /><Field label="تاريخ الشراء" value={form.purchaseDate && form.purchaseDate !== "—" ? form.purchaseDate : ""} onChange={set("purchaseDate")} type="date" /><Field label="تاريخ دخول الشركة / الخدمة" value={form.inServiceDate && form.inServiceDate !== "—" ? form.inServiceDate : ""} onChange={set("inServiceDate")} type="date" /></>}<label className="field"><span>الحالة</span><select value={form.status} onChange={e => set("status")(e.target.value)}><option>متاحة</option><option>مؤجرة</option><option>مشغولة</option><option>في الصيانة</option><option>قيد التجهيز</option><option>متوقفة</option></select></label><label className="field"><span>السائق</span><select value={form.driverId || ""} onChange={e => { const d = drivers.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, driverId: d ? d.id : null, driver: d ? d.name : "—"})); }}><option value="">بدون سائق</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>{canAccess("employees") && <label className="field"><span>الموظف المسؤول</span><select value={form.employeeId || ""} onChange={e => { const employee = employees.find(item => String(item.id) === e.target.value); setForm(prev => ({ ...prev, employeeId: employee?.id ?? null, employee: employee?.name ?? "—" })); }}><option value="">بدون موظف مسؤول</option>{employees.filter(employee => employee.status === "نشط").map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.jobTitle}</option>)}</select></label>}<label className="field"><span>العميل</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—"})); }}><option value="">بدون عميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>العقد</span><select value={form.contractId || ""} onChange={e => { const cn = contracts.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, contractId: cn ? cn.id : null, contract: cn ? cn.ref : "—"})); }}><option value="">بدون عقد</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label>{canAccess("projects") ? <label className="field"><span>المشروع</span><select value={form.projectId || ""} onChange={e => { const project = projects.find(item => String(item.id) === e.target.value); setForm(prev => ({ ...prev, projectId: project?.id ?? null, project: project?.name ?? "—" })); }}><option value="">بدون مشروع</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : <label className="field"><span>المشروع المرتبط</span><input value={form.project || "—"} disabled /></label>}</div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إضافة المركبة"} /></form></Modal>;
  if (module === "maintenance") return <Modal title={isEdit ? "تعديل طلب الصيانة" : "طلب صيانة جديد"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>المركبة *</span><select value={form.vehicleId || ""} onChange={e => { const v = vehicles.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, vehicleId: v ? v.id : null, vehicle: v ? v.plate : ""})); }}><option value="">اختر مركبة</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.brand}</option>)}</select></label><label className="field"><span>نوع الصيانة</span><select value={form.type} onChange={e => set("type")(e.target.value)}><option value="—">اختر النوع</option>{(settings ?? []).filter(s => s.category === "pm" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><label className="field"><span>مسؤول الصيانة</span><select value={form.manager} onChange={e => set("manager")(e.target.value)}><option value="—">اختر مسؤول</option>{drivers.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></label><Field label="تاريخ البداية" value={form.start} onChange={set("start")} type="date" /><Field label="سبب العطل / التشخيص" value={form.reason} onChange={set("reason")} /><Field label="تاريخ بدء الصيانة" value={form.start} onChange={set("start")} type="date" /><Field label="تاريخ الاستحقاق" value={form.due} onChange={set("due")} type="date" /><Field label="العودة المتوقعة للتشغيل" value={form.expectedReturn} onChange={set("expectedReturn")} type="date" /><Field label="قطع الغيار المستخدمة" value={form.parts} onChange={set("parts")} /><Field label="العمل المنجز" value={form.workDone} onChange={set("workDone")} />{canAccess("finance") && <><Field label="التكلفة (SAR)" value={formatCurrencyText(form.cost || "0 SAR")} onChange={set("cost")} /><small className="field-note">إذا كانت تكلفة أمر الصيانة ستسجل أيضًا كفاتورة مورد مرتبطة بالباص، اترك هذا المبلغ صفرًا واربط الفاتورة من «المستحقات علينا» حتى لا يتكرر احتسابها.</small><label className="field"><span>فاتورة/صورة الصيانة (حد 700 ك.ب)</span><input type="file" accept="image/*,.pdf" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 700000) { toast.error("الحد الأقصى للمرفق 700 كيلوبايت"); return; } const reader = new FileReader(); reader.onload = () => setForm(prev => ({ ...prev, receiptName: file.name, receiptUrl: String(reader.result || "") })); reader.readAsDataURL(file); }} />{form.receiptName && <small>{form.receiptName}</small>}</label></>}</div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إنشاء طلب الصيانة"} /></form></Modal>;
  if (module === "documents") return <Modal title={isEdit ? "تعديل بيانات المستند" : "رفع مستند جديد"} onClose={onClose}><form onSubmit={submit}><div className="form-grid single"><Field label="اسم المستند *" value={form.name} onChange={set("name")} /><label className="field"><span>نوع الكيان المرتبط</span><select value={form.entityType || "مركبة"} onChange={e => setForm(prev => ({ ...prev, entityType: e.target.value, entityId: null, entity: "—" }))}><option>مركبة</option><option>سائق</option><option>موظف</option><option>مشروع</option><option>عميل</option><option>عقد</option><option>مطالبة</option><option>صيانة</option></select></label><label className="field"><span>الكيان المرتبط</span><select value={form.entityId || ""} onChange={e => { const options = getDocumentEntities(String(form.entityType || "مركبة")); const item = options.find((entity: any) => String(entity.id) === e.target.value); setForm(prev => ({ ...prev, entityId: item?.id ?? null, entity: item ? (item.plate || item.ref || item.name || item.title || `#${item.id}`) : "—" })); }}><option value="">اختر كيان</option>{getDocumentEntities(String(form.entityType || "مركبة")).map((entity: any) => <option key={entity.id} value={entity.id}>{entity.plate || entity.ref || entity.name || entity.title || `#${entity.id}`}</option>)}</select></label><label className="field"><span>النوع</span><select value={form.type} onChange={e => set("type")(e.target.value)}><option value="">اختر نوع المستند</option>{(settings ?? []).filter(s => s.category === "attachment_names" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="تاريخ الانتهاء" value={form.expiry} onChange={set("expiry")} type="date" /><label className="field"><span>الملف</span><input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 700000) { toast.error("الملف كبير؛ الحد الحالي 700 كيلوبايت"); return; } const reader = new FileReader(); reader.onload = () => setForm(prev => ({ ...prev, fileName: file.name, fileUrl: String(reader.result || "") })); reader.readAsDataURL(file); }} /></label></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "رفع المستند"} /></form></Modal>;
  if (module === "finance" && isPayment) return <Modal title="تسجيل دفعة مالية" onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>رقم العقد</span><select value={form.contractId || ""} onChange={e => { const contract = contracts.find(c => String(c.id) === e.target.value); setForm(prev => ({ ...prev, contractId: contract ? contract.id : null, clientId: contract?.clientId ?? prev.clientId ?? null })); }}><option value="">اختر العقد</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label><label className="field"><span>المطالبة المرتبطة</span><select value={form.claimId || ""} onChange={e => { const claim = claims.find(c => String(c.id) === e.target.value); setForm(prev => ({ ...prev, claimId: claim ? claim.id : null, contractId: claim?.contractId ?? prev.contractId ?? null, clientId: claim?.clientId ?? prev.clientId ?? null })); }}><option value="">بدون مطالبة</option>{claims.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label><label className="field"><span>العميل</span><select value={form.clientId || ""} onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="المبلغ *" value={String(form.amount ?? "")} onChange={v => setForm(prev => ({ ...prev, amount: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الدفع *" value={form.paidAt} onChange={set("paidAt")} type="date" /><label className="field"><span>طريقة الدفع</span><select value={form.method} onChange={e => set("method")(e.target.value)}>{(settings ?? []).filter(s => s.category === "payment_methods" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}<option value="تحويل بنكي">تحويل بنكي</option></select></label><Field label="المرجع" value={form.reference} onChange={set("reference")} /></div><FormActions onCancel={onClose} label="حفظ الدفعة" /></form></Modal>;
  if (module === "finance" && isClaim) return <Modal title={isEdit ? "تعديل المطالبة المالية" : "إنشاء مطالبة مالية"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—", contractId: null, contract: "—"})); }}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>العقد *</span><select value={form.contractId || ""} disabled={!selectedClaimClient} onChange={e => { const cn = claimClientContracts.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, contractId: cn ? cn.id : null, contract: cn ? cn.ref : "—"})); }}><option value="">{selectedClaimClient ? claimClientContracts.length ? "اختر العقد" : "لا توجد عقود لهذا العميل" : "اختر العميل أولًا"}</option>{claimClientContracts.map(c => <option key={c.id} value={c.id}>{c.ref}</option>)}</select></label><Field label="قيمة المطالبة" value={String(form.amount ?? "")} onChange={v => setForm(prev => ({ ...prev, amount: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الرفع" value={form.submittedAt} onChange={set("submittedAt")} type="date" /><Field label="تاريخ الاستحقاق" value={form.due} onChange={set("due")} type="date" /><Field label="موعد المتابعة" value={form.followUpAt} onChange={set("followUpAt")} type="date" /><label className="field"><span>الحالة</span><select value={form.status} disabled={form.status === "تم صرفها"} onChange={e => set("status")(e.target.value)}>{editableClaimStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select>{form.status === "تم صرفها" && <small>تتغير هذه الحالة تلقائيًا عند تسجيل دفعة تغطي كامل قيمة المطالبة.</small>}</label><Field label="ملاحظات المتابعة" value={form.notes} onChange={set("notes")} /></div><FormActions onCancel={onClose} label={isEdit ? "حفظ المطالبة" : "إنشاء المطالبة"} /></form></Modal>;
  if (module === "finance") return <Modal title={isEdit ? "تعديل العقد" : "إنشاء عقد مالي"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—"})); }}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="نوع العقد" value={form.type} onChange={set("type")} /><Field label="تاريخ البداية" value={form.startDate} onChange={set("startDate")} type="date" /><Field label="القيمة الإجمالية" value={String(form.total ?? "")} onChange={v => setForm(prev => ({ ...prev, total: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="المحصل (تُنشأ دفعة تلقائيًا)" value={String(form.collected ?? "")} onChange={v => setForm(prev => ({ ...prev, collected: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الانتهاء" value={form.expiry} onChange={set("expiry")} type="date" /><label className="field"><span>المركبة المرتبطة</span><select value={form.items?.[0]?.vehicleId || ""} onChange={e => { const v = vehicles.find(x => String(x.id) === e.target.value); setForm(prev => ({ ...prev, items: [{ ...(prev.items?.[0] || {}), vehicleId: v ? v.id : null, vehiclePlate: v ? v.plate : "—" }] })); }}><option value="">بدون مركبة</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}</select></label><Field label="السائق المرتبط" value={form.items?.[0]?.driver || "—"} onChange={v => setForm(prev => ({ ...prev, items: [{ ...(prev.items?.[0] || {}), driver: v }] }))} /></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إنشاء العقد"} /></form></Modal>;
  const config = module === "drivers" ? { title: isEdit ? "تعديل بيانات السائق" : "إضافة سائق جديد", fields: [["name", "الاسم الكامل *"], ["phone", "رقم الهاتف"], ["idNo", "رقم الهوية / الإقامة"], ["license", "نوع الرخصة"], ["renewal", "تاريخ انتهاء الرخصة"]] } : { title: isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد", fields: [["name", "اسم العميل *"], ["vat", "الرقم الضريبي * (15 رقمًا)"], ["commercial", "السجل التجاري * (10 أرقام)"], ["location", "الموقع"], ["contact", "اسم الممثل"], ["phone", "رقم اتصال الممثل"]] };
  return <Modal title={config.title} onClose={onClose}><form onSubmit={submit}><div className="form-grid single">{config.fields.map(([key, label]) => key === "license" ? <label className="field" key={key}><span>{label}</span><select value={form[key]} onChange={e => set(key)(e.target.value)}><option value="">اختر نوع الترخيص</option>{(settings ?? []).filter(s => s.category === "license_types" && s.active).map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label> : <Field key={key} label={label} value={form[key]} onChange={set(key)} />)}</div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إضافة السجل"} /></form></Modal>;
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

function QuickActionModal({ action, module, row, onClose, onSave }: { action: string; module: ModuleKey; row: Row; onClose: () => void; onSave: (value: string) => void }) {
  const statusOptions = module === "maintenance" ? ["جديد", "جاري العمل", "مكتمل", "متوقف"] : module === "drivers" ? ["متاح", "مشغول", "موقوف"] : ["قائم", "مكتمل", "عرض سعر", "ملغي"];
  const config: Record<string, { title: string; label: string; placeholder?: string; options?: string[] }> = {
    status: { title: "تغيير الحالة", label: "الحالة الجديدة", options: statusOptions },
    extend: { title: "تمديد تاريخ الانتهاء", label: "التاريخ الجديد", placeholder: "مثال: 30 ديسمبر 2026" },
    cost: { title: "تسجيل تكلفة أو فاتورة", label: "التكلفة", placeholder: "مثال: 1,250 SAR" },
    item: { title: "إضافة بند صيانة", label: "وصف البند", placeholder: "مثال: تغيير زيت وفلتر" },
  };
  const entry = config[action] || config.status;
  const [value, setValue] = useState(entry.options?.[0] || "");
  return <Modal title={entry.title} onClose={onClose}><form onSubmit={e => { e.preventDefault(); if (!value.trim()) { toast.error("أدخل قيمة صحيحة"); return; } onSave(value); }}><div className="form-grid single"><div className="action-context"><strong>{row.ref || row.name || row.plate || "السجل المحدد"}</strong><span>سيتم تطبيق الإجراء على هذا السجل فقط.</span></div>{entry.options ? <label className="field"><span>{entry.label}</span><select value={value} onChange={e => setValue(e.target.value)}>{entry.options.map(option => <option key={option}>{option}</option>)}</select></label> : <Field label={entry.label} value={value} onChange={setValue} placeholder={entry.placeholder} />}</div><FormActions onCancel={onClose} label="حفظ الإجراء" /></form></Modal>;
}

function ContextMenu({ row, module, onAction, onClose }: { row: Row; module: ModuleKey; onAction: (action: string) => void; onClose: () => void }) {
  const isClaimRecord = module === "finance" && String(row.ref || "").startsWith("CL-");
  const actions = module === "vehicles" ? [["عرض التفاصيل", "view"], ["تعديل المركبة", "edit"], ["إضافة إلى الصيانة", "maintenance"], ["إسناد سائق", "assign"], ["أرشفة المركبة", "archive"]] : module === "maintenance" ? [["عرض التفاصيل", "view"], ["تعديل الطلب", "edit"], ["إضافة بند صيانة", "item"], ["تسجيل تكلفة أو فاتورة", "cost"], ["تغيير الحالة", "status"]] : module === "documents" ? [["معاينة المستند", "view"], ["تحميل الملف", "download"], ["تعديل البيانات", "edit"], ["تمديد تاريخ الانتهاء", "extend"], ["أرشفة المستند", "archive"]] : module === "drivers" ? [["عرض الملف الشخصي", "view"], ["تعديل البيانات", "edit"], ["إسناد مركبة", "assign"], ["تغيير الحالة", "status"], ["أرشفة السائق", "archive"]] : module === "clients" ? [["عرض تفاصيل العميل", "view"], ["تعديل العميل", "edit"], ["عرض العقود", "contracts"], ["عرض المطالبات المالية", "claims"], ["إنشاء عقد جديد", "new-contract"]] : module === "finance" && isClaimRecord ? [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["أرشفة المطالبة", "archive"]] : [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["تغيير الحالة", "status"], ["تصدير السجل", "download"]];
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

function DashboardHome({ onNavigate, userName, tasks, notifications, vehicles, drivers, maintenance, documents, contracts, claims, payables, projects, onTaskToggle, onTaskCreate }: { onNavigate: (key: ModuleKey) => void; userName?: string | null; tasks: Array<{ id: number; title: string; dueAt: string; status: string }>; notifications: Array<{ id: number; title: string; message: string; severity: string; readAt?: Date | string | null; entityType?: string | null }>; vehicles: Vehicle[]; drivers: Driver[]; maintenance: Maintenance[]; documents: Document[]; contracts: Contract[]; claims: Claim[]; payables: PayableRow[]; projects: ProjectRow[]; onTaskToggle: (task: { id: number; status: string }) => void; onTaskCreate: () => void }) {
  const totalVehicles = vehicles.length;
  const workingVehicles = vehicles.filter(v => ["مؤجرة", "مشغولة"].includes(v.status)).length;
  const readyVehicles = vehicles.filter(v => v.status === "متاحة").length;
  const maintenanceVehicles = vehicles.filter(v => v.status === "في الصيانة").length;
  const stoppedVehicles = vehicles.filter(v => v.status === "متوقفة").length;
  const setupVehicles = vehicles.filter(v => v.status === "قيد التجهيز").length;
  const operationRate = totalVehicles ? ((workingVehicles / totalVehicles) * 100).toFixed(1).replace(".", "٫") : "٠";
  const receivable = claims.filter(claim => !["تم صرفها", "ملغاة", "مرفوضة"].includes(claim.status)).reduce((sum, claim) => sum + Math.max(0, Number(claim.amount) - Number(claim.paid)), 0);
  const payable = payables.filter(item => item.status !== "ملغاة").reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  const targetByEntity: Record<string, ModuleKey> = { vehicle: "vehicles", vehicles: "vehicles", claim: "finance", contract: "finance", document: "documents", maintenance: "maintenance", project: "projects", payable: "payables" };
  const parseDate = (value: string | undefined) => value && value !== "—" ? Date.parse(`${value}T23:59:59`) : NaN;
  const now = Date.now(); const soon = now + 30 * 24 * 60 * 60 * 1000;
  const automaticAlerts: Array<{ id: number; title: string; message: string; severity: string; target: ModuleKey }> = [
    ...claims.filter(item => { const date = parseDate(item.due); return Number.isFinite(date) && date < now && !["تم صرفها", "ملغاة", "مرفوضة", "غير مرفوعة"].includes(item.status); }).map(item => ({ id: 1000000 + item.id, title: `مطالبة متأخرة ${item.ref}`, message: `${item.client} · متبقٍ ${formatSAR(Math.max(0, item.amount - item.paid))}`, severity: "حرج", target: "finance" as ModuleKey })),
    ...claims.filter(item => { const date = parseDate(item.followUpAt); return Number.isFinite(date) && date < now && !["تم صرفها", "ملغاة", "مرفوضة"].includes(item.status); }).map(item => ({ id: 1500000 + item.id, title: `متابعة مطلوبة للمطالبة ${item.ref}`, message: `${item.client} · موعد المتابعة ${item.followUpAt}`, severity: "تنبيه", target: "finance" as ModuleKey })),
    ...payables.filter(item => item.overdue).map(item => ({ id: 1600000 + item.id, title: `فاتورة مورد متأخرة ${item.ref}`, message: `${item.supplier} · متبقٍ ${formatSAR(item.remaining)}`, severity: "حرج", target: "payables" as ModuleKey })),
    ...contracts.filter(item => { const date = parseDate(item.expiry); return item.status === "قائم" && Number.isFinite(date) && date >= now && date <= soon; }).map(item => ({ id: 2000000 + item.id, title: `عقد يقترب من الانتهاء ${item.ref}`, message: `${item.client} · ينتهي ${item.expiry}`, severity: "تنبيه", target: "finance" as ModuleKey })),
    ...documents.filter(item => { const date = parseDate(item.expiry); return Number.isFinite(date) && date <= soon; }).map(item => ({ id: 3000000 + item.id, title: `مستند يحتاج مراجعة: ${item.name}`, message: `${item.entity} · ${item.expiry}`, severity: "تنبيه", target: "documents" as ModuleKey })),
    ...maintenance.filter(item => item.status === "متوقف" || (item.status !== "مكتمل" && Number.isFinite(parseDate(item.expectedReturn)) && parseDate(item.expectedReturn) < now) || (item.status !== "مكتمل" && item.createdAt && now - new Date(item.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000)).map(item => ({ id: 4000000 + item.id, title: `مركبة متوقفة: ${item.vehicle}`, message: `${item.reason || item.type} · ${item.status}`, severity: "حرج", target: "maintenance" as ModuleKey })),
  ];
  const manualAlerts = notifications.filter(item => !item.readAt).map(item => ({ ...item, target: targetByEntity[String(item.entityType || "")] || "dashboard" as ModuleKey }));
  const visibleAlerts = [...automaticAlerts, ...manualAlerts].slice(0, 5);
  const maintenanceRows = maintenance.filter(item => item.status !== "مكتمل").slice(0, 3);
  return <>
    <PageHeader eyebrow="نظرة عامة / لوحة التحكم" title={`صباح الخير، ${userName || "بك"}`} description="إليك نظرة سريعة على أداء أسطولك اليوم." action="إضافة مركبة" onAction={() => onNavigate("vehicles")} />
    <div className="metrics-grid"><MetricCard title="إجمالي المركبات" value={totalVehicles.toLocaleString("en-US")} helper="كامل الأسطول المسجل" icon={CarFront} tone="teal" /><MetricCard title="تعمل / مؤجرة" value={workingVehicles.toLocaleString("en-US")} helper={`معدل تشغيل ${operationRate}٪ من الأسطول`} icon={Activity} tone="blue" /><MetricCard title="جاهزة للتشغيل" value={readyVehicles.toLocaleString("en-US")} helper="حالتها متاحة" icon={CheckCircle2} tone="violet" /><MetricCard title="في الصيانة" value={maintenanceVehicles.toLocaleString("en-US")} helper="طلبات الصيانة المفتوحة" icon={Wrench} tone="orange" /><MetricCard title="متوقفة" value={stoppedVehicles.toLocaleString("en-US")} helper="مركبات تتطلب إجراءً" icon={AlertCircle} tone="orange" /><MetricCard title="قيد التجهيز" value={setupVehicles.toLocaleString("en-US")} helper="لم تدخل الخدمة بعد" icon={Gauge} tone="blue" /></div><div className="quick-metrics"><div><span>المستحق لنا</span><strong className="green-text">{formatSAR(receivable)}</strong></div><div><span>المستحق علينا</span><strong className="red-text">{formatSAR(payable)}</strong></div><div><span>المشاريع النشطة</span><strong>{projects.filter(project => project.status === "نشط").length.toLocaleString("en-US")}</strong></div><div><span>العقود القائمة</span><strong>{contracts.filter(contract => contract.status === "قائم").length.toLocaleString("en-US")}</strong></div></div>
    <div className="dashboard-grid"><section className="surface chart-card"><div className="section-head"><div><h2>نشاط الصيانة</h2><span>توزيع طلبات الصيانة الحالية حسب الحالة</span></div><button className="select-like">آخر ١٠ أشهر <ChevronDown size={14} /></button></div><Chart maintenance={maintenance} /></section><section className="surface alert-card"><div className="section-head"><div><h2>تحتاج إلى انتباه</h2><span>تنبيهات تتطلب إجراءً منك</span></div><button className="icon-btn"><MoreHorizontal size={18} /></button></div><div className="alerts-list">{visibleAlerts.length ? visibleAlerts.map(item => <div className="alert-row" key={item.id} role="button" tabIndex={0} onClick={() => onNavigate(item.target)}><span className={`alert-icon ${item.severity === "حرج" ? "red" : item.severity === "تنبيه" ? "amber" : "blue"}`}><Bell size={16} /></span><div><strong>{item.title}</strong><small>{item.message}</small></div><ChevronLeft size={15} /></div>) : <div className="empty-state"><strong>لا توجد تنبيهات جديدة</strong><span>ستظهر هنا التنبيهات التشغيلية المهمة.</span></div>}</div><button className="text-link" onClick={() => onNavigate(visibleAlerts[0]?.target || "dashboard")}>عرض التنبيهات <ChevronLeft size={14} /></button></section></div>
    <div className="dashboard-grid lower"><section className="surface mini-table"><div className="section-head"><div><h2>المركبات تحتاج صيانة</h2><span>مراجعة الحالة التشغيلية للمركبات</span></div><button className="text-link" onClick={() => onNavigate("maintenance")}>عرض الكل <ChevronLeft size={14} /></button></div><div className="compact-list">{maintenanceRows.length ? maintenanceRows.map(item => <div className="compact-row" key={item.id}><div className="vehicle-avatar"><CarFront size={16} /></div><div className="compact-main"><strong>{item.vehicle}</strong><small>{item.type}</small></div><Badge>{item.status}</Badge><span className="compact-date">{item.due}</span></div>) : <div className="empty-state"><strong>لا توجد مركبات تحت الصيانة</strong><span>حالة الأسطول التشغيلية مستقرة.</span></div>}</div></section><section className="surface mini-table"><div className="section-head"><div><h2>مهام اليوم</h2><span>{tasks.filter(task => task.status !== "ملغاة").length} مهام مفتوحة</span></div><button className="btn outline" onClick={onTaskCreate}><Plus size={15} />إضافة مهمة</button></div><div className="tasks">{tasks.filter(task => task.status !== "ملغاة").length ? tasks.filter(task => task.status !== "ملغاة").slice(0, 5).map(task => <label className={`task ${task.status === "مكتملة" ? "done" : ""}`} key={task.id}><input type="checkbox" checked={task.status === "مكتملة"} onChange={() => onTaskToggle(task)} /><span>{task.title}</span><small>{task.dueAt}</small></label>) : <div className="empty-state"><strong>لا توجد مهام محفوظة</strong><span>أضف مهام التشغيل اليومية من زر إضافة مهمة.</span></div>}</div></section></div>
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
  const blankExpense = () => ({ category: "أخرى", amount: "", spentAt: new Date().toISOString().slice(0, 10), description: "", vendor: "", notes: "", receiptName: "", receiptUrl: "" });
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
    if (file.size > 700000) { toast.error("الحد الأقصى للمرفق 700 كيلوبايت"); return; }
    const reader = new FileReader(); reader.onload = () => updateExpenseField("receiptUrl", String(reader.result || "")); reader.readAsDataURL(file);
    updateExpenseField("receiptName", file.name);
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
    <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>السجل التشغيلي</h3><span>الصيانة والمستندات المسجلة لهذا الباص</span></div></div>{canAccess("maintenance") && <div className="compact-list">{linkedMaintenance.length ? linkedMaintenance.map(item => <div className="compact-row" key={item.id}><span className="vehicle-avatar"><Wrench size={16} /></span><div className="compact-main"><strong>{item.type} · {item.start}</strong><small>{item.reason || "بدون سبب مدخل"} · {item.workDone || "لم يسجل العمل المنجز"}{item.parts ? ` · قطع: ${item.parts}` : ""}</small></div><Badge>{item.status}</Badge><strong>{formatCurrencyText(item.cost || "0 SAR")}</strong>{item.receiptName && <button className="btn outline" onClick={() => openLedgerAttachment("maintenance", item.id, String(item.receiptName || "فاتورة صيانة"))}>الفاتورة</button>}</div>) : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد أوامر صيانة مرتبطة.</div>}</div>}{canAccess("documents") && <div className="compact-list" style={{ marginTop: ".6rem" }}>{linkedDocuments.length ? linkedDocuments.map(item => <div className="compact-row" key={`doc-${item.id}`}><div className="compact-main"><strong>{item.name}</strong><small>{item.type} · انتهاء {item.expiry}</small></div><Badge>{item.status}</Badge><DocumentFileActions file={item} /></div>) : <div className="empty-state" style={{ padding: "1rem" }}>لا توجد مستندات مرتبطة.</div>}</div>}</section>
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
        {expenseOpen && <form className="surface" style={{ padding: "1rem", margin: "1rem 0" }} onSubmit={saveExpense}><div className="section-head"><h3>{editingId ? "تعديل عملية صرف" : "إضافة عملية صرف"}</h3><button type="button" className="btn ghost" onClick={() => { setExpenseOpen(false); setEditingId(null); }}>إلغاء</button></div><div className="form-grid"><label className="field"><span>بند الصرف</span><select value={expense.category} onChange={e => updateExpenseField("category", e.target.value)}>{["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"].map(item => <option key={item}>{item}</option>)}</select></label><label className="field"><span>المبلغ (SAR)</span><input type="number" min="1" step="1" required value={expense.amount} onChange={e => updateExpenseField("amount", e.target.value)} /></label><label className="field"><span>تاريخ الصرف</span><input type="date" required value={expense.spentAt} onChange={e => updateExpenseField("spentAt", e.target.value)} /></label><label className="field"><span>المورد / الورشة</span><input value={expense.vendor} onChange={e => updateExpenseField("vendor", e.target.value)} /></label><label className="field"><span>السبب / البيان</span><input required value={expense.description} onChange={e => updateExpenseField("description", e.target.value)} maxLength={300} /></label><label className="field"><span>ملاحظات</span><input value={expense.notes} onChange={e => updateExpenseField("notes", e.target.value)} /></label><label className="field"><span>الفاتورة أو صورة المستند (حد 700 ك.ب)</span><input type="file" accept="image/*,.pdf" onChange={e => readReceipt(e.target.files?.[0])} />{expense.receiptName && <small>{expense.receiptName}</small>}</label></div><div className="detail-footer"><button className="btn primary" disabled={expenseCreate.isPending || expenseUpdate.isPending}>حفظ المصروف</button></div></form>}
        {revenueOpen && <form className="surface" style={{ padding: "1rem", margin: "1rem 0" }} onSubmit={saveRevenue}><div className="section-head"><div><h3>تخصيص إيراد محصل للباص</h3><span>لا يُحسب إيراد العقد كاملًا؛ اختر دفعة مستلمة ووزّع مبلغها، ولن يسمح النظام بتجاوز قيمتها أو تخصيصها لعقد لا يرتبط بالباص.</span></div><button type="button" className="btn ghost" onClick={() => setRevenueOpen(false)}>إلغاء</button></div><div className="form-grid"><label className="field"><span>الدفعة المستلمة</span><select required value={revenue.paymentId} onChange={e => { const item = data.allocatablePayments.find((payment: any) => String(payment.id) === e.target.value); setRevenue(current => ({ ...current, paymentId: e.target.value, amount: item ? String(item.remaining) : current.amount })); }}><option value="">اختر دفعة مرتبطة بعقد هذا الباص</option>{data.allocatablePayments.map((payment: any) => <option key={payment.id} value={payment.id}>{payment.paidAt} · {payment.contractRef} · {payment.client} · متبقٍ للتوزيع {formatSAR(payment.remaining)}</option>)}</select></label><label className="field"><span>المبلغ المخصص (SAR)</span><input type="number" min="1" step="1" required value={revenue.amount} onChange={e => setRevenue(current => ({ ...current, amount: e.target.value }))} /></label><label className="field"><span>إيصال/مستند اختياري (حد 700 ك.ب)</span><input type="file" accept="image/*,.pdf" onChange={e => { const file=e.target.files?.[0]; if(!file)return; if(file.size>700000){toast.error("الحد الأقصى للمرفق 700 كيلوبايت");return;} const reader=new FileReader(); reader.onload=()=>setRevenue(current=>({...current,receiptName:file.name,receiptUrl:String(reader.result||"")})); reader.readAsDataURL(file); }} />{revenue.receiptName && <small>{revenue.receiptName}</small>}</label><label className="field"><span>ملاحظات</span><input value={revenue.notes} onChange={e => setRevenue(current => ({ ...current, notes: e.target.value }))} /></label></div>{!data.allocatablePayments.length && <div className="empty-state" style={{ padding: "1rem" }}>لا توجد دفعات غير موزعة مرتبطة بعقد هذا الباص.</div>}<div className="detail-footer"><button className="btn primary" disabled={!data.allocatablePayments.length || revenueCreate.isPending}>حفظ تخصيص الإيراد</button></div></form>}
      </section>
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>الإيرادات المحصلة المخصصة لهذا الباص</h3><span>سجل زمني لمبالغ من دفعات مالية موثقة؛ لا يعرض قيمة العقود كإيراد محصل.</span></div></div>{data.revenues.length ? <div className="table-scroll"><table><thead><tr><th>تاريخ التحصيل</th><th>العقد / العميل</th><th>مرجع الدفعة</th><th>المبلغ المخصص</th><th>أُدخل بواسطة</th><th>الإيصال</th><th>إجراء</th></tr></thead><tbody>{data.revenues.map((item: any) => <tr key={item.id}><td>{item.paidAt}</td><td>{item.contractRef}<small>{item.client}</small></td><td>{item.reference}</td><td><strong>{formatSAR(item.amount)}</strong></td><td>{item.createdByName}</td><td>{item.hasReceipt ? <button className="btn outline" onClick={() => openLedgerAttachment("revenue", item.id, item.receiptName || "إيصال")}>فتح المرفق</button> : "—"}</td><td>{item.autoLinked ? <small className="field-note">مرتبط تلقائيًا بالعقد</small> : <button className="row-menu-btn danger" title="إلغاء التخصيص" onClick={() => toast("إلغاء تخصيص هذا الجزء من الدفعة؟ سيصبح متاحًا لإعادة التوزيع.", { action: { label: "تأكيد", onClick: () => revenueArchive.mutate({ id: item.id }, { onSuccess: () => { utils.vehicles.financeProfile.invalidate({ vehicleId: vehicle.id }); utils.vehicles.list.invalidate(); toast.success("تم إلغاء تخصيص الإيراد"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })}><Archive size={15} /></button>}</td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ padding: "1.5rem" }}>لا توجد إيرادات مخصصة بعد. الإيراد لا يظهر هنا حتى يسجل كدفعة ويخصص لهذا الباص.</div>}</section>
      <p className="field-note">صافي النقد المعروض = الإيراد المحصل المخصص − قيمة الشراء − مصروفات التشغيل المسجلة. لا يمثل ربحًا محاسبيًا بعد الإهلاك أو التمويل أو الضرائب، وقد يختلف عن الربح المستحق إذا لم تُسجل الإيرادات أو المصروفات.</p>
    </>}
    <div className="detail-footer"><button className="btn primary" onClick={onClose}>إغلاق الملف</button></div>
  </Modal>;
}

function VehiclesPage({ vehicles, setVehicles, onOpenForm, onAction, canAccess }: { vehicles: Vehicle[]; setVehicles: (v: Vehicle[]) => void; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void; canAccess: (key: ModuleKey) => boolean }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = vehicles.filter(v => (!search || Object.values(v).join(" ").includes(search)) && (tab === "الكل" || (tab === "متاح" && v.status === "متاحة") || (tab === "في الصيانة" && v.status === "في الصيانة") || (tab === "مؤجر / مشغول" && ["مؤجرة", "مشغولة"].includes(v.status)) || (tab === "قيد التجهيز" && v.status === "قيد التجهيز") || (tab === "متوقفة" && v.status === "متوقفة")));
  const topSpender = [...vehicles].sort((a, b) => Number(b.expenseTotal || 0) - Number(a.expenseTotal || 0))[0];
  return <><PageHeader eyebrow="التشغيل / إدارة الأسطول" title="المركبات" description="افتح قائمة الإجراءات ثم «عرض التفاصيل» لملف الباص المالي والتشغيلي." action="إضافة مركبة" onAction={() => onOpenForm()} /><div className="quick-metrics"><div><span>كل المركبات</span><strong>{vehicles.length.toLocaleString("en-US")}</strong></div><div><span>متاحة</span><strong className="green-text">{vehicles.filter(v => v.status === "متاحة").length.toLocaleString("en-US")}</strong></div><div><span>في الصيانة</span><strong className="red-text">{vehicles.filter(v => v.status === "في الصيانة").length.toLocaleString("en-US")}</strong></div><div><span>مؤجرة / مشغولة</span><strong className="blue-text">{vehicles.filter(v => ["مؤجرة", "مشغولة"].includes(v.status)).length.toLocaleString("en-US")}</strong></div>{canAccess("finance") && <><div><span>مصروفات التشغيل للأسطول</span><strong>{formatSAR(vehicles.reduce((total, vehicle) => total + Number(vehicle.expenseTotal || 0), 0))}</strong></div><div><span>الأعلى مصروفًا</span><strong>{topSpender ? `${topSpender.plate} · ${formatSAR(Number(topSpender.expenseTotal || 0))}` : "—"}</strong></div></>}</div><TableShell columns={["رقم اللوحة", "المركبة", "السنة", "المسافة", "السائق", "الموظف المسؤول", "الحالة", "العميل", ...(canAccess("finance") ? ["مصروف التشغيل", "إيراد محصل"] : [])]} onExport={() => exportCsv(filtered, ["plate", "brand", "model", "year", "mileage", "driver", "employee", "status", "client", ...(canAccess("finance") ? ["purchasePrice", "expenseTotal", "revenueTotal", "netOperatingReturn"] : [])], "vehicles")} search={search} setSearch={setSearch} tabs={["الكل", "متاح", "في الصيانة", "مؤجر / مشغول", "قيد التجهيز", "متوقفة"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة مركبة" onAdd={() => onOpenForm()}>{filtered.map(v => <tr key={v.id}><td><strong className="table-primary">{v.plate}</strong><small>{v.brand}</small></td><td>{v.model}<small>{v.color}</small></td><td>{v.year}</td><td>{v.mileage}</td><td>{v.driver}</td><td>{v.employee || "—"}</td><td><Badge>{v.status}</Badge></td><td>{v.client}<small>{v.contract}</small></td>{canAccess("finance") && <><td>{formatSAR(Number(v.expenseTotal || 0))}</td><td>{formatSAR(Number(v.revenueTotal || 0))}</td></>}<td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === v.id ? null : v.id)}><MoreHorizontal size={18} /></button>{menu === v.id && <ContextMenu row={v} module="vehicles" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, v); }} />}</td></tr>)}</TableShell></>;
}

function MaintenancePage({ maintenance, onOpenForm, onAction }: { maintenance: Maintenance[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = maintenance.filter(m => (!search || Object.values(m).join(" ").includes(search)) && (tab === "الكل" || (tab === "مكتمل" && m.status === "مكتمل") || (tab === "جاري العمل" && m.status !== "مكتمل")));
  return <><PageHeader eyebrow="التشغيل / الورش" title="الصيانة" description="تابع طلبات الصيانة والتكاليف والمواعيد النهائية لكل مركبة." action="طلب صيانة جديد" onAction={() => onOpenForm()} /><div className="stats-banner"><div><Wrench size={17} /><span>طلبات مفتوحة</span><strong>{maintenance.filter(m => m.status !== "مكتمل").length.toLocaleString("en-US")}</strong></div><div><Clock3 size={17} /><span>متأخرة</span><strong className="red-text">{maintenance.filter(m => m.due.includes("متأخر") || m.status === "متوقف").length.toLocaleString("en-US")}</strong></div><div><CircleDollarSign size={17} /><span>إجمالي التكلفة</span><strong>{maintenance.reduce((sum, m) => sum + (Number(String(m.cost).replace(/[^0-9]/g, "")) || 0), 0).toLocaleString("en-US")} SAR</strong></div><div><CalendarDays size={17} /><span>إجمالي الطلبات</span><strong>{maintenance.length.toLocaleString("en-US")}</strong></div></div><TableShell columns={["الطلب", "المركبة", "نوع الصيانة", "سبب العطل", "المسؤول", "تاريخ البدء", "العودة المتوقعة", "الحالة", "التكلفة"]} onExport={() => exportCsv(filtered, ["ref", "vehicle", "type", "reason", "manager", "start", "due", "expectedReturn", "status", "cost", "parts", "workDone"], "maintenance")} search={search} setSearch={setSearch} tabs={["الكل", "مكتمل", "جاري العمل"]} activeTab={tab} setActiveTab={setTab} addLabel="طلب صيانة جديد" onAdd={() => onOpenForm()}>{filtered.map(m => <tr key={m.id}><td><strong className="table-primary">{m.ref}</strong><small>منذ {m.start}</small></td><td>{m.vehicle}</td><td>{m.type}</td><td>{m.reason || "—"}</td><td>{m.manager}</td><td>{m.start}</td><td>{m.expectedReturn || m.due}</td><td><Badge>{m.status}</Badge></td><td>{formatCurrencyText(m.cost)}</td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === m.id ? null : m.id)}><MoreHorizontal size={18} /></button>{menu === m.id && <ContextMenu row={m} module="maintenance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, m); }} />}</td></tr>)}</TableShell></>;
}

function DriverVehiclesModal({ driver, vehicles, documents, canViewDocuments, onClose }: { driver: Driver; vehicles: Vehicle[]; documents: Document[]; canViewDocuments: boolean; onClose: () => void }) {
  const documentsQuery = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canViewDocuments });
  const linkedVehicles = vehicles.filter(vehicle => vehicle.driverId === driver.id || vehicle.driver === driver.name || (driver.vehicle !== "—" && vehicle.plate === driver.vehicle));
  const linkedDocuments = canViewDocuments ? ((documentsQuery.data as Document[] | undefined) ?? documents).filter(doc => isLinkedDocument(doc, "سائق", driver.id)) : [];
  return <Modal title={`ملف السائق · ${driver.name}`} onClose={onClose} wide><div className="driver-summary"><span className="avatar">{driver.name.slice(0, 1)}</span><div><strong>{driver.name}</strong><span>{driver.phone} · {driver.license}</span><Badge>{driver.status}</Badge></div></div><div className="linked-vehicles-head"><div><h3>المركبات المرتبطة</h3><span>{linkedVehicles.length ? `لديه ${linkedVehicles.length} مركبة مرتبطة حاليًا` : "لا توجد مركبات مرتبطة بهذا السائق"}</span></div><CarFront size={20} /></div>{linkedVehicles.length ? <div className="linked-vehicles-list">{linkedVehicles.map(vehicle => <div className="linked-vehicle" key={vehicle.id}><span className="vehicle-avatar"><CarFront size={17} /></span><div><strong>{vehicle.plate}</strong><span>{vehicle.brand} · {vehicle.model}</span></div><div className="linked-vehicle-meta"><Badge>{vehicle.status}</Badge><small>{vehicle.client !== "—" ? vehicle.client : "بدون عميل"}</small><small>{vehicle.contract !== "—" ? vehicle.contract : "بدون عقد"}</small></div></div>)}</div> : <div className="empty-state"><CarFront size={24} /><strong>لا توجد مركبة مرتبطة</strong><span>يمكن إسناد مركبة من قائمة إجراءات السائق.</span></div>}<section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>المستندات المرتبطة</h3><span>{linkedDocuments.length} مستند</span></div></div>{linkedDocuments.length ? <div className="compact-list">{linkedDocuments.map(doc => <div className="compact-row" key={doc.id}><div className="compact-main"><strong>{doc.name}</strong><small>{doc.type} · ينتهي {doc.expiry}</small></div><Badge>{doc.status}</Badge><DocumentFileActions file={doc} /></div>)}</div> : <div className="empty-state" style={{ padding: "1.5rem" }}>لا توجد مستندات مرتبطة بهذا السائق.</div>}</section><div className="detail-footer"><button className="btn primary" onClick={onClose}>إغلاق</button></div></Modal>;
}

function DocumentsPage({ documents, onAction, onOpenForm }: { documents: Document[]; onAction: (action: string, row: Row) => void; onOpenForm: (row?: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = documents.filter(d => (!search || Object.values(d).join(" ").includes(search)) && (tab === "الكل" || (tab === "متأخر" && d.status === "متأخر") || (tab === "قريبًا" && d.status === "قريبًا") || (tab === "مركبة" && d.entityType === "مركبة") || (tab === "سائق" && d.entityType === "سائق") || (tab === "موظف" && d.entityType === "موظف") || (tab === "مشروع" && d.entityType === "مشروع") || (tab === "عميل" && d.entityType === "عميل") || (tab === "عقد" && d.entityType === "عقد") || (tab === "مطالبة" && d.entityType === "مطالبة") || (tab === "صيانة" && d.entityType === "صيانة")));
  return <><PageHeader eyebrow="التشغيل / الامتثال" title="المستندات" description="كل مستندات المركبات والسائقين والعملاء في مكان واحد، مع تنبيهات التجديد." action="رفع مستند" onAction={() => onOpenForm()} />{documents.filter(d => d.status === "قريبًا" || d.status === "متأخر" || d.status === "منتهي").length > 0 && <div className="document-alert"><div className="alert-icon amber"><Bell size={17} /></div><div><strong>لديك {documents.filter(d => d.status === "قريبًا" || d.status === "متأخر" || d.status === "منتهي").length.toLocaleString("en-US")} مستندات تحتاج إلى مراجعة</strong><span>راجع المستندات القريبة من الانتهاء لتفادي توقف العمليات.</span></div><button className="btn outline" onClick={() => setTab("قريبًا")}>مراجعة الآن</button></div>}<TableShell columns={["المستند", "الكيان المرتبط", "النوع", "تاريخ الانتهاء", "الحالة"]} onExport={() => exportCsv(filtered, ["name", "entity", "type", "expiry", "status"], "documents")} search={search} setSearch={setSearch} tabs={["الكل", "قريبًا", "متأخر", "مركبة", "سائق", "موظف", "مشروع", "عميل", "عقد", "مطالبة", "صيانة"]} activeTab={tab} setActiveTab={setTab} addLabel="رفع مستند" onAdd={() => onOpenForm()}>{filtered.map(d => <tr key={d.id}><td><div className="doc-cell"><span className="file-icon"><FileText size={17} /></span><div><strong>{d.name}</strong><small>{d.owner}</small></div></div></td><td>{d.entity}</td><td>{d.type}</td><td>{d.expiry}</td><td><Badge>{d.status}</Badge></td><td className="actions-cell"><DocumentFileActions file={d} /><button className="row-menu-btn" onClick={() => setMenu(menu === d.id ? null : d.id)}><MoreHorizontal size={18} /></button>{menu === d.id && <ContextMenu row={d} module="documents" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, d); }} />}</td></tr>)}</TableShell></>;
}

function DriversPage({ drivers, onOpenForm, onAction, onView }: { drivers: Driver[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void; onView: (driver: Driver) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = drivers.filter(d => (!search || Object.values(d).join(" ").includes(search)) && (tab === "الكل" || d.status === tab));
  return <><PageHeader eyebrow="التشغيل / الفريق" title="السائقون" description="إدارة ملفات السائقين، الرخص، التوزيع والحالة التشغيلية." action="إضافة سائق" onAction={() => onOpenForm()} /><div className="quick-metrics"><div><span>إجمالي السائقين</span><strong>{drivers.length.toLocaleString("en-US")}</strong></div><div><span>متاحون</span><strong className="green-text">{drivers.filter(d => d.status === "متاح").length.toLocaleString("en-US")}</strong></div><div><span>في مهمة</span><strong className="blue-text">{drivers.filter(d => d.status === "مشغول").length.toLocaleString("en-US")}</strong></div><div><span>رخص تحتاج تجديد</span><strong className="amber-text">{drivers.filter(d => d.renewal && d.renewal !== "—").length.toLocaleString("en-US")}</strong></div></div><TableShell columns={["السائق", "الهاتف", "الهوية", "الرخصة", "المركبة الحالية", "الحالة", "التجديد"]} onExport={() => exportCsv(filtered, ["name", "phone", "idNo", "license", "vehicle", "status", "renewal"], "drivers")} search={search} setSearch={setSearch} tabs={["الكل", "متاح", "مشغول"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة سائق" onAdd={() => onOpenForm()}>{filtered.map(d => <tr key={d.id}><td><button className="driver-name-button" onClick={() => onView(d)}><span className="avatar">{d.name.slice(0, 1)}</span><span><strong>{d.name}</strong><small>اضغط لعرض المركبات</small></span></button></td><td>{d.phone}</td><td>{d.idNo}</td><td>{d.license}</td><td>{d.vehicle}</td><td><Badge>{d.status}</Badge></td><td>{d.renewal}</td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === d.id ? null : d.id)}><MoreHorizontal size={18} /></button>{menu === d.id && <ContextMenu row={d} module="drivers" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, d); }} />}</td></tr>)}</TableShell></>;
}

function ClientsPage({ clients, onOpenForm, onAction }: { clients: Client[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = clients.filter(c => (!search || Object.values(c).join(" ").includes(search)) && (tab === "الكل" || (tab === "نشط" && c.contracts > 0) || (tab === "غير نشط" && c.contracts === 0)));
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
  const blank = (): Row => ({ id: Date.now(), ref: `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, name: "", client: "", clientId: null, contract: "—", contractId: null, managerEmployeeId: null, manager: "", startDate: "", endDate: "", requiredVehicles: 0, actualVehicles: 0, status: "مخطط", notes: "" });
  const change = (key: string) => (value: string) => setForm(prev => prev ? ({ ...prev, [key]: value }) : prev);
  const rows = (projects as ProjectRow[]).filter(project => (!search || Object.values(project).join(" ").includes(search)) && (tab === "الكل" || project.status === tab));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name || !form.client) { toast.error("أدخل اسم المشروع والعميل"); return; }
    const { id, actualVehicles: _actual, createdAt: _created, updatedAt: _updated, archivedAt: _archived, ...raw } = form;
    const payload = { ...raw, requiredVehicles: Math.max(0, Number(raw.requiredVehicles || 0)), clientId: raw.clientId ? Number(raw.clientId) : null, contractId: raw.contractId ? Number(raw.contractId) : null } as any;
    const onSuccess = () => { utils.projects.list.invalidate(); setForm(null); toast.success("تم حفظ المشروع"); };
    const onError = (error: { message: string }) => toast.error(`تعذر حفظ المشروع: ${error.message}`);
    if (projects.some(project => project.id === id)) updateProject.mutate({ id, data: payload }, { onSuccess, onError });
    else createProject.mutate(payload, { onSuccess, onError });
  };
  return <>
    <PageHeader eyebrow="التشغيل / إدارة المشاريع" title="المشاريع والجهات" description="ملف موحد لكل مشروع يربط العميل والعقد والمدة والاحتياج الفعلي من المركبات." action="إضافة مشروع" onAction={() => setForm(blank())} />
    <div className="quick-metrics"><div><span>المشاريع النشطة</span><strong className="green-text">{projects.filter(project => project.status === "نشط").length.toLocaleString("en-US")}</strong></div><div><span>المركبات المطلوبة</span><strong>{projects.reduce((sum, project) => sum + Number(project.requiredVehicles || 0), 0).toLocaleString("en-US")}</strong></div><div><span>المركبات المسندة فعليًا</span><strong className="blue-text">{projects.reduce((sum, project) => sum + Number(project.actualVehicles || 0), 0).toLocaleString("en-US")}</strong></div><div><span>المشاريع المتوقفة</span><strong className="red-text">{projects.filter(project => project.status === "موقوف").length.toLocaleString("en-US")}</strong></div></div>
    <TableShell columns={["المشروع", "العميل", "العقد", "بداية / نهاية", "المركبات المطلوبة / المسندة", "المسؤول", "الحالة"]} onExport={() => exportCsv(rows, ["ref", "name", "client", "contract", "startDate", "endDate", "requiredVehicles", "actualVehicles", "manager", "status"], "projects")} search={search} setSearch={setSearch} tabs={["الكل", "نشط", "مخطط", "موقوف", "مكتمل", "ملغي"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة مشروع" onAdd={() => setForm(blank())}>
      {rows.map(project => <tr key={project.id}><td><button className="driver-name-button" onClick={() => setProfile(project)}><strong className="table-primary">{project.name}</strong><small>{project.ref} · عرض التفاصيل والمستندات</small></button></td><td>{project.client}</td><td>{project.contract}</td><td>{project.startDate} / {project.endDate}</td><td>{project.requiredVehicles} / {project.actualVehicles}</td><td>{project.manager}</td><td><Badge>{project.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" title="تعديل المشروع" onClick={() => setForm({ ...project })}><Pencil size={16} /></button><button className="row-menu-btn danger" title="أرشفة المشروع" onClick={() => toast("تأكيد أرشفة المشروع؟ لا يمكن أرشفة مشروع مرتبط بمركبات.", { action: { label: "تأكيد", onClick: () => archiveProject.mutate({ id: project.id }, { onSuccess: result => { if (result.success) { utils.projects.list.invalidate(); toast.success("تمت أرشفة المشروع"); } else toast.error("أزل إسناد المركبات النشطة إلى المشروع قبل أرشفته"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })}><Archive size={16} /></button></td></tr>)}
    </TableShell>
    {profile && <Modal title={`ملف المشروع · ${profile.name}`} onClose={() => setProfile(null)} wide><div className="detail-grid">{[["المرجع", profile.ref], ["العميل", profile.client], ["العقد", profile.contract], ["مدير المشروع", profile.manager], ["الحالة", profile.status], ["بداية المشروع", profile.startDate], ["نهاية المشروع", profile.endDate], ["المركبات المطلوبة", profile.requiredVehicles], ["المركبات المسندة", profile.actualVehicles]].map(([label, value]) => <div className="detail-cell" key={String(label)}><span>{label}</span><strong>{String(value ?? "—")}</strong></div>)}</div><LinkedDocumentsSection entityType="مشروع" entityId={profile.id} canViewDocuments={canAccess("documents")} /><div className="detail-footer"><button className="btn outline" onClick={() => { setForm({ ...profile }); setProfile(null); }}>تعديل المشروع</button><button className="btn primary" onClick={() => setProfile(null)}>إغلاق</button></div></Modal>}
    {form && <Modal title={projects.some(project => project.id === form.id) ? "تعديل المشروع" : "إضافة مشروع"} onClose={() => setForm(null)} wide><form onSubmit={save}><div className="form-grid">
      <Field label="اسم المشروع *" value={form.name} onChange={change("name")} />
      <Field label="الرقم المرجعي" value={form.ref} onChange={change("ref")} />
      {canAccess("clients") ? <label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={event => { const client = clients.find(item => String(item.id) === event.target.value); setForm(prev => prev ? ({ ...prev, clientId: client?.id ?? null, client: client?.name ?? "" }) : prev); }}><option value="">اختر العميل</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label> : <Field label="العميل *" value={form.client} onChange={change("client")} />}
      {canAccess("finance") ? <label className="field"><span>العقد</span><select value={form.contractId || ""} onChange={event => { const contract = contracts.find(item => String(item.id) === event.target.value); setForm(prev => prev ? ({ ...prev, contractId: contract?.id ?? null, contract: contract?.ref ?? "—" }) : prev); }}><option value="">بدون عقد</option>{contracts.map(contract => <option key={contract.id} value={contract.id}>{contract.ref} · {contract.client}</option>)}</select></label> : <Field label="مرجع العقد" value={form.contract} onChange={change("contract")} />}
      <Field label="تاريخ البداية" value={form.startDate} onChange={change("startDate")} type="date" />
      <Field label="تاريخ النهاية" value={form.endDate} onChange={change("endDate")} type="date" />
      <Field label="عدد المركبات المطلوبة" value={String(form.requiredVehicles ?? 0)} onChange={change("requiredVehicles")} type="number" />
      <label className="field"><span>مدير المشروع</span>{canAccess("employees") ? <select value={form.managerEmployeeId || ""} onChange={event => { const employee = employees.find(item => String(item.id) === event.target.value); setForm(prev => prev ? ({ ...prev, managerEmployeeId: employee?.id ?? null, manager: employee?.name ?? "—" }) : prev); }}><option value="">بدون مدير موظف</option>{employees.filter(employee => employee.status === "نشط").map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select> : <input value={form.manager} onChange={event => change("manager")(event.target.value)} />}</label>
      <label className="field"><span>حالة المشروع</span><select value={form.status} onChange={event => change("status")(event.target.value)}><option>مخطط</option><option>نشط</option><option>موقوف</option><option>مكتمل</option><option>ملغي</option></select></label>
      <Field label="ملاحظات" value={form.notes} onChange={change("notes")} />
    </div><FormActions onCancel={() => setForm(null)} label="حفظ المشروع" /></form></Modal>}
  </>;
}


type EmployeeRow = Row & { employeeNo: string; name: string; nationalId: string; phone: string; email: string; department: string; jobTitle: string; hireDate: string; status: string; notes?: string };
function EmployeesPage({ canAccess }: { canAccess: (key: ModuleKey) => boolean }) {
  const utils = trpc.useUtils();
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, { staleTime: 20000 });
  const { data: employeeDocuments = [] } = trpc.documents.list.useQuery(undefined, { enabled: canAccess("documents") });
  const { data: employeeVehicles = [] } = trpc.vehicles.list.useQuery(undefined, { enabled: canAccess("vehicles") });
  const { data: employeeProjects = [] } = trpc.projects.list.useQuery(undefined, { enabled: canAccess("projects") });
  const createEmployee = trpc.employees.create.useMutation();
  const updateEmployee = trpc.employees.update.useMutation();
  const archiveEmployee = trpc.employees.archive.useMutation();
  const [form, setForm] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [profile, setProfile] = useState<EmployeeRow | null>(null);
  const list = employees as EmployeeRow[];
  const blank = (): Row => ({ id: Date.now(), employeeNo: `EMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, name: "", nationalId: "—", phone: "—", email: "—", department: "الإدارة", jobTitle: "موظف", hireDate: new Date().toISOString().slice(0,10), status: "نشط", notes: "" });
  const filtered = list.filter(employee => (!search || Object.values(employee).join(" ").includes(search)) && (tab === "الكل" || employee.status === tab));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name || !form?.employeeNo || !form?.department || !form?.jobTitle) { toast.error("أكمل الاسم والرقم والقسم والمسمى الوظيفي"); return; }
    const { id, ...data } = form;
    const done = () => { setForm(null); utils.employees.list.invalidate(); toast.success("تم حفظ ملف الموظف"); };
    if (list.some(item => item.id === id)) updateEmployee.mutate({ id, data }, { onSuccess: done, onError: error => toast.error(error.message) });
    else createEmployee.mutate(data as any, { onSuccess: done, onError: error => toast.error(error.message) });
  };
  const archive = (employee: EmployeeRow) => toast(`أرشفة الموظف ${employee.name}؟ سيُزال إسناده النشط للمشاريع والمركبات مع إبقاء السجلات التاريخية.`, { action: { label: "تأكيد", onClick: () => archiveEmployee.mutate({ id: employee.id }, { onSuccess: () => { utils.employees.list.invalidate(); utils.vehicles.list.invalidate(); utils.projects.list.invalidate(); toast.success("تم إنهاء/أرشفة الملف وفك الإسناد النشط"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } });
  return <>
    <PageHeader eyebrow="الموارد البشرية / الملفات" title="الموظفون" description="ملفات العاملين غير السائقين، مع حالة العمل وبيانات الاتصال والإسناد التشغيلي." action="إضافة موظف" onAction={() => setForm(blank())} />
    <div className="quick-metrics"><div><span>إجمالي الملفات</span><strong>{list.length.toLocaleString("en-US")}</strong></div><div><span>على رأس العمل</span><strong className="green-text">{list.filter(item => item.status === "نشط").length.toLocaleString("en-US")}</strong></div><div><span>إجازة</span><strong className="amber-text">{list.filter(item => item.status === "إجازة").length.toLocaleString("en-US")}</strong></div><div><span>غير نشط / منتهي</span><strong className="red-text">{list.filter(item => ["موقوف", "منتهي الخدمة"].includes(item.status)).length.toLocaleString("en-US")}</strong></div></div>
    <TableShell columns={["رقم الموظف", "الموظف", "القسم", "المسمى الوظيفي", "الهاتف", "الهوية", "الحالة", "تاريخ المباشرة"]} onExport={() => exportCsv(filtered, ["employeeNo", "name", "department", "jobTitle", "phone", "nationalId", "email", "status", "hireDate"], "employees")} search={search} setSearch={setSearch} tabs={["الكل", "نشط", "إجازة", "موقوف", "منتهي الخدمة"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة موظف" onAdd={() => setForm(blank())}>
      {filtered.map(employee => <tr key={employee.id}><td><strong className="table-primary">{employee.employeeNo}</strong></td><td><button className="driver-name-button" onClick={() => setProfile(employee)}><span className="avatar">{employee.name.slice(0, 1)}</span><span><strong>{employee.name}</strong><small>{employee.email || "اضغط لعرض الملف والمستندات"}</small></span></button></td><td>{employee.department}</td><td>{employee.jobTitle}</td><td>{employee.phone}</td><td>{employee.nationalId}</td><td><Badge>{employee.status}</Badge></td><td>{employee.hireDate}</td><td className="actions-cell"><button className="row-menu-btn" title="تعديل" onClick={() => setForm({ ...employee })}><Pencil size={15} /></button><button className="row-menu-btn danger" title="إنهاء/أرشفة" onClick={() => archive(employee)}><Archive size={15} /></button></td></tr>)}
    </TableShell>
    {profile && <Modal title={`ملف الموظف · ${profile.name}`} onClose={() => setProfile(null)} wide><div className="driver-summary"><span className="avatar">{profile.name.slice(0,1)}</span><div><strong>{profile.name}</strong><span>{profile.employeeNo} · {profile.jobTitle} · {profile.department}</span><Badge>{profile.status}</Badge></div></div><div className="quick-metrics"><div><span>الهاتف</span><strong>{profile.phone}</strong></div><div><span>الهوية</span><strong>{profile.nationalId}</strong></div><div><span>البريد</span><strong>{profile.email}</strong></div><div><span>تاريخ المباشرة</span><strong>{profile.hireDate}</strong></div></div>{(canAccess("vehicles") || canAccess("projects")) && <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>الإسنادات التشغيلية</h3><span>المركبات والمشاريع المرتبطة حاليًا بهذا الموظف</span></div></div><div className="quick-metrics">{canAccess("vehicles") && <div><span>المركبات المسؤول عنها</span><strong>{(employeeVehicles as Vehicle[]).filter(vehicle => vehicle.employeeId === profile.id).length}</strong></div>}{canAccess("projects") && <div><span>المشاريع التي يديرها</span><strong>{(employeeProjects as ProjectRow[]).filter(project => project.managerEmployeeId === profile.id).length}</strong></div>}</div><div className="compact-list">{canAccess("vehicles") && (employeeVehicles as Vehicle[]).filter(vehicle => vehicle.employeeId === profile.id).map(vehicle => <div className="compact-row" key={`vehicle-${vehicle.id}`}><div className="compact-main"><strong>مركبة · {vehicle.plate}</strong><small>{vehicle.brand} {vehicle.model} · السائق {vehicle.driver}</small></div><Badge>{vehicle.status}</Badge></div>)}{canAccess("projects") && (employeeProjects as ProjectRow[]).filter(project => project.managerEmployeeId === profile.id).map(project => <div className="compact-row" key={`project-${project.id}`}><div className="compact-main"><strong>مشروع · {project.name}</strong><small>{project.ref} · العميل {project.client}</small></div><Badge>{project.status}</Badge></div>)}</div></section>}<section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h3>المستندات المرتبطة</h3><span>{canAccess("documents") ? "المستندات المحفوظة باسم هذا الموظف" : "يلزم إذن المستندات لعرض المرفقات"}</span></div></div>{canAccess("documents") ? (employeeDocuments as Document[]).filter(doc => isLinkedDocument(doc, "موظف", profile.id)).length ? <div className="compact-list">{(employeeDocuments as Document[]).filter(doc => isLinkedDocument(doc, "موظف", profile.id)).map(doc => <div className="compact-row" key={doc.id}><div className="compact-main"><strong>{doc.name}</strong><small>{doc.type} · ينتهي {doc.expiry}</small></div><Badge>{doc.status}</Badge><DocumentFileActions file={doc} /></div>)}</div> : <div className="empty-state" style={{ padding: "1.5rem" }}>لا توجد مستندات مرتبطة بهذا الموظف.</div> : null}</section><div className="detail-footer"><button className="btn outline" onClick={() => { setForm({ ...profile }); setProfile(null); }}>تعديل الملف</button><button className="btn primary" onClick={() => setProfile(null)}>إغلاق</button></div></Modal>}
    {form && <Modal title={list.some(item => item.id === form.id) ? "تعديل ملف الموظف" : "إضافة موظف"} onClose={() => setForm(null)} wide><form onSubmit={save}><div className="form-grid"><Field label="رقم الموظف *" value={form.employeeNo} onChange={value => setForm(prev => prev ? ({ ...prev, employeeNo: value }) : prev)} /><Field label="الاسم الكامل *" value={form.name} onChange={value => setForm(prev => prev ? ({ ...prev, name: value }) : prev)} /><Field label="رقم الهوية / الإقامة" value={form.nationalId} onChange={value => setForm(prev => prev ? ({ ...prev, nationalId: value }) : prev)} /><Field label="رقم الهاتف" value={form.phone} onChange={value => setForm(prev => prev ? ({ ...prev, phone: value }) : prev)} /><Field label="البريد الإلكتروني" value={form.email === "—" ? "" : form.email} onChange={value => setForm(prev => prev ? ({ ...prev, email: value || "—" }) : prev)} /><Field label="القسم" value={form.department} onChange={value => setForm(prev => prev ? ({ ...prev, department: value }) : prev)} /><Field label="المسمى الوظيفي" value={form.jobTitle} onChange={value => setForm(prev => prev ? ({ ...prev, jobTitle: value }) : prev)} /><Field label="تاريخ المباشرة" type="date" value={form.hireDate === "—" ? "" : form.hireDate} onChange={value => setForm(prev => prev ? ({ ...prev, hireDate: value }) : prev)} /><label className="field"><span>الحالة</span><select value={form.status} onChange={event => setForm(prev => prev ? ({ ...prev, status: event.target.value }) : prev)}><option>نشط</option><option>إجازة</option><option>موقوف</option><option>منتهي الخدمة</option></select></label><Field label="ملاحظات" value={form.notes} onChange={value => setForm(prev => prev ? ({ ...prev, notes: value }) : prev)} /></div><FormActions onCancel={() => setForm(null)} label="حفظ ملف الموظف" /></form></Modal>}
  </>;
}

type ReportData = { period: { from: string; to: string }; fleet: Record<string, number>; finance: Record<string, number>; maintenance: Record<string, number>; projects: Record<string, number>; documents: Record<string, number>; people: Record<string, number>; details: { claims: Row[]; contracts: Row[]; payables: Row[]; maintenance: Row[]; vehicleProfitability: Row[]; projectProfitability: Row[]; clientProfitability: Row[] } };
function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState(today.toISOString().slice(0,10));
  const [section, setSection] = useState("claims");
  const { data, isFetching } = trpc.reports.summary.useQuery({ from, to }, { staleTime: 15000 });
  const report = data as ReportData | undefined;
  const sections: Record<string, { title: string; rows: Row[]; columns: string[]; labels: string[] }> = {
    claims: { title: "المطالبات خلال الفترة", rows: report?.details.claims ?? [], columns: ["ref", "client", "status", "amount", "paid", "due"], labels: ["المطالبة", "العميل", "الحالة", "القيمة", "المدفوع", "الاستحقاق"] },
    contracts: { title: "العقود المبدوءة خلال الفترة", rows: report?.details.contracts ?? [], columns: ["ref", "client", "status", "total", "collected", "startDate", "expiry"], labels: ["العقد", "العميل", "الحالة", "قيمة العقد", "المحصل", "البداية", "الانتهاء"] },
    payables: { title: "الذمم الدائنة المفتوحة", rows: report?.details.payables ?? [], columns: ["ref", "supplier", "status", "amount", "paid", "remaining", "dueDate"], labels: ["الفاتورة", "المورد", "الحالة", "القيمة", "المدفوع", "المتبقي", "الاستحقاق"] },
    maintenance: { title: "أوامر الصيانة خلال الفترة", rows: report?.details.maintenance ?? [], columns: ["ref", "vehicle", "status", "cost", "start", "expectedReturn"], labels: ["الطلب", "المركبة", "الحالة", "التكلفة", "الدخول", "العودة المتوقعة"] },
    vehicleProfitability: { title: "تكلفة وعائد كل باص", rows: report?.details.vehicleProfitability ?? [], columns: ["plate", "expense", "revenue", "purchaseInPeriod", "netReturn", "busCount"], labels: ["الباص", "المصروف بالفترة", "الإيراد المحصل المخصص", "الشراء بالفترة", "الصافي النقدي", "عدد الباصات"] },
    projectProfitability: { title: "التشغيل حسب المشروع", rows: report?.details.projectProfitability ?? [], columns: ["name", "expense", "revenue", "netOperatingResult", "busCount"], labels: ["المشروع", "المصروفات", "الإيراد المحصل المخصص", "صافي التشغيل*", "عدد الباصات"] },
    clientProfitability: { title: "التشغيل حسب العميل", rows: report?.details.clientProfitability ?? [], columns: ["name", "expense", "revenue", "netOperatingResult", "busCount"], labels: ["العميل", "المصروفات", "الإيراد المحصل المخصص", "صافي التشغيل*", "عدد الباصات"] },
  };
  const current = sections[section];
  return <>
    <PageHeader eyebrow="الإدارة / التقارير" title="التقارير" description="ملخص موحد للأسطول والمالية والصيانة والمشاريع والموظفين ضمن فترة قابلة للتحديد والتصدير." />
    <div className="surface" style={{ padding: "1rem", marginBottom: "1rem" }}><div className="form-grid"><Field label="من تاريخ" type="date" value={from} onChange={setFrom} /><Field label="إلى تاريخ" type="date" value={to} onChange={setTo} /><div className="field"><span>حالة التقرير</span><strong>{isFetching ? "جارٍ التحديث…" : report ? `${report.period.from} — ${report.period.to}` : "تعذر تحميل البيانات"}</strong></div></div></div>
    {report && <>
      <div className="metrics-grid"><MetricCard title="إجمالي الأسطول" value={String(report.fleet.total)} helper={`${report.fleet.working} تعمل · ${report.fleet.ready} جاهزة`} icon={CarFront} tone="teal" /><MetricCard title="في الصيانة / متوقفة" value={`${report.fleet.maintenance} / ${report.fleet.stopped}`} helper="الحالة الحالية" icon={Wrench} tone="orange" /><MetricCard title="المطالبات غير المحصلة" value={formatSAR(report.finance.receivableOutstanding)} helper={`${report.finance.unpaidClaims} مطالبة · ${report.finance.overdueClaims} متأخرة`} icon={CircleDollarSign} tone="blue" /><MetricCard title="المستحقات على الشركة" value={formatSAR(report.finance.payablesOutstanding)} helper={`${report.finance.overduePayables} فاتورة متأخرة`} icon={ArrowUpLeft} tone="orange" /><MetricCard title="التحصيل / الصرف بالفترة" value={`${formatSAR(report.finance.incomingInPeriod)} / ${formatSAR(report.finance.outgoingInPeriod)}`} helper="الدفعات المسجلة خلال الفترة" icon={Activity} tone="violet" /><MetricCard title="تكلفة/إيراد تشغيل الباصات" value={`${formatSAR(report.finance.vehicleCostsInPeriod)} / ${formatSAR(report.finance.allocatedVehicleRevenueInPeriod)}`} helper={`الصافي مع الشراء المسجل بالفترة ${formatSAR(report.finance.fleetVehicleNetInPeriod)}`} icon={CarFront} tone="teal" /><MetricCard title="المشاريع النشطة" value={String(report.projects.activeNow)} helper={`${report.projects.assignedVehicles} مركبة مسندة · ${report.projects.requiredVehicles} مطلوبة`} icon={Truck} tone="blue" /></div>
      <div className="quick-metrics"><div><span>عقود جديدة بالفترة</span><strong>{formatSAR(report.finance.contractsValueInPeriod)}</strong></div><div><span>أوامر صيانة بالفترة</span><strong>{report.maintenance.openedInPeriod.toLocaleString("en-US")}</strong></div><div><span>تكلفة الصيانة بالفترة</span><strong>{formatSAR(report.maintenance.costInPeriod)}</strong></div><div><span>الموظفون النشطون</span><strong>{report.people.activeEmployees.toLocaleString("en-US")}</strong></div><div><span>مستندات تنتهي خلال الفترة</span><strong className="amber-text">{report.documents.expiringInPeriod.toLocaleString("en-US")}</strong></div><div><span>مستندات منتهية الآن</span><strong className="red-text">{report.documents.expiredNow.toLocaleString("en-US")}</strong></div></div>
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}><div className="section-head"><div><h2>{current.title}</h2><span>يمكن تصدير تفاصيل القسم الظاهر إلى CSV</span></div><button className="btn outline" onClick={() => exportCsv(current.rows, current.columns, `zaity-${section}-${from}-${to}`)}><Download size={15} />تصدير CSV</button></div><div className="field-note">* صافي التشغيل للمشروع والعميل = الإيراد المحصل المخصص − مصروفات التشغيل، ولا يتضمن سعر شراء المركبات حتى لا يوزع سعر الأصل على فترة تشغيل اعتباطية. أرقام الباصات تحسب سعر الشراء فقط إذا وقع تاريخ الشراء ضمن الفترة.</div><div className="finance-switch">{Object.entries(sections).map(([key, item]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>{item.title}</button>)}</div><div className="table-scroll"><table><thead><tr>{current.labels.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{current.rows.length ? current.rows.map(row => <tr key={row.id}>{current.columns.map(column => <td key={column}>{typeof row[column] === "number" && ["amount", "paid", "remaining", "total", "collected", "expense", "revenue", "purchaseInPeriod", "netReturn", "netOperatingResult"].includes(column) ? formatSAR(row[column]) : row[column] ?? "—"}</td>)}</tr>) : <tr><td colSpan={current.columns.length}>لا توجد سجلات لهذه الفترة</td></tr>}</tbody></table></div></section>
    </>}
  </>;
}

type PayableRow = Row & { ref: string; supplier: string; description: string; amount: number; paid: number; remaining: number; issueDate: string; dueDate: string; status: string; overdue: boolean; vehicleId?: number | null; vehicleCategory?: string | null; receiptName?: string | null; receiptUrl?: string | null; hasReceipt?: boolean; payments: Array<{ id: number; amount: number; paidAt: string; method: string; reference: string }> };
function PayablesPage({ canAccess, vehicles }: { canAccess: (key: ModuleKey) => boolean; vehicles: Vehicle[] }) {
  const utils = trpc.useUtils();
  const { data: data = [] } = trpc.payables.list.useQuery(undefined, { staleTime: 15000 });
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
  const [payment, setPayment] = useState<Row>({ id: 0, amount: 0, paidAt: new Date().toISOString().slice(0, 10), method: "تحويل بنكي", reference: "—", notes: "" });
  const blank = (): Row => ({ id: Date.now(), ref: `AP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, supplier: "", description: "", amount: 0, issueDate: new Date().toISOString().slice(0, 10), dueDate: "", notes: "", vehicleId: null, vehicleCategory: "أخرى", receiptName: "", receiptUrl: "" });
  const rows = payables.filter(row => (!search || Object.values(row).join(" ").includes(search)) && (tab === "الكل" || (tab === "متأخرة" ? row.overdue : row.status === tab)));
  const invalidate = () => { utils.payables.list.invalidate(); utils.vehicles.list.invalidate(); utils.vehicles.financeProfile.invalidate(); };
  const openPayableReceipt = async (row: PayableRow) => { try { const file = await utils.payables.receipt.fetch({ id: row.id }); if (!file?.url) { toast.error("لم يتم العثور على الفاتورة"); return; } const link = document.createElement("a"); link.href = file.url; link.download = file.name; link.target = "_blank"; link.click(); } catch (error: any) { toast.error(error.message || "تعذر فتح الفاتورة"); } };
  const saveBill = (event: React.FormEvent) => {
    event.preventDefault();
    if (!bill?.supplier || !bill?.description || Number(bill.amount) <= 0) { toast.error("أدخل المورد والوصف ومبلغًا صالحًا"); return; }
    const { id, ...raw } = bill;
    const payload = { ...raw, amount: Number(raw.amount), vehicleId: raw.vehicleId ? Number(raw.vehicleId) : null, vehicleCategory: raw.vehicleId ? raw.vehicleCategory : null } as any;
    const onSuccess = () => { invalidate(); setBill(null); toast.success(bill.vehicleId ? "تم حفظ الفاتورة وربط تكلفتها بملف الباص" : "تم حفظ فاتورة المورد"); };
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
  const outstanding = payables.filter(row => row.status !== "ملغاة").reduce((sum, row) => sum + row.remaining, 0);
  const overdueTotal = payables.filter(row => row.overdue).reduce((sum, row) => sum + row.remaining, 0);
  return <>
    <PageHeader eyebrow="المالية / الذمم الدائنة" title="المبالغ المستحقة علينا" description="سجل فواتير الموردين واعتمادها ثم تتبع المدفوعات الصادرة والرصيد المتبقي بسجل مستقل." action="إضافة فاتورة مورد" onAction={() => setBill(blank())} />
    <div className="quick-metrics"><div><span>إجمالي الرصيد المستحق</span><strong>{formatSAR(outstanding)}</strong></div><div><span>فواتير بانتظار الاعتماد</span><strong className="amber-text">{payables.filter(row => row.status === "جديدة").length.toLocaleString("en-US")}</strong></div><div><span>أرصدة متأخرة</span><strong className="red-text">{formatSAR(overdueTotal)}</strong></div><div><span>فواتير مسجلة</span><strong>{payables.filter(row => row.status !== "ملغاة").length.toLocaleString("en-US")}</strong></div></div>
    <TableShell columns={["رقم الفاتورة", "المورد", "الوصف", "المبلغ", "المدفوع", "المتبقي", "تاريخ الاستحقاق", "الحالة", "سجل الصرف"]} onExport={() => exportCsv(rows, ["ref", "supplier", "description", "amount", "paid", "remaining", "dueDate", "status"], "payables")} search={search} setSearch={setSearch} tabs={["الكل", "جديدة", "معتمدة", "مدفوعة جزئيًا", "مدفوعة", "متأخرة", "ملغاة"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة فاتورة" onAdd={() => setBill(blank())}>
      {rows.map(row => <tr key={row.id}><td><strong className="table-primary">{row.ref}</strong><small>{row.issueDate}</small></td><td>{row.supplier}</td><td>{row.description}{row.vehicleId && <small>مربوطة بالباص · {vehicles.find(vehicle => vehicle.id === row.vehicleId)?.plate || `#${row.vehicleId}`} · {row.vehicleCategory}</small>}{row.hasReceipt && <button className="text-link" onClick={() => openPayableReceipt(row)}>فتح الفاتورة المرفقة</button>}</td><td>{formatSAR(row.amount)}</td><td>{formatSAR(row.paid)}</td><td>{formatSAR(row.remaining)}</td><td className={row.overdue ? "red-text" : ""}>{row.dueDate}{row.overdue && <small className="red-text">متأخرة</small>}</td><td><Badge>{row.status}</Badge></td><td><button className="text-link" onClick={() => setHistoryFor(row)}>{row.payments.length.toLocaleString("en-US")} دفعة · التفاصيل</button></td><td className="actions-cell">{row.status === "جديدة" && <button className="btn outline" onClick={() => approve(row)}>اعتماد</button>}{["معتمدة", "مدفوعة جزئيًا"].includes(row.status) && <button className="btn primary" onClick={() => { setPayment({ id: 0, amount: row.remaining, paidAt: new Date().toISOString().slice(0, 10), method: "تحويل بنكي", reference: "—", notes: "" }); setPaymentFor(row); }}>تسجيل صرف</button>}{["جديدة", "معتمدة"].includes(row.status) && <button className="btn ghost" onClick={() => cancel(row)}>إلغاء</button>}<button className="row-menu-btn" title="تعديل الفاتورة" onClick={() => setBill({ ...row })}><Pencil size={15} /></button></td></tr>)}
    </TableShell>
    {bill && <Modal title={payables.some(row => row.id === bill.id) ? "تعديل فاتورة مورد" : "إضافة فاتورة مورد"} onClose={() => setBill(null)} wide><form onSubmit={saveBill}><div className="form-grid"><Field label="رقم الفاتورة" value={bill.ref} onChange={value => setBill(prev => prev ? ({ ...prev, ref: value }) : prev)} /><Field label="اسم المورد *" value={bill.supplier} onChange={value => setBill(prev => prev ? ({ ...prev, supplier: value }) : prev)} /><Field label="وصف الفاتورة *" value={bill.description} onChange={value => setBill(prev => prev ? ({ ...prev, description: value }) : prev)} /><Field label="قيمة الفاتورة (SAR) *" type="number" value={String(bill.amount ?? 0)} onChange={value => setBill(prev => prev ? ({ ...prev, amount: Number(value) }) : prev)} /><Field label="تاريخ الإصدار" type="date" value={bill.issueDate} onChange={value => setBill(prev => prev ? ({ ...prev, issueDate: value }) : prev)} /><Field label="تاريخ الاستحقاق" type="date" value={bill.dueDate} onChange={value => setBill(prev => prev ? ({ ...prev, dueDate: value }) : prev)} /><Field label="ملاحظات" value={bill.notes} onChange={value => setBill(prev => prev ? ({ ...prev, notes: value }) : prev)} />{canAccess("vehicles") && canAccess("finance") && <><label className="field"><span>ربط الفاتورة بباص (اختياري)</span><select value={bill.vehicleId ? String(bill.vehicleId) : ""} onChange={event => setBill(prev => prev ? ({ ...prev, vehicleId: event.target.value ? Number(event.target.value) : null }) : prev)}><option value="">فاتورة عامة / غير مرتبطة بباص</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.brand} {vehicle.model}</option>)}</select></label>{bill.vehicleId && <label className="field"><span>فئة مصروف الباص</span><select value={bill.vehicleCategory || "أخرى"} onChange={event => setBill(prev => prev ? ({ ...prev, vehicleCategory: event.target.value }) : prev)}>{["صيانة", "قطع غيار", "زيوت وفلاتر", "إطارات", "إصلاحات وأعطال", "تأمين", "فحص واستمارة", "مخالفات", "أخرى"].map(category => <option key={category}>{category}</option>)}</select><small>تدخل قيمة الفاتورة تلقائيًا في إجمالي هذا الباص، ولا حاجة لإدخالها مرة ثانية في ملف الباص.</small></label>}</>}<label className="field"><span>صورة الفاتورة (حد 700 ك.ب)</span><input type="file" accept="image/*,.pdf" onChange={event => { const file=event.target.files?.[0]; if(!file)return; if(file.size>700000){toast.error("الحد الأقصى للمرفق 700 كيلوبايت");return;} const reader=new FileReader(); reader.onload=()=>setBill(prev=>prev?({...prev,receiptName:file.name,receiptUrl:String(reader.result||"")}):prev); reader.readAsDataURL(file); }} />{bill.receiptName && <small>{bill.receiptName}</small>}</label></div><FormActions onCancel={() => setBill(null)} label="حفظ الفاتورة" /></form></Modal>}
    {historyFor && <Modal title={`سجل الصرف · ${historyFor.ref}`} onClose={() => setHistoryFor(null)}><div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th></tr></thead><tbody>{historyFor.payments.length ? historyFor.payments.map(entry => <tr key={entry.id}><td>{entry.paidAt}</td><td>{formatSAR(entry.amount)}</td><td>{entry.method}</td><td>{entry.reference}</td></tr>) : <tr><td colSpan={4}>لا توجد دفعات مسجلة</td></tr>}</tbody></table></div><div className="detail-footer"><button className="btn ghost" onClick={() => setHistoryFor(null)}>إغلاق</button></div></Modal>}
    {paymentFor && <Modal title={`تسجيل صرف · ${paymentFor.ref}`} onClose={() => setPaymentFor(null)}><form onSubmit={submitPayment}><p>المتبقي: <strong>{formatSAR(paymentFor.remaining)}</strong></p><div className="form-grid single"><Field label="مبلغ الصرف (SAR)" type="number" value={String(payment.amount)} onChange={value => setPayment(prev => ({ ...prev, amount: Number(value) }))} /><Field label="تاريخ الصرف" type="date" value={payment.paidAt} onChange={value => setPayment(prev => ({ ...prev, paidAt: value }))} /><label className="field"><span>طريقة الصرف</span><select value={payment.method} onChange={event => setPayment(prev => ({ ...prev, method: event.target.value }))}><option>تحويل بنكي</option><option>نقدًا</option><option>شيك</option></select></label><Field label="مرجع التحويل" value={payment.reference} onChange={value => setPayment(prev => ({ ...prev, reference: value }))} /><Field label="ملاحظات" value={payment.notes} onChange={value => setPayment(prev => ({ ...prev, notes: value }))} /></div><FormActions onCancel={() => setPaymentFor(null)} label="حفظ دفعة الصرف" /></form></Modal>}
  </>;
}

function FinancePage({ onAction, onOpenForm, contracts, claims, payments, onPaymentArchive }: { onAction: (action: string, row: Row) => void; onOpenForm: (row?: Row) => void; contracts: Contract[]; claims: Claim[]; payments: PaymentRow[]; onPaymentArchive: (payment: PaymentRow) => void }) {
  const [view, setView] = useState<"contracts" | "claims">("contracts"); const [tab, setTab] = useState("كل العقود"); const [search, setSearch] = useState(""); const [menu, setMenu] = useState<number | null>(null);
  const isClaimOverdue = (claim: Row) => { const due = typeof claim.due === "string" && claim.due !== "—" ? Date.parse(`${claim.due}T23:59:59`) : NaN; return Number.isFinite(due) && due < Date.now() && !["تم صرفها", "مرفوضة", "ملغاة", "غير مرفوعة"].includes(String(claim.status)); };
  const rows = view === "contracts" ? contracts : claims;
  const filtered = rows.filter(r => { const matchesSearch = !search || Object.values(r).join(" ").includes(search); const matchesTab = view === "contracts" ? tab === "كل العقود" || r.status === tab : tab === "كل المطالبات" || (tab === "متأخرة" ? isClaimOverdue(r) : r.status === tab); return matchesSearch && matchesTab; });
  const switchView = (nextView: "contracts" | "claims") => { setView(nextView); setTab(nextView === "contracts" ? "كل العقود" : "كل المطالبات"); };
  const activeContracts = contracts.filter(contract => contract.status === "قائم");
  const totalValue = activeContracts.reduce((sum, contract) => sum + Number(contract.total || 0), 0);
  const collectedValue = activeContracts.reduce((sum, contract) => sum + Number(contract.collected || 0), 0);
  const outstandingValue = Math.max(0, totalValue - collectedValue);
  const collectionRate = totalValue ? ((collectedValue / totalValue) * 100).toFixed(1) : "0.0";
  const expiringSoon = activeContracts.filter(contract => contract.expiry && new Date(contract.expiry).getTime() - Date.now() < 60 * 86400000).length;
  const paymentTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstandingClaims = claims.reduce((sum, claim) => sum + Math.max(0, Number(claim.amount || 0) - Number(claim.paid || 0)), 0);
  return <><PageHeader eyebrow="المالية / الأداء" title="المالية" description="إدارة العقود والمطالبات والتحصيل والتقارير المالية في لوحة واحدة." action={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"} onAction={() => onOpenForm(view === "claims" ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` } : undefined)} /><div className="finance-switch"><button className={view === "contracts" ? "active" : ""} onClick={() => switchView("contracts")}>العقود المالية</button><button className={view === "claims" ? "active" : ""} onClick={() => switchView("claims")}>المطالبات المالية</button><button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}>تسجيل دفعة</button><button className="period-btn" onClick={() => toast.success("تم تطبيق الفترة: هذا الشهر")}>هذا الشهر <ChevronDown size={14} /></button></div><div className="metrics-grid finance-metrics"><MetricCard title="قيمة العقود الفعالة" value={formatSAR(totalValue)} helper={`${activeContracts.length} عقود قائمة`} icon={FileText} tone="teal" /><MetricCard title="المحصل" value={formatSAR(collectedValue)} helper={`${collectionRate}% من الإجمالي`} icon={CheckCircle2} tone="blue" /><MetricCard title="المتبقي" value={formatSAR(outstandingValue)} helper={`${claims.length} مطالبات`} icon={Clock3} tone="orange" /><MetricCard title="عقود قاربت على الانتهاء" value={String(expiringSoon)} helper="خلال ٦٠ يومًا" icon={Activity} tone="violet" /></div><TableShell columns={view === "contracts" ? ["رقم العقد", "العميل", "النوع", "القيمة الإجمالية", "المحصل", "تاريخ الانتهاء", "الحالة"] : ["رقم المطالبة", "العميل", "العقد", "القيمة", "الاستحقاق", "المدفوع", "الحالة"]} onExport={() => exportCsv(filtered, Object.keys(filtered[0] || {}).filter(k => k !== "id"), view)} search={search} setSearch={setSearch} tabs={view === "contracts" ? ["كل العقود", "قائم", "مكتمل", "عرض سعر"] : ["كل المطالبات", "غير مرفوعة", "جديدة", "تحت الإجراء", "تم اعتمادها", "تم صرفها", "متأخرة", "مرفوضة", "ملغاة"]} activeTab={tab} setActiveTab={setTab} addLabel={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"} onAdd={() => onOpenForm(view === "claims" ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` } : undefined)}>{filtered.map((r: any) => view === "contracts" ? <tr key={r.id}><td><strong className="table-primary">{r.ref}</strong><small>{r.createdAt ? `أُنشئ في ${new Date(r.createdAt).toLocaleDateString("en-GB")}` : "تاريخ الإنشاء غير متوفر"}</small></td><td>{r.client}</td><td>{r.type}</td><td>{formatSAR(r.total)}</td><td>{formatSAR(r.collected)}</td><td>{r.expiry}</td><td><Badge>{r.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={18} /></button>{menu === r.id && <ContextMenu row={r} module="finance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, r); }} />}</td></tr> : <tr key={r.id}><td><strong className="table-primary">{r.ref}</strong></td><td>{r.client}</td><td>{r.contract}</td><td>{formatSAR(r.amount)}</td><td>{r.due}</td><td>{formatSAR(r.paid)}</td><td><Badge>{r.status}</Badge>{isClaimOverdue(r) && <small className="red-text">متأخرة الاستحقاق</small>}</td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={18} /></button>{menu === r.id && <ContextMenu row={r} module="finance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, r); }} />}</td></tr>)}</TableShell><section className="surface mini-table" style={{ marginTop: "1rem" }}><div className="section-head"><div><h2>سجل الدفعات</h2><span>{payments.length} دفعة محفوظة</span></div><button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}><Plus size={15} />تسجيل دفعة</button></div>{payments.length ? <div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>المرجع</th><th>الربط</th><th>إجراءات</th></tr></thead><tbody>{payments.slice(0, 10).map(payment => <tr key={payment.id}><td>{payment.paidAt}</td><td>{formatSAR(payment.amount)}</td><td>{payment.method}</td><td>{payment.reference}</td><td>{payment.contractId ? `عقد #${payment.contractId}` : payment.claimId ? `مطالبة #${payment.claimId}` : "غير مرتبط"}</td><td className="actions-cell"><button className="row-menu-btn" title="تعديل الدفعة" onClick={() => onOpenForm({ ...payment, recordType: "payment" })}><Pencil size={16} /></button><button className="row-menu-btn danger" title="إلغاء الدفعة" onClick={() => onPaymentArchive(payment)}><Archive size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ padding: "1.5rem" }}><strong>لا توجد دفعات مسجلة</strong><span>سجّل أول دفعة من زر تسجيل دفعة.</span></div>}</section><section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}><div className="section-head"><div><h2>تقرير مالي مختصر</h2><span>ملخص قابل للتصدير من البيانات الحالية</span></div><button className="btn outline" onClick={() => exportCsv([{ id: 1, metric: "إجمالي العقود القائمة", value: totalValue }, { id: 2, metric: "إجمالي الدفعات", value: paymentTotal }, { id: 3, metric: "المطالبات المتبقية", value: outstandingClaims }], ["metric", "value"], "financial-report")}><Download size={15} />تصدير التقرير</button></div><div className="metrics-grid finance-metrics"><MetricCard title="إجمالي الدفعات" value={formatSAR(paymentTotal)} helper={`${payments.length} دفعة`} icon={CircleDollarSign} tone="blue" /><MetricCard title="متبقي المطالبات" value={formatSAR(outstandingClaims)} helper={`${claims.length} مطالبة`} icon={Clock3} tone="orange" /><MetricCard title="نسبة التحصيل" value={`${collectionRate}%`} helper="من العقود القائمة" icon={CheckCircle2} tone="teal" /></div></section></>;
}

function SettingsPage({ settingsCount, auditLogs }: { settingsCount: number; auditLogs: Array<{ action: string; entityType: string; createdAt?: Date | string }> }) {
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
    const permissionOptions = [["dashboard", "لوحة التحكم"], ["vehicles", "المركبات"], ["projects", "المشاريع"], ["payables", "المستحقات علينا"], ["maintenance", "الصيانة"], ["documents", "المستندات"], ["drivers", "السائقون"], ["employees", "الموظفون"], ["clients", "العملاء"], ["finance", "المالية"], ["reports", "التقارير"]] as const;
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
    
    <div className="audit-card surface"><div><div className="eyebrow">سجل التغييرات (Audit)</div><h2>تغييرات النظام الأخيرة</h2></div>{auditLogs.slice(0, 4).map((log, i) => <div className="audit-row" key={`${log.action}-${i}`}><span className={`avatar ${i % 2 ? "teal" : ""}`}>ع</span><div><strong>{log.action}</strong><span>{log.entityType}</span></div><time>مسجل</time></div>)}</div>

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
  const userPermissions = new Set(user?.role === "admin" ? ["dashboard", "vehicles", "projects", "maintenance", "documents", "drivers", "employees", "clients", "finance", "payables", "reports", "settings"] : (() => { try { return JSON.parse(user?.permissions || "[]") as string[]; } catch { return []; } })());
  const canAccess = (key: ModuleKey) => userPermissions.has(key);
  const vehicleQuery = trpc.vehicles.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("vehicles") });
  const driverQuery = trpc.drivers.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("drivers") });
  const maintenanceQuery = trpc.maintenance.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("maintenance") });
  const documentQuery = trpc.documents.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("documents") });
  const clientQuery = trpc.clients.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("clients") });
  const claimQuery = trpc.claims.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("finance") });
  const contractsQuery = trpc.contracts.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("finance") });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) && canAccess("projects") });
  const payablesQuery = trpc.payables.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("payables") });
  const paymentsQuery = trpc.payments.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("finance") });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("dashboard") });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) && canAccess("dashboard") });
  const notificationRead = trpc.notifications.markRead.useMutation();
  const settingsQuery = trpc.settingsCatalog.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const auditQuery = trpc.audit.list.useQuery(undefined, { staleTime: 30000, enabled: user?.role === "admin" });
  const vehicleCreate = trpc.vehicles.create.useMutation();
  const vehicleUpdate = trpc.vehicles.update.useMutation();
  const vehicleAssign = trpc.vehicles.assignDriver.useMutation();
  const vehicleArchive = trpc.vehicles.archive.useMutation();
  const driverCreate = trpc.drivers.create.useMutation();
  const driverUpdate = trpc.drivers.update.useMutation();
  const driverArchive = trpc.drivers.archive.useMutation();
  const maintenanceCreate = trpc.maintenance.create.useMutation();
  const maintenanceUpdate = trpc.maintenance.update.useMutation();
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
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [commandOpen, setCommandOpen] = useState(false); const [modal, setModal] = useState<{ module: ModuleKey; row?: Row } | null>(null); const [detail, setDetail] = useState<{ module: ModuleKey; row: Row } | null>(null); const [vehicleProfile, setVehicleProfile] = useState<Vehicle | null>(null); const [driverDetail, setDriverDetail] = useState<Driver | null>(null); const [assignmentVehicle, setAssignmentVehicle] = useState<Vehicle | null>(null); const [assignmentDriver, setAssignmentDriver] = useState<Driver | null>(null); const [quickAction, setQuickAction] = useState<{ action: string; row: Row } | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]); const [documents, setDocuments] = useState<Document[]>([]); const [clients, setClients] = useState<Client[]>([]); const [contracts, setContracts] = useState<Contract[]>([]); const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => { if (vehicleQuery.data) setVehicles(vehicleQuery.data as Vehicle[]); }, [vehicleQuery.data]);
  useEffect(() => { if (driverQuery.data) setDrivers(driverQuery.data as Driver[]); }, [driverQuery.data]);
  useEffect(() => { if (maintenanceQuery.data) setMaintenance(maintenanceQuery.data as Maintenance[]); }, [maintenanceQuery.data]);
  useEffect(() => { if (documentQuery.data) setDocuments(documentQuery.data as Document[]); }, [documentQuery.data]);
  useEffect(() => { if (clientQuery.data) setClients(clientQuery.data as Client[]); }, [clientQuery.data]);
  useEffect(() => { if (claimQuery.data) setClaims(claimQuery.data as Claim[]); }, [claimQuery.data]);
  useEffect(() => { if (contractsQuery.data) setContracts(contractsQuery.data as Contract[]); }, [contractsQuery.data]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); } if (e.key === "Escape") { setCommandOpen(false); setMobileOpen(false); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const onNavigate = (key: ModuleKey) => { if (!canAccess(key)) { toast.error("ليس لديك صلاحية الوصول إلى هذا القسم"); return; } setActive(key); setMobileOpen(false); navigate(key === "dashboard" ? "/dashboard" : `/dashboard/${key === "finance" ? "financial/contracts" : key}`); };
  const onAction = (action: string, row: Row) => {
    if (action === "view" && active === "vehicles") setVehicleProfile(row as Vehicle);
    else if (action === "view") setDetail({ module: active, row });
    else if (action === "edit") setModal({ module: active, row });
    else if (action === "assign" && active === "vehicles") setAssignmentVehicle(row as Vehicle);
    else if (action === "assign" && active === "drivers") setAssignmentDriver(row as Driver);
    else if (action === "archive") toast("هل تريد أرشفة هذا السجل؟", { action: { label: "تأكيد", onClick: () => { if (active === "vehicles") vehicleArchive.mutate({ id: row.id }, { onSuccess: () => { setVehicles(prev => prev.filter(v => v.id !== row.id)); utils.vehicles.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); } }); else if (active === "drivers") driverArchive.mutate({ id: row.id }, { onSuccess: () => { setDrivers(prev => prev.filter(item => item.id !== row.id)); utils.drivers.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة السائق: ${error.message}`) }); else if (active === "maintenance") maintenanceArchive.mutate({ id: row.id }, { onSuccess: () => { setMaintenance(prev => prev.filter(item => item.id !== row.id)); utils.maintenance.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة طلب الصيانة: ${error.message}`) }); else if (active === "documents") documentArchive.mutate({ id: row.id }, { onSuccess: () => { setDocuments(prev => prev.filter(item => item.id !== row.id)); utils.documents.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة المستند: ${error.message}`) }); else if (active === "clients") clientArchive.mutate({ id: row.id }, { onSuccess: () => { setClients(prev => prev.filter(item => item.id !== row.id)); utils.clients.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة العميل: ${error.message}`) }); else if (active === "finance" && String(row.ref || "").startsWith("CL-")) claimArchive.mutate({ id: row.id }, { onSuccess: () => { setClaims(prev => prev.filter(item => item.id !== row.id)); utils.claims.list.invalidate(); toast.success("تمت أرشفة المطالبة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة المطالبة: ${error.message}`) }); else if (active === "finance") contractArchive.mutate({ id: row.id }, { onSuccess: () => { setContracts(prev => prev.filter(item => item.id !== row.id)); utils.contracts.list.invalidate(); toast.success("تمت أرشفة العقد بنجاح"); }, onError: error => toast.error(`تعذر أرشفة العقد: ${error.message}`) }); } }, cancel: { label: "إلغاء", onClick: () => {} } });
    else if (action === "maintenance") { setActive("maintenance"); setModal({ module: "maintenance", row: { id: Date.now(), ref: `MT-${Date.now()}`, vehicle: row.plate, vehicleId: row.id, type: "صيانة دورية", manager: "—", start: new Date().toISOString().slice(0, 10), due: "", status: "جديد", cost: "0 SAR" } }); navigate("/dashboard/maintenance"); }
    else if (["item", "cost", "status", "extend"].includes(action)) setQuickAction({ action, row });
    else if (action === "download") { if (active === "documents" && row.fileUrl) { const link = document.createElement("a"); link.href = String(row.fileUrl); link.download = String(row.fileName || row.name || "document"); link.target = "_blank"; link.click(); toast.success("تم فتح ملف المستند"); } else { const csv = Object.entries(row).filter(([key]) => key !== "id").map(([key, value]) => `${key},"${String(value ?? "").replaceAll('"', '""')}"`).join("\n"); const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${row.name || row.ref || row.plate || "record"}.csv`; link.click(); URL.revokeObjectURL(link.href); toast.success("تم تنزيل السجل"); } }
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
      if (!canAccess("finance")) { delete payload.cost; delete payload.receiptName; delete payload.receiptUrl; }
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
        contractUpdate.mutate({ id: data.id, data: { ...contract, items: (contract.items as any[])?.length ? (contract.items as any[]) : undefined } as any }, { onSuccess: saved => { setContracts(prev => prev.map(item => item.id === data.id ? { ...item, ...saved } as Contract : item)); utils.contracts.list.invalidate(); setModal(null); toast.success("تم حفظ تعديل العقد في قاعدة البيانات"); }, onError: error => toast.error(`تعذر تعديل العقد: ${error.message}`) });
        return;
      }
      contractCreate.mutate({
        ref: String(contract.ref),
        client: String(contract.client),
        clientId: clients.find(item => item.name === String(contract.client))?.id ?? null,
        type: String(contract.type),
        startDate: String(contract.startDate || new Date().toISOString().slice(0, 10)),
        expiry: String(contract.expiry),
        total: Number(contract.total || 0),
        collected: Number(contract.collected || 0),
        status: (contract.status || "قائم") as "قائم" | "مكتمل" | "عرض سعر" | "ملغي",
        items: (contract.items as any[])?.length ? (contract.items as any[]) : [{ vehicleId: null, vehiclePlate: "—", quantity: 1, driver: "—", coverage: "مركبة وسائق", description: "خدمة تشغيل" }],
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
      projectId: data.projectId ? Number(data.projectId) : null,
      project: String(data.project || "—"),
      driver: String(data.driver || "—"),
      driverId: data.driverId ? Number(data.driverId) : null,
      status: data.status as any,
      client: String(data.client || "—"),
      clientId: data.clientId ? Number(data.clientId) : null,
      contract: String(data.contract || "—"),
      contractId: data.contractId ? Number(data.contractId) : null,
      notes: data.notes ? String(data.notes) : undefined,
    };
    const onSuccess = (saved: Row) => { setVehicles(prev => prev.some(v => v.id === saved.id) ? prev.map(v => v.id === saved.id ? saved as Vehicle : v) : [saved as Vehicle, ...prev]); utils.vehicles.list.invalidate(); setModal(null); toast.success("تم حفظ المركبة"); };
    const onError = (error: { message: string }) => toast.error(`تعذر حفظ المركبة: ${error.message}`);
    if (vehicles.some(v => v.id === data.id)) vehicleUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError });
    else vehicleCreate.mutate(payload as any, { onSuccess, onError });
  };
  const saveQuickAction = (value: string) => {
    if (!quickAction) return;
    const id = quickAction.row.id;
    const finish = (message: string, invalidate: () => void) => { invalidate(); setQuickAction(null); toast.success(message); };
    if (active === "maintenance") {
      const data = quickAction.action === "status" ? { status: value } : quickAction.action === "cost" ? { cost: value } : { type: `${quickAction.row.type} · ${value}` };
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
  const content = active === "dashboard" ? <DashboardHome onNavigate={onNavigate} userName={user?.name} vehicles={vehicles} drivers={drivers} maintenance={maintenance} documents={documents} contracts={contracts} claims={claims} payables={(payablesQuery.data ?? []) as PayableRow[]} projects={(projectsQuery.data ?? []) as ProjectRow[]} tasks={(tasksQuery.data ?? []) as Array<{ id: number; title: string; dueAt: string; status: string }>} notifications={(notificationsQuery.data ?? []) as Array<{ id: number; title: string; message: string; severity: string }>} onTaskToggle={task => { const nextStatus = task.status === "مكتملة" ? "مفتوحة" : "مكتملة"; taskUpdate.mutate({ id: task.id, data: { status: nextStatus } }, { onSuccess: () => { utils.tasks.list.invalidate(); toast.success("تم تحديث المهمة"); }, onError: error => toast.error(`تعذر تحديث المهمة: ${error.message}`) }); }} onTaskCreate={() => { const title = window.prompt("اكتب عنوان المهمة"); if (title?.trim()) taskCreate.mutate({ title: title.trim(), dueAt: "اليوم", status: "مفتوحة", assignee: user?.name || "—" }, { onSuccess: () => { utils.tasks.list.invalidate(); toast.success("تمت إضافة المهمة"); }, onError: error => toast.error(`تعذر إضافة المهمة: ${error.message}`) }); }} /> : active === "vehicles" ? <VehiclesPage vehicles={vehicles} setVehicles={setVehicles} onOpenForm={row => setModal({ module: "vehicles", row })} onAction={onAction} canAccess={canAccess} /> : active === "projects" ? <ProjectsPage canAccess={canAccess} /> : active === "employees" ? <EmployeesPage canAccess={canAccess} /> : active === "reports" ? <ReportsPage />: active === "payables" ? <PayablesPage canAccess={canAccess} vehicles={vehicles} /> : active === "maintenance" ? <MaintenancePage maintenance={maintenance} onOpenForm={row => setModal({ module: "maintenance", row })} onAction={onAction} /> : active === "documents" ? <DocumentsPage documents={documents} onOpenForm={row => setModal({ module: "documents", row })} onAction={onAction} /> : active === "drivers" ? <DriversPage drivers={drivers} onOpenForm={row => setModal({ module: "drivers", row })} onAction={onAction} onView={setDriverDetail} /> : active === "clients" ? <ClientsPage clients={clients} onOpenForm={row => setModal({ module: "clients", row })} onAction={onAction} /> : active === "finance" ? <FinancePage contracts={contracts} claims={claims} payments={(paymentsQuery.data ?? []) as PaymentRow[]} onAction={onAction} onOpenForm={row => setModal({ module: "finance", row })} onPaymentArchive={payment => toast("سيتم إلغاء الدفعة وعكس أثرها المالي؟", { action: { label: "تأكيد", onClick: () => paymentArchive.mutate({ id: payment.id }, { onSuccess: () => { utils.payments.list.invalidate(); utils.contracts.list.invalidate(); utils.claims.list.invalidate(); toast.success("تم إلغاء الدفعة وعكس أثرها"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })} /> : <SettingsPage settingsCount={(settingsQuery.data ?? []).length} auditLogs={(auditQuery.data ?? []) as Array<{ action: string; entityType: string; createdAt?: Date | string }>} />;
  if (authLoading) return <div className="auth-state" dir="rtl">جارٍ التحقق من صلاحية الدخول...</div>;
  if (!user) return <div className="auth-state" dir="rtl">جارٍ تحويلك إلى صفحة تسجيل الدخول...</div>;
  if (!canAccess(active)) return <div className="auth-state" dir="rtl">جارٍ التحقق من صلاحية القسم...</div>;
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}><div className="sidebar-top"><Logo compact={collapsed} /><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="طي القائمة"><ChevronRight size={17} /></button></div><div className="workspace-switch"><span className="workspace-avatar">ه</span><div><strong>الهتاري بلس لإدارة الأسطول</strong><small>الحساب الرئيسي</small></div><ChevronDown size={15} /></div><nav>{navGroups.map(group => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.filter(item => canAccess(item.key as ModuleKey)).map(item => <button key={item.key} className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key as ModuleKey)}><item.icon size={18} /><span>{item.label}</span>{sidebarCounts[item.key] !== undefined && <em>{sidebarCounts[item.key]!.toLocaleString("en-US")}</em>}</button>)}</div>)}</nav><div className="sidebar-bottom"><button className="help-link" onClick={() => toast.info("تواصل مع مسؤول النظام للحصول على المساعدة") }><Headphones size={17} /><span>مركز المساعدة</span></button><div className="sidebar-user"><span className="user-avatar">ع</span><div><strong>{user?.name || "المستخدم"}</strong><small>{user?.role === "admin" ? "مدير النظام" : "مستخدم"}</small></div><button onClick={() => logout()} aria-label="تسجيل الخروج"><LogOut size={16} /></button></div></div></aside>
    {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
    <main className="main-area"><header className="topbar"><div className="topbar-start"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>الرئيسية</span><ChevronLeft size={14} /><strong>{active === "dashboard" ? "الإحصائيات" : navGroups.flatMap(g => g.items).find(i => i.key === active)?.label}</strong></div></div><div className="topbar-actions"><button className="quick-search" onClick={() => setCommandOpen(true)}><Search size={16} /><span>بحث سريع</span><kbd>⌘ K</kbd></button><button className="top-icon" onClick={() => { const first = notificationsQuery.data?.find(item => !item.readAt); if (first) notificationRead.mutate({ id: first.id }, { onSuccess: () => utils.notifications.list.invalidate() }); toast(first ? `${first.title}: ${first.message}` : "لا توجد إشعارات جديدة", { icon: <Bell size={16} /> }); }}><Bell size={18} />{Boolean(notificationsQuery.data?.some(item => !item.readAt)) && <i />}</button><span className="top-divider" /><div className="top-profile"><span className="user-avatar">ع</span><div><strong>{user?.name || "المستخدم"}</strong><small>{user?.role === "admin" ? "مدير النظام" : "مستخدم"}</small></div><ChevronDown size={14} /></div></div></header><div className="page-content">{content}</div><footer className="app-footer"><span>© {new Date().getFullYear()} الهتاري بلس</span><span>البيانات متصلة بقاعدة البيانات</span><span className="online"><i /> النظام يعمل بشكل طبيعي</span></footer></main>
    {modal && <RecordForm module={modal.module} row={modal.row} canAccess={canAccess} onClose={() => setModal(null)} onSave={saveRecord} />}{driverDetail && <DriverVehiclesModal driver={driverDetail} vehicles={vehicles} documents={documents} canViewDocuments={canAccess("documents")} onClose={() => setDriverDetail(null)} />}{assignmentVehicle && <AssignDriverModal vehicle={assignmentVehicle} drivers={drivers} onClose={() => setAssignmentVehicle(null)} onSave={saveAssignment} />}{assignmentDriver && <AssignVehicleModal driver={assignmentDriver} vehicles={vehicles} onClose={() => setAssignmentDriver(null)} onSave={saveVehicleAssignment} />}{quickAction && <QuickActionModal action={quickAction.action} module={active} row={quickAction.row} onClose={() => setQuickAction(null)} onSave={saveQuickAction} />}{vehicleProfile && <VehicleProfileModal vehicle={vehicleProfile} canAccess={canAccess} maintenance={maintenance} documents={documents} onClose={() => setVehicleProfile(null)} />}{detail && <DetailModal module={detail.module} row={detail.row} canAccess={canAccess} onClose={() => setDetail(null)} onEdit={() => setModal({ module: detail.module, row: detail.row })} />}
    {commandOpen && <Modal title="البحث السريع" onClose={() => setCommandOpen(false)}><div className="command-search"><Search size={18} /><input autoFocus placeholder="ابحث عن مركبة، سائق، عميل أو إجراء..." /></div><div className="command-list"><button onClick={() => { onNavigate("vehicles"); setCommandOpen(false); }}><CarFront size={16} /><span>الانتقال إلى المركبات</span><kbd>↵</kbd></button><button onClick={() => { onNavigate("maintenance"); setCommandOpen(false); }}><Wrench size={16} /><span>فتح طلب صيانة جديد</span><kbd>↵</kbd></button><button onClick={() => { onNavigate("documents"); setCommandOpen(false); }}><FileText size={16} /><span>عرض المستندات المنتهية</span><kbd>↵</kbd></button></div></Modal>}
  </div>;
}
