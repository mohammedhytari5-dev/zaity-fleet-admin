import React, { Children, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { serializeCsv } from "@/lib/csv";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import { isLinkedDocument } from "@/lib/documentRelations";
import { nextMaintenanceStages, type MaintenanceStage } from "@shared/maintenance-domain";
import { isOptionalFixedLengthIdentity, normalizeIdentityNumber, normalizeNumericInput } from "@shared/identity-number";
import { formatCompanyDate } from "@shared/date-utils";
import type { TaskRelatedEntityType } from "@shared/task-relations";
import {
  Activity,
  Archive,
  ArrowDownLeft,
  ArrowUpLeft,
  Bell,
  BookOpen,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  Trash,
  Truck,
  Upload,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import type {
  ModuleKey,
  Row,
  Vehicle,
  Driver,
  Client,
  Maintenance,
  Document,
  Contract,
  Claim,
  ImportConfig,
} from "./types";

export const statusTone: Record<string, string> = {
  "متاحة": "green", "متاح": "green", "ساري": "green", "مكتمل": "green", "مغلق": "green", "معتمد": "green", "نشط": "green", "قائم": "green", "مدفوعة": "green", "مدفوعة جزئيًا": "amber", "معتمدة": "blue", "بانتظار الاعتماد": "amber", "مخطط": "blue", "تم اعتمادها": "blue", "تم صرفها": "green",
  "مؤجرة": "blue", "مشغولة": "blue", "طارئ": "red", "عاجل": "red", "متوسط": "amber", "عادي": "gray", "جاري العمل": "amber", "قريبًا": "amber", "مستحقة": "amber", "جديد": "amber", "جديدة": "amber", "غير مرفوعة": "gray", "تحت الإجراء": "amber", "قيد التجهيز": "amber", "إجازة": "amber", "منتهي الخدمة": "gray",
  "في الصيانة": "red", "متوقفة": "red", "موقوف": "red", "متأخر": "red", "متأخرة": "red", "مرفوضة": "red", "مرفوض": "red", "متوقف": "red", "متأخر 2 يوم": "red", "ملغاة": "gray",
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

export const navGroups: { label: string; items: { key: ModuleKey; label: string; icon: any; count?: string }[] }[] = [
  { label: "نظرة عامة", items: [{ key: "dashboard", label: "الإحصائيات", icon: LayoutDashboard }] },
  { label: "التشغيل", items: [
    { key: "vehicles", label: "المركبات", icon: CarFront },
    { key: "projects", label: "المشاريع", icon: Truck },
    { key: "maintenance", label: "الصيانة", icon: Wrench },
    { key: "accidents", label: "الحوادث", icon: ShieldAlert },
    { key: "inventory", label: "المخزون وقطع الغيار", icon: Package },
    { key: "procurement", label: "المشتريات وعروض الأسعار", icon: ShoppingCart },
    { key: "documents", label: "المستندات", icon: FileCheck2 },
    { key: "drivers", label: "السائقون", icon: UserRound },
    { key: "employees", label: "الموظفون", icon: UsersRound },
    { key: "clients", label: "العملاء", icon: UsersRound },
  ] },
  { label: "المالية", items: [
    { key: "finance", label: "المالية", icon: CircleDollarSign },
    { key: "accounting", label: "المحاسبة ودفتر الأستاذ", icon: FileText },
    { key: "invoices", label: "الفوترة والضريبة (ZATCA)", icon: Receipt },
    { key: "payables", label: "المستحقات علينا", icon: ArrowUpLeft },
  ] },
  { label: "الإدارة", items: [{ key: "reports", label: "التقارير", icon: Activity }] },
  { label: "النظام", items: [{ key: "settings", label: "الإعدادات", icon: Settings2 }] },
];

export function Badge({ children }: { children: string }) {
  return <span className={`status-badge ${statusTone[children] || "gray"}`}><i />{children}</span>;
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-mark ${compact ? "compact" : ""}`}><span className="brand-monogram">هـ</span>{!compact && <span><strong>الهتاري</strong><small>PLUS</small></span>}</div>;
}

export function formatSAR(value: number) {
  return `${value.toLocaleString("en-US")} SAR`;
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatCurrencyText(value: unknown) {
  return String(value ?? "0 SAR").replace(/ر\.س/g, "SAR");
}

export function exportCsv(rows: Row[], columns: string[], filename: string, headers: string[] = columns) {
  const csv = serializeCsv(headers, rows.map(row => columns.map(column => row[column])));
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  toast.success("تم تجهيز ملف التصدير بنجاح");
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.replace(/^["']|["']$/g, "").trim());
  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.replace(/^["']|["']$/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export function MetricCard({ title, value, helper, icon: Icon, tone, trend }: { title: string; value: string; helper: string; icon: any; tone: string; trend?: string }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={19} /></div>
      <div className="metric-content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small className={trend?.startsWith("+") ? "trend-up" : ""}>{trend || helper}</small>
      </div>
      <span className="metric-helper">{helper}</span>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="btn primary" onClick={onAction}>
          <Plus size={17} />{action}
        </button>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            <p>أدخل البيانات المطلوبة ثم احفظ التغييرات</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text", disabled = false, maxLength, inputMode }: { label: string; value?: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; maxLength?: number; inputMode?: "numeric" | "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        inputMode={inputMode}
      />
    </label>
  );
}

export function FormActions({ onCancel, label = "حفظ التغييرات" }: { onCancel: () => void; label?: string }) {
  return (
    <div className="form-actions">
      <button className="btn primary" type="submit"><Check size={16} />{label}</button>
      <button className="btn ghost" type="button" onClick={onCancel}>إلغاء</button>
    </div>
  );
}

export function TableShell({
  children,
  columns,
  onExport,
  search,
  setSearch,
  filter,
  setFilter,
  tabs,
  activeTab,
  setActiveTab,
  addLabel,
  onAdd,
}: {
  children: React.ReactNode;
  columns: string[];
  onExport: () => void;
  search: string;
  setSearch: (s: string) => void;
  filter?: string;
  setFilter?: (s: string) => void;
  tabs: string[];
  activeTab: string;
  setActiveTab: (s: string) => void;
  addLabel: string;
  onAdd: () => void;
}) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const rows = Children.toArray(children);
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="table-card">
      <div className="table-tabs">
        {tabs.map(tab => (
          <button
            className={activeTab === tab ? "active" : ""}
            key={tab}
            onClick={() => { setPage(1); setActiveTab(tab); }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value); }}
            placeholder="ابحث في السجلات..."
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="toolbar-actions">
          {setFilter && (
            <button className="btn outline" onClick={() => setFilter(filter === "all" ? "active" : "all")}>
              <Filter size={15} />{filter === "active" ? "تصفية مفعّلة" : "فلاتر"}
            </button>
          )}
          <button className="btn outline" onClick={onExport}><Download size={15} />تصدير</button>
          <button className="btn primary" onClick={onAdd}><Plus size={16} />{addLabel}</button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map(c => <th key={c}>{c}</th>)}
              <th className="actions-head">إجراءات</th>
            </tr>
          </thead>
          <tbody>{visibleRows}</tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>صفحة {currentPage} من {pageCount} · {rows.length} سجل</span>
        <div className="rows-select">
          صفوف لكل صفحة{" "}
          <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="pagination">
          <button aria-label="السابق" disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            <ChevronRight size={15} />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => (
            <button
              key={pageNumber}
              className={currentPage === pageNumber ? "current" : ""}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button aria-label="التالي" disabled={currentPage === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentFileActions({ file }: { file: Document }) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);
  if (!file.hasFile && !file.fileUrl) return null;
  const retrieve = async (mode: "preview" | "download") => {
    const previewTab = mode === "preview" ? window.open("about:blank", "_blank") : null;
    if (previewTab) previewTab.opener = null;
    setLoading(true);
    try {
      const attachment = file.fileUrl
        ? { name: file.fileName || file.name, url: file.fileUrl }
        : await utils.documents.file.fetch({ id: file.id });
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
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="row-actions">
      <button className="row-menu-btn" title="تحميل المستند" aria-label={`تحميل ${file.name}`} disabled={loading} onClick={() => void retrieve("download")}>
        <Download size={16} />
      </button>
      <button className="row-menu-btn" title="معاينة المستند" aria-label={`معاينة ${file.name}`} disabled={loading} onClick={() => void retrieve("preview")}>
        <BookOpen size={16} />
      </button>
    </div>
  );
}

export function LinkedDocumentsSection({ entityType, entityId, canViewDocuments }: { entityType: string; entityId: number; canViewDocuments: boolean }) {
  const query = trpc.documents.list.useQuery(undefined, { staleTime: 0, enabled: canViewDocuments });
  const linked = ((query.data as Document[] | undefined) ?? []).filter(document => isLinkedDocument(document, entityType, entityId));
  return (
    <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
      <div className="section-head">
        <div>
          <h3>المستندات المرتبطة</h3>
          <span>{canViewDocuments ? `${linked.length} مستند` : "يلزم إذن المستندات لعرض المرفقات"}</span>
        </div>
      </div>
      {!canViewDocuments ? (
        <div className="field-note" role="status">يلزم منح صلاحية «المستندات» لعرض المرفقات.</div>
      ) : linked.length ? (
        <div className="compact-list">
          {linked.map(document => (
            <div className="compact-row" key={document.id}>
              <div className="compact-main">
                <strong>{document.name}</strong>
                <small>{document.type} · ينتهي {document.expiry}</small>
              </div>
              <Badge>{document.status}</Badge>
              <DocumentFileActions file={document} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: "1.25rem" }}>لا توجد مستندات مرتبطة بهذا السجل.</div>
      )}
    </section>
  );
}

export function ContextMenu({ row, module, onAction, onClose, canApprove = false }: { row: Row; module: ModuleKey; onAction: (action: string) => void; onClose: () => void; canApprove?: boolean }) {
  const isClaimRecord = module === "finance" && String(row.ref || "").startsWith("CL-");
  const maintenanceActions: [string, string][] = [["عرض التفاصيل", "view"], ["تعديل الطلب", "edit"]];
  const stage = row.workflowStage as MaintenanceStage | undefined;
  if (stage && nextMaintenanceStages(stage).length) maintenanceActions.push(["تقدم في دورة الصيانة", "stage"]);
  if (stage === "اعتماد" && row.approvalStatus === "بانتظار الاعتماد" && canApprove) maintenanceActions.push(["اعتماد / رفض التكلفة", "approval"]);
  if (row.fundingType === "عهدة" && row.advanceStatus === "مفتوحة" && canApprove) maintenanceActions.push(["تسوية العهدة", "settle-advance"]);
  if (stage === "مغلق" || stage === "مرفوض") maintenanceActions.push(["أرشفة الطلب", "archive"]);

  const actions: [string, string][] =
    module === "vehicles"
      ? [["عرض التفاصيل", "view"], ["تعديل المركبة", "edit"], ["إضافة إلى الصيانة", "maintenance"], ["إسناد سائق", "assign"], ["أرشفة المركبة", "archive"]]
      : module === "maintenance"
      ? maintenanceActions
      : module === "documents"
      ? [["معاينة المستند", "view"], ["تحميل الملف", "download"], ["تعديل البيانات", "edit"], ["تمديد تاريخ الانتهاء", "extend"], ["أرشفة المستند", "archive"]]
      : module === "drivers"
      ? [["عرض الملف الشخصي", "view"], ["تعديل البيانات", "edit"], ["إسناد مركبة", "assign"], ["تغيير الحالة", "status"], ["أرشفة السائق", "archive"]]
      : module === "clients"
      ? [["عرض تفاصيل العميل", "view"], ["تعديل العميل", "edit"], ["عرض العقود", "contracts"], ["عرض المطالبات المالية", "claims"], ["إنشاء عقد جديد", "new-contract"]]
      : module === "finance" && isClaimRecord
      ? [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["أرشفة المطالبة", "archive"]]
      : module === "finance"
      ? [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["إصدار فاتورة ضريبية", "create-invoice"], ["تغيير الحالة", "status"], ["تصدير السجل", "download"]]
      : [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["تغيير الحالة", "status"], ["تصدير السجل", "download"]];

  return (
    <div className="context-menu" onMouseLeave={onClose}>
      {actions.map(([label, action], index) => (
        <button
          key={action}
          className={index === actions.length - 1 && action === "archive" ? "danger" : ""}
          onClick={() => onAction(action)}
        >
          <span>
            {action === "view" ? (
              <BookOpen size={15} />
            ) : action === "edit" ? (
              <Pencil size={15} />
            ) : action === "archive" ? (
              <Archive size={15} />
            ) : action === "download" ? (
              <Download size={15} />
            ) : action === "maintenance" ? (
              <Wrench size={15} />
            ) : action === "assign" ? (
              <UserRound size={15} />
            ) : action === "create-invoice" ? (
              <Receipt size={15} />
            ) : (
              <SlidersHorizontal size={15} />
            )}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

export function ImportModal({ config, onClose, onImport }: { config: ImportConfig; onClose: () => void; onImport: (rows: Record<string, any>[]) => Promise<void> }) {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      const errs: string[] = [];
      const mapped = parsed.map((raw, i) => {
        config.columns.filter(c => c.required).forEach(c => {
          const val = raw[c.header]?.trim();
          if (!val) errs.push(`سطر ${i + 2}: حقل «${c.header}» مطلوب`);
        });
        return config.mapRow(raw);
      });
      setErrors(errs);
      setRows(mapped);
      setDone(0);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const downloadSample = () => {
    const header = config.columns.map(c => c.header).join(",");
    const example = config.columns.map(c => c.hint ?? "").join(",");
    const csv = "\ufeff" + header + "\n" + example;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = config.sampleFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startImport = async () => {
    if (!rows?.length || errors.length) return;
    setImporting(true);
    try {
      await onImport(rows);
      setDone(rows.length);
      toast.success(`تم استيراد ${rows.length} سجل بنجاح`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "تعذر استيراد البيانات");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal title={`استيراد ${config.label} من ملف CSV`} onClose={onClose} wide>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div className="field-note">
          حمّل ملف CSV أو Excel المُصدَّر كـ CSV (فصل بفاصلة أو فاصلة منقوطة). يجب أن يحتوي الملف على الأعمدة التالية:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {config.columns.map(c => (
            <span key={c.key} style={{ padding: ".2rem .65rem", background: "var(--muted)", borderRadius: ".4rem", fontSize: ".8rem" }}>
              {c.header}{c.required ? " *" : ""}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <button className="btn outline" onClick={downloadSample}>
            <Download size={15} /> تحميل نموذج CSV فارغ
          </button>
          <label className="btn primary" style={{ cursor: "pointer" }}>
            <Upload size={15} /> اختر ملف CSV
            <input type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFile} />
          </label>
        </div>
        {rows && (
          <div className="surface" style={{ padding: "1rem" }}>
            <div className="section-head" style={{ marginBottom: ".5rem" }}>
              <div>
                <h3>{rows.length} سجل جاهز للاستيراد</h3>
                {errors.length > 0 && <span style={{ color: "var(--red)" }}>{errors.length} تحذير — راجع الأخطاء أدناه</span>}
              </div>
            </div>
            {errors.length > 0 && (
              <div style={{ maxHeight: "120px", overflowY: "auto", fontSize: ".82rem", color: "var(--red)", marginBottom: ".75rem" }}>
                {errors.slice(0, 20).map((e, i) => <div key={i}>{e}</div>)}
                {errors.length > 20 && <div>…و{errors.length - 20} تحذير آخر</div>}
              </div>
            )}
            <div className="table-scroll" style={{ maxHeight: "200px" }}>
              <table>
                <thead>
                  <tr>{config.columns.map(c => <th key={c.key}>{c.header}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>{config.columns.map(c => <td key={c.key}>{String(row[c.key] ?? "—")}</td>)}</tr>
                  ))}
                  {rows.length > 5 && <tr><td colSpan={config.columns.length} style={{ textAlign: "center", color: "var(--muted-fg)" }}>…{rows.length - 5} صف إضافي</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="form-actions">
          <button className="btn primary" disabled={!rows?.length || importing || done > 0} onClick={() => void startImport()}>
            {importing ? "جارٍ الاستيراد…" : `استيراد ${rows?.length ?? 0} سجل`}
          </button>
          <button className="btn ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

export function Chart({ maintenance, range }: { maintenance: Maintenance[]; range: "month" | "quarter" | "year" }) {
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
  return (
    <div className="chart-wrap">
      <div className="chart-y">
        <span>{max}</span>
        <span>{Math.round(max * .75)}</span>
        <span>{Math.round(max * .5)}</span>
        <span>{Math.round(max * .25)}</span>
        <span>٠</span>
      </div>
      <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="chart-svg" role="img" aria-label="توزيع طلبات الصيانة حسب المرحلة خلال الفترة المحددة">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a9814d" stopOpacity=".18" />
            <stop offset="1" stopColor="#a9814d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[28, 58, 88, 118, 148].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#e9eeec" strokeWidth="1" />)}
        {counts.map((count, i) => {
          const x = 50 + i * 100;
          const y = 148 - (count / max) * 120;
          return (
            <g key={labels[i]}>
              <rect x={x - 19} y={y} width="38" height={148 - y} rx="8" fill="#a9814d" opacity=".82" />
              <text x={x} y={Math.max(16, y - 8)} textAnchor="middle" fill="#25364c" fontSize="12">{count}</text>
            </g>
          );
        })}
      </svg>
      <div className="chart-x">{labels.map(label => <span key={label}>{label}</span>)}</div>
      <div className="field-note" style={{ marginTop: "1rem" }}>
        طلبات بدأت ضمن الفترة المحددة · {rangeMaintenance.length.toLocaleString("en-US")} طلب
      </div>
    </div>
  );
}
