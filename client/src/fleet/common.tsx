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
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Printer,
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
  ZoomIn,
  ZoomOut,
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
  "سليم": "green", "ممتاز": "green", "ناقص": "red", "يحتاج تغيير": "red", "يحتاج هواء": "amber", "متضرر": "red", "تمت المراجعة": "green", "تم تحويله للصيانة": "red", "سائق": "blue", "موظف": "purple",
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

export function Badge({
  children,
  variant,
  tone,
}: {
  children: string;
  variant?: "bad" | "warn" | "neutral" | "ok" | string;
  tone?: string;
}) {
  const resolvedTone =
    tone ||
    (variant === "bad"
      ? "red"
      : variant === "warn"
      ? "amber"
      : variant === "neutral"
      ? "blue"
      : variant === "ok"
      ? "green"
      : undefined) ||
    statusTone[children] ||
    "gray";
  return <span className={`status-badge ${resolvedTone}`}><i />{children}</span>;
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-mark ${compact ? "compact" : ""}`}><span className="brand-monogram">ث</span>{!compact && <span><strong>شركة ثقة التوصيل</strong><small>FLEET</small></span>}</div>;
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

export function createExcelTabBlob(headers: (string | unknown)[], rows: (string | unknown)[][]): Blob {
  const content = [
    headers.map(h => String(h ?? "").replace(/[\t\r\n]/g, " ")).join("\t"),
    ...rows.map(row => row.map(v => String(v ?? "").replace(/[\t\r\n]/g, " ")).join("\t")),
  ].join("\r\n");

  const buffer = new ArrayBuffer((content.length + 1) * 2);
  const view = new Uint16Array(buffer);
  view[0] = 0xFEFF; // UTF-16LE BOM (0xFF, 0xFE in little-endian)
  for (let i = 0; i < content.length; i++) {
    view[i + 1] = content.charCodeAt(i);
  }

  return new Blob([buffer], { type: "text/tab-separated-values;charset=utf-16le;" });
}

export function exportCsv(rows: Row[], columns: string[], filename: string, headers: string[] = columns) {
  const dataRows = rows.map(row => columns.map(column => row[column]));
  const blob = createExcelTabBlob(headers, dataRows);
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

export function decodeFileBuffer(buffer: ArrayBuffer): string {
  const u8 = new Uint8Array(buffer);
  if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("windows-1256").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

export function getFlexibleFieldValue(raw: Record<string, string>, header: string, key?: string): string {
  if (raw[header] !== undefined && raw[header].trim() !== "") return raw[header].trim();

  // Normalize (ignore spaces, quotes, and punctuation)
  const cleanHeader = (s: string) => s.replace(/[\s\-_/\\()[\]:;.,،ـ"'`]/g, "").toLowerCase();
  const normTarget = cleanHeader(header);
  for (const [k, v] of Object.entries(raw)) {
    if (cleanHeader(k) === normTarget && v && v.trim() !== "") return v.trim();
  }

  if (key === "name" || header.includes("الاسم") || header.includes("اسم")) {
    for (const [k, v] of Object.entries(raw)) {
      if ((k.includes("الاسم") || k === "name" || k === "اسم" || k.includes("الموظف") || k.includes("الكادر") || k.includes("السائق")) && v && v.trim() !== "") {
        return v.trim();
      }
    }
  }

  if (key === "nationalId" || header.includes("الهوية") || header.includes("الإقامة")) {
    for (const [k, v] of Object.entries(raw)) {
      if ((k.includes("هوية") || k.includes("إقامة") || k.includes("اقامة") || k === "idNo" || k === "iqama" || k === "nationalId") && v && v.trim() !== "") {
        return v.trim();
      }
    }
  }

  return "";
}

