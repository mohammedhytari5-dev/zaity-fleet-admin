import { Children, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";

type ModuleKey = "dashboard" | "vehicles" | "maintenance" | "documents" | "drivers" | "clients" | "finance" | "settings";
type Row = Record<string, any> & { id: number };

type Vehicle = Row & { plate: string; brand: string; model: string; year: string; color: string; mileage: string; driver: string; status: string; client: string; contract: string };
type Driver = Row & { name: string; phone: string; idNo: string; status: string; vehicle: string; license: string; renewal: string };
type Client = Row & { name: string; location: string; vat: string; commercial: string; contact: string; phone: string; contracts: number };
type Maintenance = Row & { ref: string; vehicle: string; type: string; manager: string; start: string; due: string; status: string; cost: string };
type Document = Row & { name: string; entity: string; type: string; expiry: string; status: string; owner: string };
type Contract = Row & { ref: string; client: string; type: string; total: number; collected: number; expiry: string; status: string };
type Claim = Row & { ref: string; client: string; contract: string; amount: number; due: string; paid: number; status: string };
type PaymentRow = Row & { amount: number; paidAt: string; method: string; reference: string; contractId?: number | null; claimId?: number | null; clientId?: number | null };

const navGroups: { label: string; items: { key: ModuleKey; label: string; icon: any; count?: string }[] }[] = [
  { label: "نظرة عامة", items: [{ key: "dashboard", label: "الإحصائيات", icon: LayoutDashboard }] },
  { label: "التشغيل", items: [
    { key: "vehicles", label: "المركبات", icon: CarFront, count: "42" },
    { key: "maintenance", label: "الصيانة", icon: Wrench, count: "6" },
    { key: "documents", label: "المستندات", icon: FileCheck2, count: "9" },
    { key: "drivers", label: "السائقون", icon: UserRound },
    { key: "clients", label: "العملاء", icon: UsersRound },
  ] },
  { label: "المالية", items: [{ key: "finance", label: "المالية", icon: CircleDollarSign }] },
  { label: "النظام", items: [{ key: "settings", label: "الإعدادات", icon: Settings2 }] },
];

const initialVehicles: Vehicle[] = [
  { id: 1, plate: "أ ب ج 4821", brand: "تويوتا", model: "كامري 2024", year: "2024", color: "أبيض لؤلؤي", mileage: "38,240 كم", driver: "أحمد العتيبي", status: "متاحة", client: "شركة المدار", contract: "عقد #CN-24018" },
  { id: 2, plate: "ر س د 7312", brand: "هيونداي", model: "سوناتا 2023", year: "2023", color: "رمادي", mileage: "64,890 كم", driver: "خالد الشهري", status: "مؤجرة", client: "مجموعة رواسي", contract: "عقد #CN-23997" },
  { id: 3, plate: "ن و هـ 1098", brand: "مرسيدس", model: "E-Class 2024", year: "2024", color: "أسود", mileage: "21,450 كم", driver: "—", status: "في الصيانة", client: "—", contract: "—" },
  { id: 4, plate: "ج ح خ 5560", brand: "كيا", model: "K5 2022", year: "2022", color: "أزرق ليلي", mileage: "92,210 كم", driver: "سعد الحربي", status: "مشغولة", client: "بنك الأمان", contract: "عقد #CN-23841" },
  { id: 5, plate: "م ك ل 8843", brand: "فورد", model: "تورس 2023", year: "2023", color: "فضي", mileage: "47,680 كم", driver: "ناصر الزهراني", status: "متاحة", client: "—", contract: "—" },
  { id: 6, plate: "ط ظ ع 2301", brand: "تويوتا", model: "راف فور 2024", year: "2024", color: "أخضر غامق", mileage: "12,750 كم", driver: "—", status: "قيد التجهيز", client: "—", contract: "—" },
];
const initialDrivers: Driver[] = [
  { id: 1, name: "أحمد محمد العتيبي", phone: "+966 50 234 8712", idNo: "10•••••482", status: "متاح", vehicle: "أ ب ج 4821", license: "خصوصي", renewal: "2026/11/08" },
  { id: 2, name: "خالد سعد الشهري", phone: "+966 55 982 1440", idNo: "10•••••019", status: "مشغول", vehicle: "ر س د 7312", license: "نقل خفيف", renewal: "2026/04/22" },
  { id: 3, name: "سعد عبدالله الحربي", phone: "+966 54 310 2998", idNo: "10•••••634", status: "مشغول", vehicle: "ج ح خ 5560", license: "خصوصي", renewal: "2027/01/19" },
  { id: 4, name: "ناصر علي الزهراني", phone: "+966 56 441 9227", idNo: "10•••••971", status: "متاح", vehicle: "م ك ل 8843", license: "خصوصي", renewal: "2026/08/30" },
  { id: 5, name: "فيصل صالح القحطاني", phone: "+966 53 770 1452", idNo: "10•••••108", status: "متاح", vehicle: "—", license: "نقل ثقيل", renewal: "2026/12/15" },
];
const initialClients: Client[] = [
  { id: 1, name: "شركة المدار للخدمات اللوجستية", location: "الرياض", vat: "310•••••901", commercial: "1010••••42", contact: "سارة الدوسري", phone: "+966 11 456 8821", contracts: 4 },
  { id: 2, name: "مجموعة رواسي القابضة", location: "جدة", vat: "310•••••117", commercial: "4030••••88", contact: "محمد الغامدي", phone: "+966 12 612 0091", contracts: 2 },
  { id: 3, name: "بنك الأمان الوطني", location: "الرياض", vat: "310•••••552", commercial: "1010••••17", contact: "خالد السالم", phone: "+966 11 299 1040", contracts: 8 },
  { id: 4, name: "مستشفى الحياة التخصصي", location: "الدمام", vat: "310•••••734", commercial: "2050••••31", contact: "ريم القحطاني", phone: "+966 13 824 7110", contracts: 1 },
];
const initialMaintenance: Maintenance[] = [
  { id: 1, ref: "MT-24061", vehicle: "ن و هـ 1098", type: "صيانة دورية — 20,000 كم", manager: "ورشة المركز الرئيسي", start: "18 سبتمبر 2026", due: "غدًا", status: "جاري العمل", cost: "2,840 ر.س" },
  { id: 2, ref: "MT-24059", vehicle: "ط ظ ع 2301", type: "فحص ما قبل التسليم", manager: "ياسر الغامدي", start: "17 سبتمبر 2026", due: "اليوم", status: "جديد", cost: "640 ر.س" },
  { id: 3, ref: "MT-24053", vehicle: "ر س د 7312", type: "تغيير إطارات", manager: "ورشة الشفاء", start: "14 سبتمبر 2026", due: "مكتمل", status: "مكتمل", cost: "4,250 ر.س" },
  { id: 4, ref: "MT-24048", vehicle: "ج ح خ 5560", type: "إصلاح تكييف", manager: "ورشة المركز الرئيسي", start: "11 سبتمبر 2026", due: "متأخر 2 يوم", status: "متوقف", cost: "1,980 ر.س" },
];
const initialDocuments: Document[] = [
  { id: 1, name: "استمارة المركبة", entity: "أ ب ج 4821", type: "مركبة", expiry: "22 سبتمبر 2026", status: "قريبًا", owner: "تويوتا كامري" },
  { id: 2, name: "رخصة القيادة", entity: "خالد الشهري", type: "سائق", expiry: "26 سبتمبر 2026", status: "متأخر", owner: "نقل خفيف" },
  { id: 3, name: "شهادة الزكاة والضريبة", entity: "شركة المدار", type: "عميل", expiry: "15 أكتوبر 2026", status: "ساري", owner: "ملف العميل" },
  { id: 4, name: "وثيقة التأمين الشامل", entity: "ن و هـ 1098", type: "مركبة", expiry: "04 نوفمبر 2026", status: "ساري", owner: "مرسيدس E-Class" },
  { id: 5, name: "السجل التجاري", entity: "مجموعة رواسي", type: "عميل", expiry: "01 يناير 2027", status: "ساري", owner: "ملف العميل" },
];
const initialContracts: Contract[] = [
  { id: 1, ref: "CN-24018", client: "شركة المدار", type: "تشغيل أسطول", total: 248000, collected: 186000, expiry: "28 ديسمبر 2026", status: "قائم" },
  { id: 2, ref: "CN-23997", client: "مجموعة رواسي", type: "تأجير شهري", total: 96000, collected: 96000, expiry: "14 نوفمبر 2026", status: "قائم" },
  { id: 3, ref: "CN-23841", client: "بنك الأمان", type: "نقل موظفين", total: 412000, collected: 274000, expiry: "04 أكتوبر 2026", status: "قائم" },
];
const initialClaims: Claim[] = [
  { id: 1, ref: "CL-10291", client: "شركة المدار", contract: "CN-24018", amount: 62000, due: "30 سبتمبر 2026", paid: 31000, status: "مستحقة" },
  { id: 2, ref: "CL-10287", client: "بنك الأمان", contract: "CN-23841", amount: 85000, due: "15 سبتمبر 2026", paid: 0, status: "متأخرة" },
  { id: 3, ref: "CL-10281", client: "مجموعة رواسي", contract: "CN-23997", amount: 32000, due: "01 سبتمبر 2026", paid: 32000, status: "مدفوعة" },
];

const statusTone: Record<string, string> = {
  "متاحة": "green", "متاح": "green", "ساري": "green", "مكتمل": "green", "قائم": "green", "مدفوعة": "green",
  "مؤجرة": "blue", "مشغولة": "blue", "جاري العمل": "amber", "قريبًا": "amber", "مستحقة": "amber", "جديد": "amber", "قيد التجهيز": "amber",
  "في الصيانة": "red", "متأخر": "red", "متأخرة": "red", "متوقف": "red", "متأخر 2 يوم": "red",
};

function Badge({ children }: { children: string }) {
  return <span className={`status-badge ${statusTone[children] || "gray"}`}><i />{children}</span>;
}
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-mark ${compact ? "compact" : ""}`}><span className="drop-logo">⌄</span>{!compact && <span><strong>زيتي</strong><small>plus</small></span>}</div>;
}
function formatSAR(value: number) { return `${value.toLocaleString("ar-SA")} ر.س`; }
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

function Chart() {
  const points = "8,128 72,116 136,122 200,92 264,100 328,64 392,73 456,48 520,58 584,28";
  return <div className="chart-wrap">
    <div className="chart-y"><span>١٠٠</span><span>٧٥</span><span>٥٠</span><span>٢٥</span><span>٠</span></div>
    <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="chart-svg" role="img" aria-label="الرسم البياني للصيانات">
      <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0b8f7b" stopOpacity=".18"/><stop offset="1" stopColor="#0b8f7b" stopOpacity="0"/></linearGradient></defs>
      {[28,58,88,118,148].map(y => <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#e9eeec" strokeWidth="1" />)}
      <polygon points={`0,160 ${points} 600,160`} fill="url(#chartFill)" />
      <polyline points={points} fill="none" stroke="#0b8f7b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((point, i) => { const [cx, cy] = point.split(","); return <circle key={i} cx={cx} cy={cy} r="4" fill="#fff" stroke="#0b8f7b" strokeWidth="2" />; })}
    </svg>
    <div className="chart-x"><span>يناير</span><span>فبراير</span><span>مارس</span><span>أبريل</span><span>مايو</span><span>يونيو</span><span>يوليو</span><span>أغسطس</span><span>سبتمبر</span><span>أكتوبر</span></div>
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

function DetailModal({ row, module, onClose, onEdit }: { row: Row; module: ModuleKey; onClose: () => void; onEdit: () => void }) {
  const title = module === "vehicles" ? `تفاصيل المركبة · ${row.plate}` : module === "drivers" ? `ملف السائق · ${row.name}` : module === "clients" ? `ملف العميل · ${row.name}` : "تفاصيل السجل";
  const entries = Object.entries(row).filter(([key]) => key !== "id" && key !== "fileUrl");
  return <Modal title={title} onClose={onClose} wide><div className="detail-grid">{entries.map(([key, value]) => <div className="detail-cell" key={key}><span>{key === "plate" ? "رقم اللوحة" : key === "brand" ? "الشركة" : key === "model" ? "الموديل" : key === "status" ? "الحالة" : key === "driver" ? "السائق" : key === "client" ? "العميل" : key === "phone" ? "رقم الهاتف" : key === "location" ? "الموقع" : key === "vehicle" ? "المركبة الحالية" : key === "contracts" ? "العقود" : key === "fileName" ? "اسم الملف" : key}</span><strong>{typeof value === "number" ? value.toLocaleString("ar-SA") : value}</strong></div>)}</div><div className="detail-footer"><button className="btn ghost" onClick={onClose}>إغلاق</button>{module === "documents" && row.fileUrl && <button className="btn outline" onClick={() => window.open(String(row.fileUrl), "_blank", "noopener,noreferrer")}><BookOpen size={15} />معاينة الملف</button>}<button className="btn primary" onClick={() => { onClose(); onEdit(); }}><Pencil size={15} />تعديل البيانات</button></div></Modal>;
}

function RecordForm({ module, row, onClose, onSave }: { module: ModuleKey; row?: Row | null; onClose: () => void; onSave: (data: Row) => void }) {
  const isEdit = Boolean(row);
  const isClaim = module === "finance" && (row?.recordType === "claim" || String(row?.ref || "").startsWith("CL-"));
  const isPayment = module === "finance" && row?.recordType === "payment";
  const defaults: Row = module === "maintenance"
    ? { id: Date.now(), ref: `MT-${Math.floor(24000 + Math.random() * 900)}`, vehicle: "", type: "صيانة دورية", manager: "", start: "", due: "", status: "جديد", cost: "0 ر.س" }
    : module === "documents"
      ? { id: Date.now(), name: "", entity: "", type: "مركبة", expiry: "", status: "ساري", owner: "" }
      : module === "finance"
        ? (isPayment ? { id: Date.now(), recordType: "payment", clientId: null, contractId: null, claimId: null, amount: 0, paidAt: "", method: "تحويل بنكي", reference: "—", notes: "" } : isClaim ? { id: Date.now(), recordType: "claim", ref: `CL-${Math.floor(10000 + Math.random() * 900)}`, client: "", contract: "", amount: 0, paid: 0, due: "", status: "مستحقة" } : { id: Date.now(), ref: `CN-${Math.floor(24000 + Math.random() * 900)}`, client: "", type: "تشغيل أسطول", total: 0, collected: 0, expiry: "", status: "قائم" })
        : module === "drivers"
          ? { id: Date.now(), name: "", phone: "", idNo: "", license: "خصوصي", renewal: "", vehicle: "—", status: "متاح" }
          : module === "clients"
            ? { id: Date.now(), name: "", location: "", vat: "", commercial: "", contact: "", phone: "", contracts: 0 }
            : { id: Date.now(), plate: "", brand: "تويوتا", model: "", year: "2026", color: "أبيض", mileage: "0 كم", driver: "—", status: "متاحة", client: "—", contract: "—" };
  const [form, setForm] = useState<Row>(row || defaults);
  const set = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const { data: vehicles = [] } = trpc.vehicles.list.useQuery();
  const { data: drivers = [] } = trpc.drivers.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: contracts = [] } = trpc.contracts.list.useQuery();
  const { data: claims = [] } = trpc.claims.list.useQuery();
  const { data: settings = [] } = trpc.settingsCatalog.list.useQuery();
  const submit = (e: React.FormEvent) => { e.preventDefault(); const required = isPayment ? form.amount && form.paidAt : module === "vehicles" ? form.plate : module === "maintenance" ? form.vehicle : module === "documents" ? form.name : module === "finance" ? form.client : form.name; if (!required) { toast.error("أكمل الحقول المطلوبة أولًا"); return; } if (module === "clients" && !isEdit && (!form.vat || !form.commercial)) { toast.error("الرقم الضريبي والسجل التجاري حقول مطلوبة"); return; } if (module === "clients" && form.vat && !/^\d{15}$/.test(String(form.vat))) { toast.error("الرقم الضريبي يجب أن يتكون من 15 رقمًا"); return; } if (module === "clients" && form.commercial && !/^\d{10}$/.test(String(form.commercial))) { toast.error("السجل التجاري يجب أن يتكون من 10 أرقام"); return; } onSave(form); onClose(); toast.success(isEdit ? "تم حفظ تعديلات السجل" : "تمت إضافة السجل بنجاح"); };
  if (module === "vehicles") return <Modal title={isEdit ? "تعديل بيانات المركبة" : "إضافة مركبة جديدة"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><Field label="رقم اللوحة *" value={form.plate} onChange={set("plate")} placeholder="مثال: أ ب ج 4821" /><label className="field"><span>شركة السيارة</span><select value={form.brand} onChange={e => set("brand")(e.target.value)}><option value="—">اختر الماركة</option>{(settings ?? []).filter(s => s.category === "car_companies").map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><Field label="الموديل" value={form.model} onChange={set("model")} placeholder="مثال: كامري 2024" /><Field label="سنة الصنع" value={form.year} onChange={set("year")} /><Field label="اللون" value={form.color} onChange={set("color")} /><Field label="عداد المسافة" value={form.mileage} onChange={set("mileage")} /><label className="field"><span>الحالة</span><select value={form.status} onChange={e => set("status")(e.target.value)}><option>متاحة</option><option>مؤجرة</option><option>مشغولة</option><option>في الصيانة</option><option>قيد التجهيز</option></select></label><label className="field"><span>السائق</span><select value={form.driverId || ""} onChange={e => { const d = drivers.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, driverId: d ? d.id : null, driver: d ? d.name : "—"})); }}><option value="">بدون سائق</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="field"><span>العميل</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—"})); }}><option value="">بدون عميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>العقد</span><select value={form.contractId || ""} onChange={e => { const cn = contracts.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, contractId: cn ? cn.id : null, contract: cn ? cn.ref : "—"})); }}><option value="">بدون عقد</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إضافة المركبة"} /></form></Modal>;
  if (module === "maintenance") return <Modal title={isEdit ? "تعديل طلب الصيانة" : "طلب صيانة جديد"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>المركبة *</span><select value={form.vehicleId || ""} onChange={e => { const v = vehicles.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, vehicleId: v ? v.id : null, vehicle: v ? v.plate : ""})); }}><option value="">اختر مركبة</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.brand}</option>)}</select></label><label className="field"><span>نوع الصيانة</span><select value={form.type} onChange={e => set("type")(e.target.value)}><option value="—">اختر النوع</option>{(settings ?? []).filter(s => s.category === "maintenance_types").map(s => <option key={s.id} value={s.value}>{s.label}</option>)}</select></label><label className="field"><span>مسؤول الصيانة</span><select value={form.manager} onChange={e => set("manager")(e.target.value)}><option value="—">اختر مسؤول</option>{drivers.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></label><Field label="تاريخ البداية" value={form.start} onChange={set("start")} type="date" /><Field label="التاريخ المتوقع للانتهاء" value={form.due} onChange={set("due")} type="date" /><Field label="التكلفة" value={form.cost} onChange={set("cost")} /></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إنشاء طلب الصيانة"} /></form></Modal>;
  if (module === "documents") return <Modal title={isEdit ? "تعديل بيانات المستند" : "رفع مستند جديد"} onClose={onClose}><form onSubmit={submit}><div className="form-grid single"><Field label="اسم المستند *" value={form.name} onChange={set("name")} /><label className="field"><span>الكيان المرتبط</span><select value={form.entityId || ""} onChange={e => { const ent = [...vehicles, ...drivers].find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, entityId: ent ? ent.id : null, entity: ent ? ('plate' in ent ? ent.plate : ent.name) : "—"})); }}><option value="">اختر كيان</option><optgroup label="المركبات">{vehicles.map(v => <option key={`v-${v.id}`} value={v.id}>{v.plate}</option>)}</optgroup><optgroup label="السائقين">{drivers.map(d => <option key={`d-${d.id}`} value={d.id}>{d.name}</option>)}</optgroup></select></label><Field label="النوع" value={form.type} onChange={set("type")} /><Field label="تاريخ الانتهاء" value={form.expiry} onChange={set("expiry")} type="date" /><label className="field"><span>الملف</span><input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 700000) { toast.error("الملف كبير؛ الحد الحالي 700 كيلوبايت"); return; } const reader = new FileReader(); reader.onload = () => setForm(prev => ({ ...prev, fileName: file.name, fileUrl: String(reader.result || "") })); reader.readAsDataURL(file); }} /></label></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "رفع المستند"} /></form></Modal>;
  if (module === "finance" && isPayment) return <Modal title="تسجيل دفعة مالية" onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>رقم العقد</span><select value={form.contractId || ""} onChange={e => { const contract = contracts.find(c => String(c.id) === e.target.value); setForm(prev => ({ ...prev, contractId: contract ? contract.id : null, clientId: contract?.clientId ?? prev.clientId ?? null })); }}><option value="">اختر العقد</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label><label className="field"><span>المطالبة المرتبطة</span><select value={form.claimId || ""} onChange={e => { const claim = claims.find(c => String(c.id) === e.target.value); setForm(prev => ({ ...prev, claimId: claim ? claim.id : null, contractId: claim?.contractId ?? prev.contractId ?? null, clientId: claim?.clientId ?? prev.clientId ?? null })); }}><option value="">بدون مطالبة</option>{claims.map(c => <option key={c.id} value={c.id}>{c.ref} - {c.client}</option>)}</select></label><label className="field"><span>العميل</span><select value={form.clientId || ""} onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="المبلغ *" value={String(form.amount ?? "")} onChange={v => setForm(prev => ({ ...prev, amount: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الدفع *" value={form.paidAt} onChange={set("paidAt")} type="date" /><Field label="طريقة الدفع" value={form.method} onChange={set("method")} /><Field label="المرجع" value={form.reference} onChange={set("reference")} /></div><FormActions onCancel={onClose} label="حفظ الدفعة" /></form></Modal>;
  if (module === "finance" && isClaim) return <Modal title={isEdit ? "تعديل المطالبة المالية" : "إنشاء مطالبة مالية"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—"})); }}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>العقد *</span><select value={form.contractId || ""} onChange={e => { const cn = contracts.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, contractId: cn ? cn.id : null, contract: cn ? cn.ref : "—"})); }}><option value="">اختر العقد</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.ref}</option>)}</select></label><Field label="قيمة المطالبة" value={String(form.amount ?? "")} onChange={v => setForm(prev => ({ ...prev, amount: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="المدفوع" value={String(form.paid ?? "")} onChange={v => setForm(prev => ({ ...prev, paid: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الاستحقاق" value={form.due} onChange={set("due")} type="date" /><label className="field"><span>الحالة</span><select value={form.status} onChange={e => set("status")(e.target.value)}><option>مستحقة</option><option>مدفوعة</option><option>متأخرة</option><option>ملغاة</option></select></label></div><FormActions onCancel={onClose} label={isEdit ? "حفظ المطالبة" : "إنشاء المطالبة"} /></form></Modal>;
  if (module === "finance") return <Modal title={isEdit ? "تعديل العقد" : "إنشاء عقد مالي"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid"><label className="field"><span>العميل *</span><select value={form.clientId || ""} onChange={e => { const c = clients.find(x => String(x.id) === e.target.value); setForm(prev => ({...prev, clientId: c ? c.id : null, client: c ? c.name : "—"})); }}><option value="">اختر العميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Field label="نوع العقد" value={form.type} onChange={set("type")} /><Field label="تاريخ البداية" value={form.startDate} onChange={set("startDate")} type="date" /><Field label="القيمة الإجمالية" value={String(form.total ?? "")} onChange={v => setForm(prev => ({ ...prev, total: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="المحصل" value={String(form.collected ?? "")} onChange={v => setForm(prev => ({ ...prev, collected: Number(v.replace(/[^0-9]/g, "")) }))} /><Field label="تاريخ الانتهاء" value={form.expiry} onChange={set("expiry")} type="date" /><label className="field"><span>المركبة المرتبطة</span><select value={form.items?.[0]?.vehicleId || ""} onChange={e => { const v = vehicles.find(x => String(x.id) === e.target.value); setForm(prev => ({ ...prev, items: [{ ...(prev.items?.[0] || {}), vehicleId: v ? v.id : null, vehiclePlate: v ? v.plate : "—" }] })); }}><option value="">بدون مركبة</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}</select></label><Field label="السائق المرتبط" value={form.items?.[0]?.driver || "—"} onChange={v => setForm(prev => ({ ...prev, items: [{ ...(prev.items?.[0] || {}), driver: v }] }))} /></div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إنشاء العقد"} /></form></Modal>;
  const config = module === "drivers" ? { title: isEdit ? "تعديل بيانات السائق" : "إضافة سائق جديد", fields: [["name", "الاسم الكامل *"], ["phone", "رقم الهاتف"], ["idNo", "رقم الهوية / الإقامة"], ["license", "نوع الرخصة"], ["renewal", "تاريخ انتهاء الرخصة"]] } : { title: isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد", fields: [["name", "اسم العميل *"], ["vat", "الرقم الضريبي * (15 رقمًا)"], ["commercial", "السجل التجاري * (10 أرقام)"], ["location", "الموقع"], ["contact", "اسم الممثل"], ["phone", "رقم اتصال الممثل"]] };
  return <Modal title={config.title} onClose={onClose}><form onSubmit={submit}><div className="form-grid single">{config.fields.map(([key, label]) => <Field key={key} label={label} value={form[key]} onChange={set(key)} />)}</div><FormActions onCancel={onClose} label={isEdit ? "حفظ التعديل" : "إضافة السجل"} /></form></Modal>;
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

function QuickActionModal({ action, row, onClose, onSave }: { action: string; row: Row; onClose: () => void; onSave: (value: string) => void }) {
  const config: Record<string, { title: string; label: string; placeholder?: string; options?: string[] }> = {
    status: { title: "تغيير الحالة", label: "الحالة الجديدة", options: ["جديد", "جاري العمل", "مكتمل", "متوقف", "قائم", "مدفوعة", "متأخرة"] },
    extend: { title: "تمديد تاريخ الانتهاء", label: "التاريخ الجديد", placeholder: "مثال: 30 ديسمبر 2026" },
    cost: { title: "تسجيل تكلفة أو فاتورة", label: "التكلفة", placeholder: "مثال: 1,250 ر.س" },
    item: { title: "إضافة بند صيانة", label: "وصف البند", placeholder: "مثال: تغيير زيت وفلتر" },
  };
  const entry = config[action] || config.status;
  const [value, setValue] = useState(entry.options?.[0] || "");
  return <Modal title={entry.title} onClose={onClose}><form onSubmit={e => { e.preventDefault(); if (!value.trim()) { toast.error("أدخل قيمة صحيحة"); return; } onSave(value); }}><div className="form-grid single"><div className="action-context"><strong>{row.ref || row.name || row.plate || "السجل المحدد"}</strong><span>سيتم تطبيق الإجراء على هذا السجل فقط.</span></div>{entry.options ? <label className="field"><span>{entry.label}</span><select value={value} onChange={e => setValue(e.target.value)}>{entry.options.map(option => <option key={option}>{option}</option>)}</select></label> : <Field label={entry.label} value={value} onChange={setValue} placeholder={entry.placeholder} />}</div><FormActions onCancel={onClose} label="حفظ الإجراء" /></form></Modal>;
}

function ContextMenu({ row, module, onAction, onClose }: { row: Row; module: ModuleKey; onAction: (action: string) => void; onClose: () => void }) {
  const actions = module === "vehicles" ? [["عرض التفاصيل", "view"], ["تعديل المركبة", "edit"], ["إضافة إلى الصيانة", "maintenance"], ["إسناد سائق", "assign"], ["أرشفة المركبة", "archive"]] : module === "maintenance" ? [["عرض التفاصيل", "view"], ["تعديل الطلب", "edit"], ["إضافة بند صيانة", "item"], ["تسجيل تكلفة أو فاتورة", "cost"], ["تغيير الحالة", "status"]] : module === "documents" ? [["معاينة المستند", "view"], ["تحميل الملف", "download"], ["تعديل البيانات", "edit"], ["تمديد تاريخ الانتهاء", "extend"], ["أرشفة المستند", "archive"]] : module === "drivers" ? [["عرض الملف الشخصي", "view"], ["تعديل البيانات", "edit"], ["إسناد مركبة", "assign"], ["تغيير الحالة", "status"], ["أرشفة السائق", "archive"]] : module === "clients" ? [["عرض تفاصيل العميل", "view"], ["تعديل العميل", "edit"], ["عرض العقود", "contracts"], ["عرض المطالبات المالية", "claims"], ["إنشاء عقد جديد", "new-contract"]] : [["عرض التفاصيل", "view"], ["تعديل البيانات", "edit"], ["تغيير الحالة", "status"], ["تصدير السجل", "download"]];
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

function DashboardHome({ onNavigate, tasks, notifications, vehicles, drivers, maintenance, onTaskToggle, onTaskCreate }: { onNavigate: (key: ModuleKey) => void; tasks: Array<{ id: number; title: string; dueAt: string; status: string }>; notifications: Array<{ id: number; title: string; message: string; severity: string }>; vehicles: Vehicle[]; drivers: Driver[]; maintenance: Maintenance[]; onTaskToggle: (task: { id: number; status: string }) => void; onTaskCreate: () => void }) {
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter(v => ["متاحة", "مؤجرة", "مشغولة"].includes(v.status)).length;
  const availableDrivers = drivers.filter(d => d.status === "متاح").length;
  const operationRate = totalVehicles ? ((activeVehicles / totalVehicles) * 100).toFixed(1).replace(".", "٫") : "٠";
  const attentionNotifications = notifications.length ? notifications.slice(0, 3) : [
    { id: -1, title: "مراجعة المستندات القريبة من الانتهاء", message: "راجع المستندات قبل توقف العمليات", severity: "تنبيه" },
    { id: -2, title: "طلبات صيانة تحتاج متابعة", message: `${maintenance.filter(item => item.status !== "مكتمل").length} طلبات مفتوحة في النظام`, severity: "معلومة" },
  ];
  const maintenanceRows = maintenance.filter(item => item.status !== "مكتمل").slice(0, 3);
  return <>
    <PageHeader eyebrow="نظرة عامة / لوحة التحكم" title="صباح الخير، عبدالرحمن" description="إليك نظرة سريعة على أداء أسطولك اليوم." action="إضافة مركبة" onAction={() => onNavigate("vehicles")} />
    <div className="metrics-grid"><MetricCard title="إجمالي المركبات" value={totalVehicles.toLocaleString("ar-SA")} helper={`${activeVehicles} مركبة نشطة`} icon={CarFront} tone="teal" /><MetricCard title="المركبات النشطة" value={activeVehicles.toLocaleString("ar-SA")} helper={`من أصل ${totalVehicles.toLocaleString("ar-SA")} مركبة`} icon={Activity} tone="blue" /><MetricCard title="السائقون المتاحون" value={availableDrivers.toLocaleString("ar-SA")} helper={`${drivers.length.toLocaleString("ar-SA")} إجمالي السائقين`} icon={UsersRound} tone="violet" /><MetricCard title="معدل التشغيل" value={`${operationRate}٪`} helper="محسوب من الحالة الحالية" icon={Gauge} tone="orange" /></div>
    <div className="dashboard-grid"><section className="surface chart-card"><div className="section-head"><div><h2>نشاط الصيانة</h2><span>عدد طلبات الصيانة خلال آخر ١٠ أشهر</span></div><button className="select-like">آخر ١٠ أشهر <ChevronDown size={14} /></button></div><Chart /></section><section className="surface alert-card"><div className="section-head"><div><h2>تحتاج إلى انتباه</h2><span>تنبيهات تتطلب إجراءً منك</span></div><button className="icon-btn"><MoreHorizontal size={18} /></button></div><div className="alerts-list">{attentionNotifications.length ? attentionNotifications.map(item => <div className="alert-row" key={item.id}><span className={`alert-icon ${item.severity === "حرج" ? "red" : item.severity === "تنبيه" ? "amber" : "blue"}`}><Bell size={16} /></span><div><strong>{item.title}</strong><small>{item.message}</small></div><ChevronLeft size={15} /></div>) : <div className="empty-state"><strong>لا توجد تنبيهات جديدة</strong><span>ستظهر هنا التنبيهات التشغيلية المهمة.</span></div>}</div><button className="text-link" onClick={() => onNavigate("documents")}>عرض كل التنبيهات <ChevronLeft size={14} /></button></section></div>
    <div className="dashboard-grid lower"><section className="surface mini-table"><div className="section-head"><div><h2>المركبات تحتاج صيانة</h2><span>مراجعة الحالة التشغيلية للمركبات</span></div><button className="text-link" onClick={() => onNavigate("maintenance")}>عرض الكل <ChevronLeft size={14} /></button></div><div className="compact-list">{maintenanceRows.length ? maintenanceRows.map(item => <div className="compact-row" key={item.id}><div className="vehicle-avatar"><CarFront size={16} /></div><div className="compact-main"><strong>{item.vehicle}</strong><small>{item.type}</small></div><Badge>{item.status}</Badge><span className="compact-date">{item.due}</span></div>) : <div className="empty-state"><strong>لا توجد مركبات تحت الصيانة</strong><span>حالة الأسطول التشغيلية مستقرة.</span></div>}</div></section><section className="surface mini-table"><div className="section-head"><div><h2>مهام اليوم</h2><span>{tasks.length} مهام محفوظة</span></div><button className="btn outline" onClick={onTaskCreate}><Plus size={15} />إضافة مهمة</button></div><div className="tasks">{tasks.length ? tasks.slice(0, 5).map(task => <label className={`task ${task.status === "مكتملة" ? "done" : ""}`} key={task.id}><input type="checkbox" checked={task.status === "مكتملة"} onChange={() => onTaskToggle(task)} /><span>{task.title}</span><small>{task.dueAt}</small></label>) : <div className="empty-state"><strong>لا توجد مهام محفوظة</strong><span>أضف مهام التشغيل اليومية من زر إضافة مهمة.</span></div>}</div></section></div>
  </>;
}

function VehiclesPage({ vehicles, setVehicles, onOpenForm, onAction }: { vehicles: Vehicle[]; setVehicles: (v: Vehicle[]) => void; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = vehicles.filter(v => (!search || Object.values(v).join(" ").includes(search)) && (tab === "الكل" || (tab === "متاح" && v.status === "متاحة") || (tab === "في الصيانة" && v.status === "في الصيانة") || (tab === "مؤجر / مشغول" && ["مؤجرة", "مشغولة"].includes(v.status))));
  return <><PageHeader eyebrow="التشغيل / إدارة الأسطول" title="المركبات" description="إدارة كاملة لبيانات المركبات وحالتها التشغيلية وعقودها المرتبطة." action="إضافة مركبة" onAction={() => onOpenForm()} /><div className="quick-metrics"><div><span>كل المركبات</span><strong>٤٢</strong></div><div><span>متاحة</span><strong className="green-text">٢١</strong></div><div><span>في الصيانة</span><strong className="red-text">٦</strong></div><div><span>مؤجرة / مشغولة</span><strong className="blue-text">١٥</strong></div></div><TableShell columns={["رقم اللوحة", "المركبة", "السنة", "المسافة", "السائق", "الحالة", "العميل"]} onExport={() => exportCsv(filtered, ["plate", "brand", "model", "year", "mileage", "driver", "status", "client"], "vehicles")} search={search} setSearch={setSearch} tabs={["الكل", "متاح", "في الصيانة", "مؤجر / مشغول"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة مركبة" onAdd={() => onOpenForm()}>{filtered.map(v => <tr key={v.id}><td><strong className="table-primary">{v.plate}</strong><small>{v.brand}</small></td><td>{v.model}<small>{v.color}</small></td><td>{v.year}</td><td>{v.mileage}</td><td>{v.driver}</td><td><Badge>{v.status}</Badge></td><td>{v.client}<small>{v.contract}</small></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === v.id ? null : v.id)}><MoreHorizontal size={18} /></button>{menu === v.id && <ContextMenu row={v} module="vehicles" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, v); }} />}</td></tr>)}</TableShell></>;
}

function MaintenancePage({ maintenance, onOpenForm, onAction }: { maintenance: Maintenance[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = maintenance.filter(m => (!search || Object.values(m).join(" ").includes(search)) && (tab === "الكل" || (tab === "مكتمل" && m.status === "مكتمل") || (tab === "جاري العمل" && m.status !== "مكتمل")));
  return <><PageHeader eyebrow="التشغيل / الورش" title="الصيانة" description="تابع طلبات الصيانة والتكاليف والمواعيد النهائية لكل مركبة." action="طلب صيانة جديد" onAction={() => onOpenForm()} /><div className="stats-banner"><div><Wrench size={17} /><span>طلبات مفتوحة</span><strong>٦</strong></div><div><Clock3 size={17} /><span>متأخرة</span><strong className="red-text">٢</strong></div><div><CircleDollarSign size={17} /><span>تكلفة هذا الشهر</span><strong>١٨٬٤٢٠ ر.س</strong></div><div><CalendarDays size={17} /><span>متوسط المدة</span><strong>٣٫٤ أيام</strong></div></div><TableShell columns={["الطلب", "المركبة", "نوع الصيانة", "المسؤول", "تاريخ البدء", "الانتهاء", "الحالة", "التكلفة"]} onExport={() => exportCsv(filtered, ["ref", "vehicle", "type", "manager", "start", "due", "status", "cost"], "maintenance")} search={search} setSearch={setSearch} tabs={["الكل", "مكتمل", "جاري العمل"]} activeTab={tab} setActiveTab={setTab} addLabel="طلب صيانة جديد" onAdd={() => onOpenForm()}>{filtered.map(m => <tr key={m.id}><td><strong className="table-primary">{m.ref}</strong><small>منذ {m.start}</small></td><td>{m.vehicle}</td><td>{m.type}</td><td>{m.manager}</td><td>{m.start}</td><td className={m.due.includes("متأخر") ? "red-text" : ""}>{m.due}</td><td><Badge>{m.status}</Badge></td><td>{m.cost}</td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === m.id ? null : m.id)}><MoreHorizontal size={18} /></button>{menu === m.id && <ContextMenu row={m} module="maintenance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, m); }} />}</td></tr>)}</TableShell></>;
}

function DriverVehiclesModal({ driver, vehicles, onClose }: { driver: Driver; vehicles: Vehicle[]; onClose: () => void }) {
  const linkedVehicles = vehicles.filter(vehicle => vehicle.driver === driver.name || (driver.vehicle !== "—" && vehicle.plate === driver.vehicle));
  return <Modal title={`ملف السائق · ${driver.name}`} onClose={onClose} wide><div className="driver-summary"><span className="avatar">{driver.name.slice(0, 1)}</span><div><strong>{driver.name}</strong><span>{driver.phone} · {driver.license}</span><Badge>{driver.status}</Badge></div></div><div className="linked-vehicles-head"><div><h3>المركبات المرتبطة</h3><span>{linkedVehicles.length ? `لديه ${linkedVehicles.length} مركبة مرتبطة حاليًا` : "لا توجد مركبات مرتبطة بهذا السائق"}</span></div><CarFront size={20} /></div>{linkedVehicles.length ? <div className="linked-vehicles-list">{linkedVehicles.map(vehicle => <div className="linked-vehicle" key={vehicle.id}><span className="vehicle-avatar"><CarFront size={17} /></span><div><strong>{vehicle.plate}</strong><span>{vehicle.brand} · {vehicle.model}</span></div><div className="linked-vehicle-meta"><Badge>{vehicle.status}</Badge><small>{vehicle.client !== "—" ? vehicle.client : "بدون عميل"}</small><small>{vehicle.contract !== "—" ? vehicle.contract : "بدون عقد"}</small></div></div>)}</div> : <div className="empty-state"><CarFront size={24} /><strong>لا توجد مركبة مرتبطة</strong><span>يمكن إسناد مركبة من قائمة إجراءات السائق.</span></div>}<div className="detail-footer"><button className="btn primary" onClick={onClose}>إغلاق</button></div></Modal>;
}

function DocumentsPage({ documents, onAction, onOpenForm }: { documents: Document[]; onAction: (action: string, row: Row) => void; onOpenForm: (row?: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = documents.filter(d => (!search || Object.values(d).join(" ").includes(search)) && (tab === "الكل" || (tab === "متأخر" && d.status === "متأخر") || (tab === "قريبًا" && d.status === "قريبًا") || (tab === "مركبة" && d.type === "مركبة") || (tab === "سائق" && d.type === "سائق") || (tab === "عميل" && d.type === "عميل")));
  return <><PageHeader eyebrow="التشغيل / الامتثال" title="المستندات" description="كل مستندات المركبات والسائقين والعملاء في مكان واحد، مع تنبيهات التجديد." action="رفع مستند" onAction={() => onOpenForm()} /><div className="document-alert"><div className="alert-icon amber"><Bell size={17} /></div><div><strong>لديك ٣ مستندات تحتاج إلى تجديد هذا الأسبوع</strong><span>راجع المستندات القريبة من الانتهاء لتفادي توقف العمليات.</span></div><button className="btn outline" onClick={() => setTab("قريبًا")}>مراجعة الآن</button></div><TableShell columns={["المستند", "الكيان المرتبط", "النوع", "تاريخ الانتهاء", "الحالة"]} onExport={() => exportCsv(filtered, ["name", "entity", "type", "expiry", "status"], "documents")} search={search} setSearch={setSearch} tabs={["الكل", "قريبًا", "متأخر", "مركبة", "سائق", "عميل"]} activeTab={tab} setActiveTab={setTab} addLabel="رفع مستند" onAdd={() => onOpenForm()}>{filtered.map(d => <tr key={d.id}><td><div className="doc-cell"><span className="file-icon"><FileText size={17} /></span><div><strong>{d.name}</strong><small>{d.owner}</small></div></div></td><td>{d.entity}</td><td>{d.type}</td><td>{d.expiry}</td><td><Badge>{d.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === d.id ? null : d.id)}><MoreHorizontal size={18} /></button>{menu === d.id && <ContextMenu row={d} module="documents" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, d); }} />}</td></tr>)}</TableShell></>;
}

function DriversPage({ drivers, onOpenForm, onAction, onView }: { drivers: Driver[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void; onView: (driver: Driver) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = drivers.filter(d => (!search || Object.values(d).join(" ").includes(search)) && (tab === "الكل" || d.status === tab));
  return <><PageHeader eyebrow="التشغيل / الفريق" title="السائقون" description="إدارة ملفات السائقين، الرخص، التوزيع والحالة التشغيلية." action="إضافة سائق" onAction={() => onOpenForm()} /><div className="quick-metrics"><div><span>إجمالي السائقين</span><strong>٢٤</strong></div><div><span>متاحون</span><strong className="green-text">١٨</strong></div><div><span>في مهمة</span><strong className="blue-text">٦</strong></div><div><span>رخص تحتاج تجديد</span><strong className="amber-text">٣</strong></div></div><TableShell columns={["السائق", "الهاتف", "الهوية", "الرخصة", "المركبة الحالية", "الحالة", "التجديد"]} onExport={() => exportCsv(filtered, ["name", "phone", "idNo", "license", "vehicle", "status", "renewal"], "drivers")} search={search} setSearch={setSearch} tabs={["الكل", "متاح", "مشغول"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة سائق" onAdd={() => onOpenForm()}>{filtered.map(d => <tr key={d.id}><td><button className="driver-name-button" onClick={() => onView(d)}><span className="avatar">{d.name.slice(0, 1)}</span><span><strong>{d.name}</strong><small>اضغط لعرض المركبات</small></span></button></td><td>{d.phone}</td><td>{d.idNo}</td><td>{d.license}</td><td>{d.vehicle}</td><td><Badge>{d.status}</Badge></td><td>{d.renewal}</td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === d.id ? null : d.id)}><MoreHorizontal size={18} /></button>{menu === d.id && <ContextMenu row={d} module="drivers" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, d); }} />}</td></tr>)}</TableShell></>;
}

function ClientsPage({ clients, onOpenForm, onAction }: { clients: Client[]; onOpenForm: (row?: Row) => void; onAction: (action: string, row: Row) => void }) {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState("الكل"); const [menu, setMenu] = useState<number | null>(null);
  const filtered = clients.filter(c => (!search || Object.values(c).join(" ").includes(search)) && (tab === "الكل" || (tab === "نشط" && c.contracts > 0) || (tab === "غير نشط" && c.contracts === 0)));
  return <><PageHeader eyebrow="التشغيل / الحسابات" title="العملاء" description="ملفات العملاء والعقود والمركبات والمطالبات المرتبطة بكل حساب." action="إضافة عميل" onAction={() => onOpenForm()} /><div className="client-insight"><div><div className="insight-icon"><Sparkles size={18} /></div><div><strong>أفضل عميل هذا الشهر</strong><span>بنك الأمان الوطني · ١٢ عقدًا نشطًا</span></div></div><div className="insight-value">١٢٨٬٤٠٠ ر.س<small>إيراد متوقع</small></div></div><TableShell columns={["العميل", "الموقع", "الرقم الضريبي", "السجل التجاري", "جهة الاتصال", "العقود"]} onExport={() => exportCsv(filtered, ["name", "location", "vat", "commercial", "contact", "contracts"], "clients")} search={search} setSearch={setSearch} tabs={["الكل", "نشط", "غير نشط"]} activeTab={tab} setActiveTab={setTab} addLabel="إضافة عميل" onAdd={() => onOpenForm()}>{filtered.map(c => <tr key={c.id}><td><strong className="table-primary">{c.name}</strong><small>عميل مؤسسي</small></td><td>{c.location}</td><td>{c.vat}</td><td>{c.commercial}</td><td><div><strong>{c.contact}</strong><small>{c.phone}</small></div></td><td><span className="number-pill">{c.contracts}</span></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === c.id ? null : c.id)}><MoreHorizontal size={18} /></button>{menu === c.id && <ContextMenu row={c} module="clients" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, c); }} />}</td></tr>)}</TableShell></>;
}

function FinancePage({ onAction, onOpenForm, contracts, claims, payments, onPaymentArchive }: { onAction: (action: string, row: Row) => void; onOpenForm: (row?: Row) => void; contracts: Contract[]; claims: Claim[]; payments: PaymentRow[]; onPaymentArchive: (payment: PaymentRow) => void }) {
  const [view, setView] = useState<"contracts" | "claims">("contracts"); const [tab, setTab] = useState("كل العقود"); const [search, setSearch] = useState(""); const [menu, setMenu] = useState<number | null>(null); const rows = view === "contracts" ? contracts : claims; const filtered = rows.filter(r => (!search || Object.values(r).join(" ").includes(search)) && (tab === "كل العقود" || tab === "كل المطالبات" || r.status === tab));
  const switchView = (nextView: "contracts" | "claims") => { setView(nextView); setTab(nextView === "contracts" ? "كل العقود" : "كل المطالبات"); };
  const activeContracts = contracts.filter(contract => contract.status === "قائم");
  const totalValue = activeContracts.reduce((sum, contract) => sum + Number(contract.total || 0), 0);
  const collectedValue = activeContracts.reduce((sum, contract) => sum + Number(contract.collected || 0), 0);
  const outstandingValue = Math.max(0, totalValue - collectedValue);
  const collectionRate = totalValue ? ((collectedValue / totalValue) * 100).toFixed(1) : "0.0";
  const expiringSoon = activeContracts.filter(contract => contract.expiry && new Date(contract.expiry).getTime() - Date.now() < 60 * 86400000).length;
  return <><PageHeader eyebrow="المالية / الأداء" title="المالية" description="إدارة العقود والمطالبات والتحصيل والتقارير المالية في لوحة واحدة." action={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"} onAction={() => onOpenForm(view === "claims" ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` } : undefined)} /><div className="finance-switch"><button className={view === "contracts" ? "active" : ""} onClick={() => switchView("contracts")}>العقود المالية</button><button className={view === "claims" ? "active" : ""} onClick={() => switchView("claims")}>المطالبات المالية</button><button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}>تسجيل دفعة</button><button className="period-btn" onClick={() => toast.success("تم تطبيق الفترة: هذا الشهر")}>هذا الشهر <ChevronDown size={14} /></button></div><div className="metrics-grid finance-metrics"><MetricCard title="قيمة العقود الفعالة" value={formatSAR(totalValue)} helper={`${activeContracts.length} عقود قائمة`} icon={FileText} tone="teal" /><MetricCard title="المحصل" value={formatSAR(collectedValue)} helper={`${collectionRate}% من الإجمالي`} icon={CheckCircle2} tone="blue" /><MetricCard title="المتبقي" value={formatSAR(outstandingValue)} helper={`${claims.length} مطالبات`} icon={Clock3} tone="orange" /><MetricCard title="عقود قاربت على الانتهاء" value={String(expiringSoon)} helper="خلال ٦٠ يومًا" icon={Activity} tone="violet" /></div><TableShell columns={view === "contracts" ? ["رقم العقد", "العميل", "النوع", "القيمة الإجمالية", "المحصل", "تاريخ الانتهاء", "الحالة"] : ["رقم المطالبة", "العميل", "العقد", "القيمة", "الاستحقاق", "المدفوع", "الحالة"]} onExport={() => exportCsv(filtered, Object.keys(filtered[0] || {}).filter(k => k !== "id"), view)} search={search} setSearch={setSearch} tabs={view === "contracts" ? ["كل العقود", "قائم", "مكتمل", "عرض سعر"] : ["كل المطالبات", "مستحقة", "مدفوعة", "متأخرة"]} activeTab={tab} setActiveTab={setTab} addLabel={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"} onAdd={() => onOpenForm(view === "claims" ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` } : undefined)}>{filtered.map((r: any) => view === "contracts" ? <tr key={r.id}><td><strong className="table-primary">{r.ref}</strong><small>منذ ١٢ يومًا</small></td><td>{r.client}</td><td>{r.type}</td><td>{formatSAR(r.total)}</td><td>{formatSAR(r.collected)}</td><td>{r.expiry}</td><td><Badge>{r.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={18} /></button>{menu === r.id && <ContextMenu row={r} module="finance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, r); }} />}</td></tr> : <tr key={r.id}><td><strong className="table-primary">{r.ref}</strong></td><td>{r.client}</td><td>{r.contract}</td><td>{formatSAR(r.amount)}</td><td>{r.due}</td><td>{formatSAR(r.paid)}</td><td><Badge>{r.status}</Badge></td><td className="actions-cell"><button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={18} /></button>{menu === r.id && <ContextMenu row={r} module="finance" onClose={() => setMenu(null)} onAction={action => { setMenu(null); onAction(action, r); }} />}</td></tr>)}</TableShell><section className="surface mini-table" style={{ marginTop: "1rem" }}><div className="section-head"><div><h2>سجل الدفعات</h2><span>{payments.length} دفعة محفوظة</span></div><button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}><Plus size={15} />تسجيل دفعة</button></div>{payments.length ? <div className="table-scroll"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>المرجع</th><th>الربط</th><th>إجراءات</th></tr></thead><tbody>{payments.slice(0, 10).map(payment => <tr key={payment.id}><td>{payment.paidAt}</td><td>{formatSAR(payment.amount)}</td><td>{payment.method}</td><td>{payment.reference}</td><td>{payment.contractId ? `عقد #${payment.contractId}` : payment.claimId ? `مطالبة #${payment.claimId}` : "غير مرتبط"}</td><td className="actions-cell"><button className="row-menu-btn" title="تعديل الدفعة" onClick={() => onOpenForm({ ...payment, recordType: "payment" })}><Pencil size={16} /></button><button className="row-menu-btn danger" title="إلغاء الدفعة" onClick={() => onPaymentArchive(payment)}><Archive size={16} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state" style={{ padding: "1.5rem" }}><strong>لا توجد دفعات مسجلة</strong><span>سجّل أول دفعة من زر تسجيل دفعة.</span></div>}</section></>;
}

function SettingsPage({ settingsCount, auditLogs }: { settingsCount: number; auditLogs: Array<{ action: string; entityType: string; createdAt?: Date | string }> }) {
  const [location, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<{ key: string; title: string } | null>(null);
  const [newValue, setNewValue] = useState("");
  const { data: settings = [], refetch } = trpc.settingsCatalog.list.useQuery(undefined, { staleTime: 30000 });
  const createSetting = trpc.settingsCatalog.create.useMutation();
  const updateSetting = trpc.settingsCatalog.update.useMutation();
  const archiveSetting = trpc.settingsCatalog.archive.useMutation();

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
  if (selectedCard) {
    const values = (settings ?? []).filter(setting => setting.category === selectedCard.key);
    return <><PageHeader eyebrow={`الإعدادات / ${selectedCard.group}`} title={selectedCard.title} description={selectedCard.text} action="إضافة قيمة" onAction={() => document.getElementById("settings-value-input")?.focus()} /><button className="btn ghost" onClick={() => navigate("/dashboard/settings")}><ChevronRight size={15} />العودة إلى إعدادات النظام</button><section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}><form onSubmit={handleAddSetting} style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem" }}><input id="settings-value-input" className="field-input" placeholder={`إضافة قيمة إلى ${selectedCard.title}`} value={newValue} onChange={e => setNewValue(e.target.value)} /><button type="submit" className="btn primary" disabled={createSetting.isPending}><Plus size={15} />إضافة</button></form>{values.length ? <div className="compact-list">{values.map(value => <div className="compact-row" key={value.id}><div className="compact-main"><strong>{value.label}</strong><small>{value.value}</small></div><Badge>{value.active ? "نشط" : "غير نشط"}</Badge><div className="row-actions"><button className="icon-btn" title="تعديل" onClick={() => { const next = window.prompt("القيمة الجديدة", value.label); if (next?.trim()) updateSetting.mutate({ id: value.id, data: { label: next.trim(), value: next.trim() } }, { onSuccess: () => { refetch(); toast.success("تم تعديل القيمة"); }, onError: error => toast.error(error.message) }); }}><Pencil size={15} /></button><button className="icon-btn" title={value.active ? "تعطيل" : "تفعيل"} onClick={() => updateSetting.mutate({ id: value.id, data: { active: value.active ? 0 : 1 } }, { onSuccess: () => { refetch(); toast.success(value.active ? "تم تعطيل القيمة" : "تم تفعيل القيمة"); }, onError: error => toast.error(error.message) })}><Archive size={15} /></button></div></div>)}</div> : <div className="empty-state" style={{ padding: "2rem" }}><strong>لا توجد قيم مضافة بعد</strong><span>أضف أول قيمة من النموذج أعلاه.</span></div>}</section></>;
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
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const vehicleQuery = trpc.vehicles.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const driverQuery = trpc.drivers.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const maintenanceQuery = trpc.maintenance.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const documentQuery = trpc.documents.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const clientQuery = trpc.clients.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const claimQuery = trpc.claims.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const contractsQuery = trpc.contracts.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const paymentsQuery = trpc.payments.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { staleTime: 15000, enabled: Boolean(user) });
  const settingsQuery = trpc.settingsCatalog.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const auditQuery = trpc.audit.list.useQuery(undefined, { staleTime: 30000, enabled: Boolean(user) });
  const vehicleCreate = trpc.vehicles.create.useMutation();
  const vehicleUpdate = trpc.vehicles.update.useMutation();
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
  const contractArchive = trpc.contracts.archive.useMutation();
  const [active, setActive] = useState<ModuleKey>(() => { const path = window.location.pathname; if (path.includes("vehicle")) return "vehicles"; if (path.includes("maintenance")) return "maintenance"; if (path.includes("document")) return "documents"; if (path.includes("driver")) return "drivers"; if (path.includes("client")) return "clients"; if (path.includes("financial")) return "finance"; if (path.includes("setting")) return "settings"; return "dashboard"; });
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [commandOpen, setCommandOpen] = useState(false); const [modal, setModal] = useState<{ module: ModuleKey; row?: Row } | null>(null); const [detail, setDetail] = useState<{ module: ModuleKey; row: Row } | null>(null); const [driverDetail, setDriverDetail] = useState<Driver | null>(null); const [assignmentVehicle, setAssignmentVehicle] = useState<Vehicle | null>(null); const [assignmentDriver, setAssignmentDriver] = useState<Driver | null>(null); const [quickAction, setQuickAction] = useState<{ action: string; row: Row } | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [maintenance, setMaintenance] = useState<Maintenance[]>(initialMaintenance); const [documents, setDocuments] = useState<Document[]>(initialDocuments); const [clients, setClients] = useState<Client[]>(initialClients); const [contracts, setContracts] = useState<Contract[]>(initialContracts); const [claims, setClaims] = useState<Claim[]>(initialClaims);
  useEffect(() => { if (vehicleQuery.data) setVehicles(vehicleQuery.data as Vehicle[]); }, [vehicleQuery.data]);
  useEffect(() => { if (driverQuery.data?.length) setDrivers(driverQuery.data as Driver[]); }, [driverQuery.data]);
  useEffect(() => { if (maintenanceQuery.data?.length) setMaintenance(maintenanceQuery.data as Maintenance[]); }, [maintenanceQuery.data]);
  useEffect(() => { if (documentQuery.data?.length) setDocuments(documentQuery.data as Document[]); }, [documentQuery.data]);
  useEffect(() => { if (clientQuery.data?.length) setClients(clientQuery.data as Client[]); }, [clientQuery.data]);
  useEffect(() => { if (claimQuery.data?.length) setClaims(claimQuery.data as Claim[]); }, [claimQuery.data]);
  useEffect(() => { if (contractsQuery.data?.length) setContracts(contractsQuery.data as Contract[]); }, [contractsQuery.data]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); } if (e.key === "Escape") { setCommandOpen(false); setMobileOpen(false); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const onNavigate = (key: ModuleKey) => { setActive(key); setMobileOpen(false); navigate(key === "dashboard" ? "/dashboard" : `/dashboard/${key === "finance" ? "financial/contracts" : key}`); };
  const onAction = (action: string, row: Row) => {
    if (action === "view") setDetail({ module: active, row });
    else if (action === "edit") setModal({ module: active, row });
    else if (action === "assign" && active === "vehicles") setAssignmentVehicle(row as Vehicle);
    else if (action === "assign" && active === "drivers") setAssignmentDriver(row as Driver);
    else if (action === "archive") toast("هل تريد أرشفة هذا السجل؟", { action: { label: "تأكيد", onClick: () => { if (active === "vehicles") vehicleArchive.mutate({ id: row.id }, { onSuccess: () => { setVehicles(prev => prev.filter(v => v.id !== row.id)); utils.vehicles.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); } }); else if (active === "drivers") driverArchive.mutate({ id: row.id }, { onSuccess: () => { setDrivers(prev => prev.filter(item => item.id !== row.id)); utils.drivers.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة السائق: ${error.message}`) }); else if (active === "maintenance") maintenanceArchive.mutate({ id: row.id }, { onSuccess: () => { setMaintenance(prev => prev.filter(item => item.id !== row.id)); utils.maintenance.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة طلب الصيانة: ${error.message}`) }); else if (active === "documents") documentArchive.mutate({ id: row.id }, { onSuccess: () => { setDocuments(prev => prev.filter(item => item.id !== row.id)); utils.documents.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة المستند: ${error.message}`) }); else if (active === "clients") clientArchive.mutate({ id: row.id }, { onSuccess: () => { setClients(prev => prev.filter(item => item.id !== row.id)); utils.clients.list.invalidate(); toast.success("تمت الأرشفة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة العميل: ${error.message}`) }); else if (active === "finance" && String(row.ref || "").startsWith("CL-")) claimArchive.mutate({ id: row.id }, { onSuccess: () => { setClaims(prev => prev.filter(item => item.id !== row.id)); utils.claims.list.invalidate(); toast.success("تمت أرشفة المطالبة بنجاح"); }, onError: error => toast.error(`تعذر أرشفة المطالبة: ${error.message}`) }); else if (active === "finance") contractArchive.mutate({ id: row.id }, { onSuccess: () => { setContracts(prev => prev.filter(item => item.id !== row.id)); utils.contracts.list.invalidate(); toast.success("تمت أرشفة العقد بنجاح"); }, onError: error => toast.error(`تعذر أرشفة العقد: ${error.message}`) }); } }, cancel: { label: "إلغاء", onClick: () => {} } });
    else if (action === "maintenance") { setActive("maintenance"); setModal({ module: "maintenance", row: { vehicle: row.plate, id: Date.now() } }); navigate("/dashboard/maintenance"); }
    else if (["item", "cost", "status", "extend"].includes(action)) setQuickAction({ action, row });
    else if (action === "download") { if (active === "documents" && row.fileUrl) { const link = document.createElement("a"); link.href = String(row.fileUrl); link.download = String(row.fileName || row.name || "document"); link.target = "_blank"; link.click(); toast.success("تم فتح ملف المستند"); } else { const csv = Object.entries(row).filter(([key]) => key !== "id").map(([key, value]) => `${key},"${String(value ?? "").replaceAll('"', '""')}"`).join("\n"); const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${row.name || row.ref || row.plate || "record"}.csv`; link.click(); URL.revokeObjectURL(link.href); toast.success("تم تنزيل السجل"); } }
    else if (["contracts", "claims", "new-contract"].includes(action)) { onNavigate("finance"); if (action === "new-contract") setModal({ module: "finance" }); }
    else toast.info("هذا الإجراء يحتاج تحديد السجل أولًا");
  };
  const saveAssignment = (driver: Driver | null) => {
    if (!assignmentVehicle) return;
    const previous = vehicles.find(vehicle => vehicle.id === assignmentVehicle.id)?.driver || "—";
    const nextDriver = driver?.name || "—";
    setVehicles(prev => prev.map(vehicle => vehicle.id === assignmentVehicle.id ? { ...vehicle, driver: nextDriver } : vehicle));
    setDrivers(prev => prev.map(item => item.name === driver?.name ? { ...item, vehicle: assignmentVehicle.plate, status: "مشغول" } : item.name === previous || item.vehicle === assignmentVehicle.plate ? { ...item, vehicle: "—", status: "متاح" } : item));
    vehicleUpdate.mutate({ id: assignmentVehicle.id, data: { driver: nextDriver } }, { onSuccess: () => utils.vehicles.list.invalidate() });
    if (driver) driverUpdate.mutate({ id: driver.id, data: { vehicle: assignmentVehicle.plate, status: "مشغول" } }, { onSuccess: () => utils.drivers.list.invalidate() });
    setAssignmentVehicle(null); toast.success(driver ? `تم إسناد ${driver.name} إلى ${assignmentVehicle.plate}` : "تم إلغاء إسناد السائق");
  };
  const saveVehicleAssignment = (vehicle: Vehicle | null) => {
    if (!assignmentDriver) return;
    const previousVehicle = assignmentDriver.vehicle;
    const nextPlate = vehicle?.plate || "—";
    setDrivers(prev => prev.map(item => item.id === assignmentDriver.id ? { ...item, vehicle: nextPlate, status: vehicle ? "مشغول" : "متاح" } : item));
    setVehicles(prev => prev.map(item => item.plate === nextPlate ? { ...item, driver: assignmentDriver.name } : item.plate === previousVehicle ? { ...item, driver: "—" } : item));
    if (vehicle) {
      vehicleUpdate.mutate({ id: vehicle.id, data: { driver: assignmentDriver.name } }, { onSuccess: () => utils.vehicles.list.invalidate() });
      driverUpdate.mutate({ id: assignmentDriver.id, data: { vehicle: vehicle.plate, status: "مشغول" } }, { onSuccess: () => utils.drivers.list.invalidate() });
    } else {
      driverUpdate.mutate({ id: assignmentDriver.id, data: { vehicle: "—", status: "متاح" } }, { onSuccess: () => utils.drivers.list.invalidate() });
    }
    setAssignmentDriver(null); toast.success(vehicle ? `تم إسناد ${vehicle.plate} إلى ${assignmentDriver.name}` : "تم إلغاء إسناد المركبة");
  };
  const saveRecord = (data: Row) => {
    if (modal?.module === "drivers") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setDrivers(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Driver : item) : [saved as Driver, ...prev]); utils.drivers.list.invalidate(); };
      if (drivers.some(item => item.id === data.id)) driverUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل السائق: ${error.message}`) });
      else driverCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر إضافة السائق: ${error.message}`) });
      return;
    }
    if (modal?.module === "clients") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setClients(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Client : item) : [saved as Client, ...prev]); if (payload.contact && payload.phone && saved.id) representativeCreate.mutate({ clientId: saved.id, name: String(payload.contact), phone: String(payload.phone) }); utils.clients.list.invalidate(); };
      if (clients.some(item => item.id === data.id)) clientUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل العميل: ${error.message}`) });
      else clientCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر إضافة العميل: ${error.message}`) });
      return;
    }
    if (modal?.module === "maintenance") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setMaintenance(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Maintenance : item) : [saved as Maintenance, ...prev]); utils.maintenance.list.invalidate(); };
      if (maintenance.some(item => item.id === data.id)) maintenanceUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل طلب الصيانة: ${error.message}`) });
      else maintenanceCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر إنشاء طلب الصيانة: ${error.message}`) });
      return;
    }
    if (modal?.module === "documents") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setDocuments(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Document : item) : [saved as Document, ...prev]); utils.documents.list.invalidate(); };
      if (documents.some(item => item.id === data.id)) documentUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError: error => toast.error(`تعذر تعديل المستند: ${error.message}`) });
      else documentCreate.mutate(payload as any, { onSuccess, onError: error => toast.error(`تعذر حفظ المستند: ${error.message}`) });
      return;
    }
    if (modal?.module === "finance" && modal.row?.ref?.startsWith("CL-")) {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => { setClaims(prev => prev.some(item => item.id === saved.id) ? prev.map(item => item.id === saved.id ? saved as Claim : item) : [saved as Claim, ...prev]); utils.claims.list.invalidate(); };
      const claimPayload = { ...payload, clientId: clients.find(item => item.name === String(payload.client))?.id ?? null, contractId: contracts.find(item => item.ref === String(payload.contract))?.id ?? null } as any;
      if (claims.some(item => item.id === data.id)) claimUpdate.mutate({ id: data.id, data: claimPayload }, { onSuccess, onError: error => toast.error(`تعذر تعديل المطالبة: ${error.message}`) });
      else claimCreate.mutate(claimPayload, { onSuccess, onError: error => toast.error(`تعذر إنشاء المطالبة: ${error.message}`) });
      return;
    }
    if (modal?.module === "finance" && data.recordType === "payment") {
      const { id: _id, recordType: _recordType, ...payment } = data;
      const paymentPayload = { ...payment, amount: Number(payment.amount || 0), contractId: payment.contractId || null, claimId: payment.claimId || null, clientId: payment.clientId || null, paidAt: String(payment.paidAt), method: String(payment.method || "تحويل بنكي"), reference: String(payment.reference || "—") } as any;
      const onPaymentSuccess = () => { utils.payments.list.invalidate(); utils.contracts.list.invalidate(); utils.claims.list.invalidate(); toast.success(modal.row?.id ? "تم تعديل الدفعة المالية" : "تم تسجيل الدفعة المالية"); };
      if (modal.row?.id && (paymentsQuery.data ?? []).some(item => item.id === data.id)) paymentUpdate.mutate({ id: data.id, data: paymentPayload }, { onSuccess: onPaymentSuccess, onError: error => toast.error(`تعذر تعديل الدفعة: ${error.message}`) });
      else paymentCreate.mutate(paymentPayload, { onSuccess: onPaymentSuccess, onError: error => toast.error(`تعذر تسجيل الدفعة: ${error.message}`) });
      return;
    }
    if (modal?.module === "finance") {
      const { id: _id, ...contract } = data;
      if (modal.row) {
        contractUpdate.mutate({ id: data.id, data: { ...contract, items: (contract.items as any[])?.length ? (contract.items as any[]) : undefined } as any }, { onSuccess: saved => { setContracts(prev => prev.map(item => item.id === data.id ? { ...item, ...saved } as Contract : item)); utils.contracts.list.invalidate(); toast.success("تم حفظ تعديل العقد في قاعدة البيانات"); }, onError: error => toast.error(`تعذر تعديل العقد: ${error.message}`) });
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
          toast.success("تم حفظ العقد في قاعدة البيانات");
        },
        onError: error => toast.error(`تعذر حفظ العقد: ${error.message}`),
      });
      return;
    }
    if (modal?.module !== "vehicles") return;
    const { id: _id, ...payload } = data;
    const onSuccess = (saved: Row) => { setVehicles(prev => prev.some(v => v.id === saved.id) ? prev.map(v => v.id === saved.id ? saved as Vehicle : v) : [saved as Vehicle, ...prev]); utils.vehicles.list.invalidate(); };
    if (vehicles.some(v => v.id === data.id)) vehicleUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess });
    else vehicleCreate.mutate(payload as any, { onSuccess });
    setVehicles(prev => prev.some(v => v.id === data.id) ? prev.map(v => v.id === data.id ? data as Vehicle : v) : [data as Vehicle, ...prev]);
  };
  const content = active === "dashboard" ? <DashboardHome onNavigate={onNavigate} vehicles={vehicles} drivers={drivers} maintenance={maintenance} tasks={(tasksQuery.data ?? []) as Array<{ id: number; title: string; dueAt: string; status: string }>} notifications={(notificationsQuery.data ?? []) as Array<{ id: number; title: string; message: string; severity: string }>} onTaskToggle={task => { const nextStatus = task.status === "مكتملة" ? "مفتوحة" : "مكتملة"; taskUpdate.mutate({ id: task.id, data: { status: nextStatus } }, { onSuccess: () => { utils.tasks.list.invalidate(); toast.success("تم تحديث المهمة"); }, onError: error => toast.error(`تعذر تحديث المهمة: ${error.message}`) }); }} onTaskCreate={() => { const title = window.prompt("اكتب عنوان المهمة"); if (title?.trim()) taskCreate.mutate({ title: title.trim(), dueAt: "اليوم", status: "مفتوحة", assignee: user?.name || "—" }, { onSuccess: () => { utils.tasks.list.invalidate(); toast.success("تمت إضافة المهمة"); }, onError: error => toast.error(`تعذر إضافة المهمة: ${error.message}`) }); }} /> : active === "vehicles" ? <VehiclesPage vehicles={vehicles} setVehicles={setVehicles} onOpenForm={row => setModal({ module: "vehicles", row })} onAction={onAction} /> : active === "maintenance" ? <MaintenancePage maintenance={maintenance} onOpenForm={row => setModal({ module: "maintenance", row })} onAction={onAction} /> : active === "documents" ? <DocumentsPage documents={documents} onOpenForm={row => setModal({ module: "documents", row })} onAction={onAction} /> : active === "drivers" ? <DriversPage drivers={drivers} onOpenForm={row => setModal({ module: "drivers", row })} onAction={onAction} onView={setDriverDetail} /> : active === "clients" ? <ClientsPage clients={clients} onOpenForm={row => setModal({ module: "clients", row })} onAction={onAction} /> : active === "finance" ? <FinancePage contracts={contracts} claims={claims} payments={(paymentsQuery.data ?? []) as PaymentRow[]} onAction={onAction} onOpenForm={row => setModal({ module: "finance", row })} onPaymentArchive={payment => toast("سيتم إلغاء الدفعة وعكس أثرها المالي؟", { action: { label: "تأكيد", onClick: () => paymentArchive.mutate({ id: payment.id }, { onSuccess: () => { utils.payments.list.invalidate(); utils.contracts.list.invalidate(); utils.claims.list.invalidate(); toast.success("تم إلغاء الدفعة وعكس أثرها"); }, onError: error => toast.error(error.message) }) }, cancel: { label: "إلغاء", onClick: () => {} } })} /> : <SettingsPage settingsCount={(settingsQuery.data ?? []).length} auditLogs={(auditQuery.data ?? []) as Array<{ action: string; entityType: string; createdAt?: Date | string }>} />;
  if (authLoading) return <div className="auth-state" dir="rtl">جارٍ التحقق من صلاحية الدخول...</div>;
  if (!user) return <div className="auth-state" dir="rtl">جارٍ تحويلك إلى صفحة تسجيل الدخول...</div>;
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}><div className="sidebar-top"><Logo compact={collapsed} /><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="طي القائمة"><ChevronRight size={17} /></button></div><div className="workspace-switch"><span className="workspace-avatar">ز</span><div><strong>زيتي لإدارة الأسطول</strong><small>الحساب الرئيسي</small></div><ChevronDown size={15} /></div><nav>{navGroups.map(group => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(item => <button key={item.key} className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key as ModuleKey)}><item.icon size={18} /><span>{item.label}</span>{item.count && <em>{item.count}</em>}</button>)}</div>)}</nav><div className="sidebar-bottom"><button className="help-link" onClick={() => toast.success("فريق الدعم متاح لمساعدتك") }><Headphones size={17} /><span>مركز المساعدة</span></button><div className="sidebar-user"><span className="user-avatar">ع</span><div><strong>عبدالرحمن السالم</strong><small>مدير النظام</small></div><button onClick={() => toast.success("تم تسجيل الخروج من العرض التجريبي")} aria-label="تسجيل الخروج"><LogOut size={16} /></button></div></div></aside>
    {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
    <main className="main-area"><header className="topbar"><div className="topbar-start"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>الرئيسية</span><ChevronLeft size={14} /><strong>{active === "dashboard" ? "الإحصائيات" : navGroups.flatMap(g => g.items).find(i => i.key === active)?.label}</strong></div></div><div className="topbar-actions"><button className="quick-search" onClick={() => setCommandOpen(true)}><Search size={16} /><span>بحث سريع</span><kbd>⌘ K</kbd></button><button className="top-icon" onClick={() => { const first = notificationsQuery.data?.find(item => !item.readAt); toast(first ? `${first.title}: ${first.message}` : "لا توجد إشعارات جديدة", { icon: <Bell size={16} /> }); }}><Bell size={18} />{Boolean(notificationsQuery.data?.some(item => !item.readAt)) && <i />}</button><span className="top-divider" /><div className="top-profile"><span className="user-avatar">ع</span><div><strong>عبدالرحمن</strong><small>مدير النظام</small></div><ChevronDown size={14} /></div></div></header><div className="page-content">{content}</div><footer className="app-footer"><span>© ٢٠٢٦ زيتي بلس</span><span>آخر مزامنة منذ دقيقة</span><span className="online"><i /> النظام يعمل بشكل طبيعي</span></footer></main>
    {modal && <RecordForm module={modal.module} row={modal.row} onClose={() => setModal(null)} onSave={saveRecord} />}{driverDetail && <DriverVehiclesModal driver={driverDetail} vehicles={vehicles} onClose={() => setDriverDetail(null)} />}{assignmentVehicle && <AssignDriverModal vehicle={assignmentVehicle} drivers={drivers} onClose={() => setAssignmentVehicle(null)} onSave={saveAssignment} />}{assignmentDriver && <AssignVehicleModal driver={assignmentDriver} vehicles={vehicles} onClose={() => setAssignmentDriver(null)} onSave={saveVehicleAssignment} />}{quickAction && <QuickActionModal action={quickAction.action} row={quickAction.row} onClose={() => setQuickAction(null)} onSave={value => { if (quickAction.action === "status") { if (active === "maintenance") setMaintenance(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, status: value } : item)); if (active === "documents") setDocuments(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, status: value } : item)); if (active === "drivers") setDrivers(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, status: value } : item)); if (active === "finance") setContracts(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, status: value } : item)); } if (active === "documents" && quickAction.action === "extend") setDocuments(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, expiry: value, status: "ساري" } : item)); if (active === "maintenance" && quickAction.action === "cost") setMaintenance(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, cost: value } : item)); if (active === "maintenance" && quickAction.action === "item") setMaintenance(prev => prev.map(item => item.id === quickAction.row.id ? { ...item, type: `${item.type} · ${value}` } : item)); setQuickAction(null); toast.success("تم حفظ الإجراء"); }} />}{detail && <DetailModal module={detail.module} row={detail.row} onClose={() => setDetail(null)} onEdit={() => setModal({ module: detail.module, row: detail.row })} />}
    {commandOpen && <Modal title="البحث السريع" onClose={() => setCommandOpen(false)}><div className="command-search"><Search size={18} /><input autoFocus placeholder="ابحث عن مركبة، سائق، عميل أو إجراء..." /></div><div className="command-list"><button onClick={() => { onNavigate("vehicles"); setCommandOpen(false); }}><CarFront size={16} /><span>الانتقال إلى المركبات</span><kbd>↵</kbd></button><button onClick={() => { onNavigate("maintenance"); setCommandOpen(false); }}><Wrench size={16} /><span>فتح طلب صيانة جديد</span><kbd>↵</kbd></button><button onClick={() => { onNavigate("documents"); setCommandOpen(false); }}><FileText size={16} /><span>عرض المستندات المنتهية</span><kbd>↵</kbd></button></div></Modal>}
  </div>;
}