export function parseCsv(text: string): Record<string, string>[] {
  let cleanText = text.replace(/^\ufeff/, "");
  let lines = cleanText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length > 0 && lines[0].toLowerCase().startsWith("sep=")) {
    lines = lines.slice(1);
  }
  if (lines.length < 2) return [];

  const tabCount = (lines[0].match(/\t/g) || []).length;
  const semiCount = (lines[0].match(/;/g) || []).length;
  const commaCount = (lines[0].match(/,/g) || []).length;

  let sep = ",";
  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) {
    sep = "\t";
  } else if (semiCount >= commaCount && semiCount > 0) {
    sep = ";";
  } else {
    sep = ",";
  }

  const splitLine = (line: string): string[] => {
    if (sep === "\t") {
      return line.split("\t").map(v => v.replace(/^["']|["']$/g, "").replace(/^=/, "").replace(/^["']|["']$/g, "").trim());
    }
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === sep && !inQuotes) {
        result.push(current.replace(/^["']|["']$/g, "").replace(/^=/, "").replace(/^["']|["']$/g, "").trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.replace(/^["']|["']$/g, "").replace(/^=/, "").replace(/^["']|["']$/g, "").trim());
    return result;
  };

  const headers = splitLine(lines[0]).map(h => h.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim());

  return lines.slice(1).map(line => {
    const values = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
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

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
  extra,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        {secondaryAction && onSecondaryAction && (
          <button
            type="button"
            className="btn outline"
            onClick={onSecondaryAction}
            style={{
              background: "white",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 0.95rem",
              borderRadius: "8px",
              fontWeight: 600,
            }}
          >
            <Upload size={16} />
            <span>{secondaryAction}</span>
          </button>
        )}
        {action && onAction && (
          <button className="btn primary" type="button" onClick={onAction}>
            <Plus size={17} />{action}
          </button>
        )}
        {extra}
      </div>
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

export function toInputDate(val: any): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (!s || s === "—" || s === "-" || s === "null" || s === "undefined") return "";
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const timestamp = Number(s);
  const parsed = !isNaN(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

export function Field({ label, value, onChange, placeholder, type = "text", disabled = false, maxLength, inputMode }: { label: string; value?: any; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; maxLength?: number; inputMode?: "numeric" | "text" }) {
  const displayVal = type === "date" ? toInputDate(value) : (value ?? "");
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={displayVal}
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
  onImport,
  importLabel = "استيراد من إكسل",
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
  onImport?: () => void;
  importLabel?: string;
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
          {onImport && (
            <button className="btn outline" type="button" onClick={onImport}>
              <Upload size={15} />{importLabel}
            </button>
          )}
          <button className="btn outline" type="button" onClick={onExport}><Download size={15} />تصدير إلى إكسل</button>
          <button className="btn primary" type="button" onClick={onAdd}><Plus size={16} />{addLabel}</button>
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

export function DocumentPreviewModal({
  title,
  fileUrl,
  fileName,
  type,
  entity,
  status,
  onClose,
}: {
  title: string;
  fileUrl: string;
  fileName?: string;
  type?: string;
  entity?: string;
  status?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const cleanUrl = (fileUrl || "").trim();
  const displayName = fileName || title || "مستند";
  const isImage =
    /\.(png|jpe?g|webp|gif|svg|bmp)(\?.*)?$/i.test(displayName) ||
    cleanUrl.startsWith("data:image/");
  const isPdf =
    /\.pdf(\?.*)?$/i.test(displayName) ||
    cleanUrl.startsWith("data:application/pdf");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = cleanUrl;
    link.download = displayName;
    link.click();
  };

  const handleOpenExternal = () => {
    const win = window.open();
    if (win) {
      win.opener = null;
      if (isPdf) {
        win.document.write(
          `<title>${displayName}</title><iframe src="${cleanUrl}" frameborder="0" style="border:0; width:100vw; height:100vh;" allowfullscreen></iframe>`
        );
      } else if (isImage) {
        win.document.write(
          `<title>${displayName}</title><body style="margin:0; background:#0f172a; display:flex; align-items:center; justify-content:center; min-height:100vh;"><img src="${cleanUrl}" style="max-width:98%; max-height:98vh; object-fit:contain;" /></body>`
        );
      } else {
        win.location.href = cleanUrl;
      }
    } else {
      window.location.assign(cleanUrl);
    }
  };

  const handlePrint = () => {
    if (isPdf || isImage) {
      const printWin = window.open();
      if (printWin) {
        printWin.opener = null;
        printWin.document.write(
          `<title>${displayName}</title><body style="margin:0;"><img src="${cleanUrl}" style="max-width:100%;" onload="window.print(); window.close();" /></body>`
        );
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="preview-modal-head">
          <div className="preview-modal-title">
            <span className="file-icon">
              <FileText size={18} />
            </span>
            <div>
              <strong>{displayName}</strong>
              <small style={{ color: "var(--muted)", display: "block" }}>
                {type ? `${type} · ` : ""}
                {entity ? `مرتبط بـ: ${entity}` : ""}
              </small>
            </div>
            {status && <Badge>{status}</Badge>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={19} />
          </button>
        </div>

        <div className="preview-modal-toolbar">
          <div className="preview-toolbar-group">
            {isImage && (
              <>
                <button
                  className="preview-toolbar-btn"
                  title="تصغير"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  <ZoomOut size={15} />
                  <span>تصغير</span>
                </button>
                <button
                  className="preview-toolbar-btn"
                  title="إعادة ضبط الحجم"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                >
                  <span>{Math.round(zoom * 100)}%</span>
                </button>
                <button
                  className="preview-toolbar-btn"
                  title="تكبير"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  <ZoomIn size={15} />
                  <span>تكبير</span>
                </button>
              </>
            )}
            <button
              className="preview-toolbar-btn"
              title="طباعة"
              onClick={handlePrint}
            >
              <Printer size={15} />
              <span>طباعة</span>
            </button>
            <button
              className="preview-toolbar-btn"
              title="فتح في نافذة كاملة"
              onClick={handleOpenExternal}
            >
              <ExternalLink size={15} />
              <span>نافذة كاملة</span>
            </button>
          </div>

          <div className="preview-toolbar-group">
            <button
              className="preview-toolbar-btn primary"
              title="تحميل المستند"
              onClick={handleDownload}
            >
              <Download size={15} />
              <span>تحميل المستند</span>
            </button>
          </div>
        </div>

        <div className={`preview-content-area ${!isImage ? "light-bg" : ""}`}>
          {isImage ? (
            <img
              src={cleanUrl}
              alt={displayName}
              className="preview-image-element"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          ) : isPdf ? (
            <iframe
              src={cleanUrl}
              title={displayName}
              className="preview-iframe-element"
            />
          ) : (
            <div className="preview-fallback-card">
              <span className="file-icon" style={{ width: 56, height: 56 }}>
                <FileText size={30} />
              </span>
              <strong style={{ fontSize: 16 }}>{displayName}</strong>
              <p style={{ color: "var(--muted)", fontSize: 12 }}>
                هذا النوع من الملفات جاهز للتحميل والفتح المباشر بأمان.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn primary" onClick={handleDownload}>
                  <Download size={16} /> تحميل الملف
                </button>
                <button className="btn outline" onClick={handleOpenExternal}>
                  <ExternalLink size={16} /> فتح خارجي
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentFileActions({
  file,
  showLabels = false,
}: {
  file: Document;
  showLabels?: boolean;
}) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(file.fileUrl || null);

  if (!file.hasFile && !file.fileUrl) return null;

  const handlePreview = async () => {
    if (previewUrl) {
      setPreviewActive(true);
      return;
    }
    setLoading(true);
    try {
      const attachment = await utils.documents.file.fetch({ id: file.id });
      if (!attachment?.url) throw new Error("لم يتم العثور على ملف المستند");
      setPreviewUrl(attachment.url);
      setPreviewActive(true);
    } catch (error: any) {
      toast.error(error.message || "تعذر تحميل معاينة المستند");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url =
        file.fileUrl || (await utils.documents.file.fetch({ id: file.id }))?.url;
      if (!url) throw new Error("لم يتم العثور على رابط الملف");
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName || file.name || "document";
      link.click();
    } catch (error: any) {
      toast.error(error.message || "تعذر تحميل المستند");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="row-actions">
        <button
          className="row-menu-btn"
          title="معاينة المستند داخل النظام"
          aria-label={`معاينة ${file.name}`}
          disabled={loading}
          onClick={() => void handlePreview()}
        >
          <Eye size={16} />
          {showLabels && <span>معاينة</span>}
        </button>
        <button
          className="row-menu-btn"
          title="تحميل المستند"
          aria-label={`تحميل ${file.name}`}
          disabled={loading}
          onClick={() => void handleDownload()}
        >
          <Download size={16} />
          {showLabels && <span>تحميل</span>}
        </button>
      </div>

      {previewActive && previewUrl && (
        <DocumentPreviewModal
          title={file.name}
          fileName={file.fileName || undefined}
          fileUrl={previewUrl}
          type={file.type}
          entity={file.entity}
          status={file.status}
          onClose={() => setPreviewActive(false)}
        />
      )}
    </>
  );
}

export function LinkedDocumentsSection({
  entityType,
  entityId,
  entityName,
  canViewDocuments,
  canUpload = true,
}: {
  entityType: string;
  entityId: number;
  entityName?: string;
  canViewDocuments: boolean;
  canUpload?: boolean;
}) {
  const utils = trpc.useUtils();
  const query = trpc.documents.list.useQuery(undefined, {
    staleTime: 0,
    enabled: canViewDocuments,
  });
  const createDocument = trpc.documents.create.useMutation();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const linked = ((query.data as Document[] | undefined) ?? []).filter((document) =>
    isLinkedDocument(document, entityType, entityId)
  );

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("يرجى اختيار ملف لرفعه");
      return;
    }
    setUploading(true);
    try {
      const fileUrl = await readUploadDataUrl(selectedFile);
      await createDocument.mutateAsync({
        name: uploadName.trim() || selectedFile.name,
        entity: entityName || `${entityType} #${entityId}`,
        entityType: entityType as any,
        entityId,
        type: uploadType.trim() || "مستند",
        expiry: uploadExpiry.trim() || undefined,
        status: "ساري",
        fileName: selectedFile.name,
        fileUrl,
      });
      void utils.documents.list.invalidate();
      toast.success("تم رفع وإرفاق المستند بنجاح");
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadName("");
      setUploadType("");
      setUploadExpiry("");
    } catch (error: any) {
      toast.error(error.message || "تعذر رفع المستند");
    } finally {
      setUploading(false);
    }
  };

  const quickTypePresets: Record<string, string[]> = {
    مركبة: ["استمارة مركبة", "فحص دوري", "وثيقة تأمين", "كرت تشغيل", "عقد صيانة", "أخرى"],
    سائق: ["رخصة قيادة", "هوية / إقامة", "عقد عمل", "فحص طبي", "كرت تشغيل", "شهادة تدريب", "أخرى"],
    موظف: ["هوية / إقامة", "عقد عمل", "مؤهل علمي", "فحص طبي", "شهادة خبرة", "أخرى"],
    حادث: ["تقرير نجم", "تقرير المرور", "تقدير الورشة", "مطالبة تأمين", "سند تسوية", "صور أضرار", "أخرى"],
    عقد: ["نسخة العقد الموقعة", "ملحق عقد", "أمر شراء عميل", "محضر تسليم", "أخرى"],
    عميل: ["سجل تجاري", "شهادة ضريبية", "عقد اتفاق", "هوية مفوض", "أخرى"],
    مشروع: ["وثيقة ترسية", "عقد مشروع", "محضر تسليم موقع", "أخرى"],
    صيانة: ["عرض سعر ورشة", "فاتورة صيانة", "تقرير فحص فني", "أخرى"],
    مطالبة: ["نموذج مطالبة", "فاتورة مطالبة", "تقرير حادث", "إشعار تحويل", "أخرى"],
    "قيد يومية": ["سند قيد", "فاتورة مؤيدة", "إشعار بنكي", "إيصال سداد", "مستند تسوية", "أخرى"],
  };
  const presets = quickTypePresets[entityType] ?? ["وثيقة رسمية", "فاتورة", "إيصال", "عقد", "أخرى"];

  return (
    <section className="surface" style={{ padding: "1.25rem", marginTop: "1rem" }}>
      <div className="section-head" style={{ alignItems: "center", marginBottom: ".75rem" }}>
        <div>
          <h3 style={{ fontSize: 14 }}>المستندات والمرفقات المرتبطة</h3>
          <span>
            {canViewDocuments
              ? `${linked.length} مستند مسجل لهذا السجل`
              : "يلزم إذن المستندات لعرض المرفقات"}
          </span>
        </div>
        {canViewDocuments && canUpload && (
          <button
            type="button"
            className="btn outline"
            onClick={() => setShowUploadModal(true)}
            style={{ height: 32, fontSize: 12, padding: "0 10px" }}
          >
            <Plus size={15} /> إرفاق مستند جديد
          </button>
        )}
      </div>

      {!canViewDocuments ? (
        <div className="field-note" role="status">
          يلزم منح صلاحية «المستندات» لعرض المرفقات.
        </div>
      ) : linked.length ? (
        <div className="compact-list">
          {linked.map((document) => (
            <div className="compact-row" key={document.id}>
              <div className="compact-main">
                <strong style={{ fontSize: 12 }}>{document.name}</strong>
                <small>
                  {document.type}
                  {document.expiry && document.expiry !== "—" ? ` · ينتهي ${document.expiry}` : ""}
                  {document.fileName ? ` · ${document.fileName}` : ""}
                </small>
              </div>
              <Badge>{document.status}</Badge>
              <DocumentFileActions file={document} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ padding: "1.25rem" }}>
          لا توجد مستندات مرتبطة بهذا السجل حتى الآن.
        </div>
      )}

      {showUploadModal && (
        <Modal
          title={`إرفاق مستند جديد · ${entityName || `${entityType} #${entityId}`}`}
          onClose={() => setShowUploadModal(false)}
        >
          <form onSubmit={handleUploadSubmit}>
            <div className="form-grid single">
              <Field
                label="اسم / عنوان المستند"
                value={uploadName}
                onChange={setUploadName}
                placeholder="مثال: استمارة المركبة، تقرير ورشة، رخصة القيادة..."
              />
              <Field
                label="نوع وتصنيف المستند"
                value={uploadType}
                onChange={setUploadType}
                placeholder="اختر من التصنيفات السريعة أدناه أو اكتب تصنيفًا..."
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem", marginBottom: ".5rem" }}>
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn outline ${uploadType === preset ? "primary" : ""}`}
                    style={{ height: 26, padding: "0 8px", fontSize: 11, borderRadius: 4 }}
                    onClick={() => {
                      setUploadType(preset);
                      if (!uploadName || presets.includes(uploadName.split(" - ")[0])) {
                        setUploadName(`${preset} - ${entityName || `${entityType} #${entityId}`}`);
                      }
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Field
                label="تاريخ الانتهاء (إن وجد)"
                type="date"
                value={uploadExpiry}
                onChange={setUploadExpiry}
              />
              <label className="field">
                <span>الملف المرفق *</span>
                <input
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    if (file && !uploadName) setUploadName(file.name);
                  }}
                />
              </label>
              {selectedFile && (
                <div className="field-note">الملف المختار: {selectedFile.name}</div>
              )}
            </div>
            <FormActions
              onCancel={() => setShowUploadModal(false)}
              label={uploading ? "جارٍ الرفع..." : "حفظ وربط المستند"}
            />
          </form>
        </Modal>
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

export function ImportModal({ config, onClose, onImport }: { config: ImportConfig; onClose: () => void; onImport: (rows: Record<string, any>[]) => Promise<string | void> }) {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const buffer = ev.target?.result as ArrayBuffer;
      const text = decodeFileBuffer(buffer);
      const parsed = parseCsv(text);
      const errs: string[] = [];
      const mapped = parsed.map((raw, i) => {
        const mappedRow = config.mapRow(raw);
        config.columns.filter(c => c.required).forEach(c => {
          const rawVal = getFlexibleFieldValue(raw, c.header, c.key);
          const mappedVal = mappedRow[c.key];
          const val = (mappedVal && String(mappedVal).trim() !== "—" && String(mappedVal).trim() !== "")
            ? mappedVal
            : rawVal;
          if (!val || String(val).trim() === "") {
            errs.push(`سطر ${i + 2}: حقل «${c.header}» مطلوب`);
          }
        });
        return mappedRow;
      });
      setErrors(errs);
      setRows(mapped);
      setDone(0);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const downloadSample = () => {
    const headers = config.columns.map(c => c.header);
    const examples = config.columns.map(c => c.hint ?? "");
    const blob = createExcelTabBlob(headers, [examples]);
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
      const resultMessage = await onImport(rows);
      setDone(rows.length);
      if (typeof resultMessage === "string" && resultMessage) {
        toast.success(resultMessage);
      } else {
        toast.success(`تم استيراد ${rows.length} سجل بنجاح`);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "تعذر استيراد البيانات");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal title={`استيراد ${config.label} من ملف إكسل / CSV`} onClose={onClose} wide>
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
            <Download size={15} /> تحميل نموذج إكسل / CSV فارغ
          </button>
          <label className="btn primary" style={{ cursor: "pointer" }}>
            <Upload size={15} /> اختيار ملف إكسل / CSV
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
