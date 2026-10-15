import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatSAR, Badge, Modal, Field, FormActions } from "./common";
import type { SupplierRow } from "./types";
import {
  Building2,
  Plus,
  Search,
  Filter,
  FileText,
  Pencil,
  Archive,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Star,
  CheckCircle2,
  Clock,
  Printer,
  X,
  ExternalLink,
  Receipt,
  ArrowUpLeft,
} from "lucide-react";

export function SuppliersPage({ canManage = true }: { canManage?: boolean }) {
  const utils = trpc.useUtils();
  const suppliersQuery = trpc.suppliers.list.useQuery();
  const createMutation = trpc.suppliers.create.useMutation();
  const updateMutation = trpc.suppliers.update.useMutation();
  const archiveMutation = trpc.suppliers.archive.useMutation();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);

  const [statementSupplierId, setStatementSupplierId] = useState<number | null>(null);

  const suppliers = (suppliersQuery.data ?? []) as unknown as SupplierRow[];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch =
        search.trim() === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search)) ||
        (s.vatNumber && s.vatNumber.includes(search));

      const matchCategory =
        categoryFilter === "all" || s.category === categoryFilter;

      const matchStatus =
        statusFilter === "all" || s.status === statusFilter;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [suppliers, search, categoryFilter, statusFilter]);

  // KPIs
  const totalCount = suppliers.length;
  const partsSuppliersCount = suppliers.filter((s) => s.category === "قطع غيار").length;
  const workshopSuppliersCount = suppliers.filter((s) => s.category === "ورشة صيانة").length;
  const activeCount = suppliers.filter((s) => s.status === "نشط").length;

  const handleArchive = async (supplier: SupplierRow) => {
    if (!confirm(`هل أنت متأكد من رغبتك في أرشفة المورد «${supplier.name}»؟`)) return;
    try {
      await archiveMutation.mutateAsync({ id: supplier.id });
      toast.success(`تمت أرشفة المورد ${supplier.name} بنجاح`);
      utils.suppliers.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر أرشفة المورد");
    }
  };

  return (
    <div className="fleet-page-container" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>
                الموردون ومراكز الصيانة
              </h2>
              <p style={{ margin: "0.2rem 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                دليل الموردين والورش المعتمدة، متابعة أوامر الشراء وفواتير المستحقات، واستخراج كشوف الحسابات
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <button
            className="btn primary"
            onClick={() => {
              setEditingSupplier(null);
              setIsFormOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#2563eb",
              color: "#fff",
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 700,
            }}
          >
            <Plus size={18} />
            <span>إضافة مورد جديد</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="card" style={{ padding: "1.25rem", borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0" }}>
          <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>إجمالي الموردين</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1e293b", marginTop: "0.4rem" }}>
            {totalCount}
          </div>
          <div style={{ color: "#10b981", fontSize: "0.8rem", marginTop: "0.3rem" }}>
            {activeCount} مورد نشط حالياً
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0" }}>
          <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>موردو قطع الغيار</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#2563eb", marginTop: "0.4rem" }}>
            {partsSuppliersCount}
          </div>
          <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.3rem" }}>
            زيوت، إطارات وفلاتر
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0" }}>
          <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>ورش الصيانة المعتمدة</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f59e0b", marginTop: "0.4rem" }}>
            {workshopSuppliersCount}
          </div>
          <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.3rem" }}>
            مراكز إصلاح وميكانيكا
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0" }}>
          <div style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: 600 }}>حالة النشاط</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981", marginTop: "0.4rem" }}>
            {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100}%
          </div>
          <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.3rem" }}>
            نسبة الجاهزية والتعامل
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div
        className="card"
        style={{
          padding: "1rem",
          borderRadius: "12px",
          background: "#fff",
          border: "1px solid #e2e8f0",
          marginBottom: "1.25rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <Search size={18} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            className="input"
            placeholder="بحث بالاسم، الكود، الهاتف، أو الرقم الضريبي..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingRight: "2.5rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Filter size={16} color="#64748b" />
          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: "170px" }}
          >
            <option value="all">كل التصنيفات</option>
            <option value="قطع غيار">قطع غيار</option>
            <option value="ورشة صيانة">ورش صيانة</option>
            <option value="زيوت وفلاتر">زيوت وفلاتر</option>
            <option value="إطارات">إطارات</option>
            <option value="وقود">وقود ومحطات</option>
            <option value="تأمين">شركات تأمين</option>
            <option value="عام">عام</option>
          </select>

          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "130px" }}
          >
            <option value="all">كل الحالات</option>
            <option value="نشط">نشط</option>
            <option value="موقوف">موقوف</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>كود المورد</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>اسم المورد / الورشة</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>التصنيف</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>المسؤول والهاتف</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>الرقم الضريبي</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>شروط الدفع</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>التقييم</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569" }}>الحالة</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#475569", textAlign: "center" }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
                    {suppliersQuery.isLoading ? "جارٍ تحميل قائمة الموردين..." : "لا يوجد موردون مسجلون يطابقون شروط البحث"}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#2563eb" }}>
                      {s.code}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: "0.78rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "2px" }}>
                          <MapPin size={12} />
                          <span>{s.address}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span
                        style={{
                          background: s.category === "ورشة صيانة" ? "#fef3c7" : "#dbeafe",
                          color: s.category === "ورشة صيانة" ? "#b45309" : "#1e40af",
                          padding: "0.25rem 0.6rem",
                          borderRadius: "6px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        {s.category}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>{s.contactPerson || "—"}</div>
                      {s.phone && (
                        <div style={{ fontSize: "0.8rem", color: "#64748b", direction: "ltr", textAlign: "right" }}>
                          {s.phone}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#64748b" }}>
                      {s.vatNumber || "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#334155" }}>
                      {s.paymentTerms}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < (s.rating || 5) ? "#f59e0b" : "none"}
                            color={i < (s.rating || 5) ? "#f59e0b" : "#cbd5e1"}
                          />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span
                        style={{
                          background: s.status === "نشط" ? "#dcfce7" : "#fee2e2",
                          color: s.status === "نشط" ? "#15803d" : "#b91c1c",
                          padding: "0.25rem 0.6rem",
                          borderRadius: "6px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem" }}>
                        <button
                          className="btn-icon"
                          title="كشف حساب المورد"
                          onClick={() => setStatementSupplierId(s.id)}
                          style={{
                            background: "#f0fdf4",
                            color: "#16a34a",
                            border: "1px solid #bbf7d0",
                            borderRadius: "6px",
                            padding: "0.4rem 0.6rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          <FileText size={15} />
                          <span>كشف حساب</span>
                        </button>

                        {canManage && (
                          <>
                            <button
                              className="btn-icon"
                              title="تعديل المورد"
                              onClick={() => {
                                setEditingSupplier(s);
                                setIsFormOpen(true);
                              }}
                              style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                padding: "0.4rem",
                                cursor: "pointer",
                              }}
                            >
                              <Pencil size={15} color="#475569" />
                            </button>

                            <button
                              className="btn-icon"
                              title="أرشفة"
                              onClick={() => handleArchive(s)}
                              style={{
                                background: "#fff1f2",
                                border: "1px solid #fecdd3",
                                borderRadius: "6px",
                                padding: "0.4rem",
                                cursor: "pointer",
                              }}
                            >
                              <Archive size={15} color="#e11d48" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Form Modal */}
      {isFormOpen && (
        <SupplierFormModal
          supplier={editingSupplier}
          onClose={() => {
            setIsFormOpen(false);
            setEditingSupplier(null);
          }}
          onSuccess={() => {
            setIsFormOpen(false);
            setEditingSupplier(null);
            utils.suppliers.list.invalidate();
          }}
        />
      )}

      {/* Supplier Statement Modal */}
      {statementSupplierId !== null && (
        <SupplierStatementModal
          supplierId={statementSupplierId}
          onClose={() => setStatementSupplierId(null)}
        />
      )}
    </div>
  );
}

// Form Modal
function SupplierFormModal({
  supplier,
  onClose,
  onSuccess,
}: {
  supplier: SupplierRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createMutation = trpc.suppliers.create.useMutation();
  const updateMutation = trpc.suppliers.update.useMutation();

  const [name, setName] = useState(supplier?.name || "");
  const [code, setCode] = useState(supplier?.code || "");
  const [category, setCategory] = useState(supplier?.category || "قطع غيار");
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [email, setEmail] = useState(supplier?.email || "");
  const [vatNumber, setVatNumber] = useState(supplier?.vatNumber || "");
  const [crNumber, setCrNumber] = useState(supplier?.crNumber || "");
  const [address, setAddress] = useState(supplier?.address || "");
  const [paymentTerms, setPaymentTerms] = useState(supplier?.paymentTerms || "آجل 30 يوم");
  const [bankName, setBankName] = useState(supplier?.bankName || "");
  const [iban, setIban] = useState(supplier?.iban || "");
  const [rating, setRating] = useState(supplier?.rating || 5);
  const [status, setStatus] = useState<"نشط" | "موقوف">(supplier?.status || "نشط");
  const [notes, setNotes] = useState(supplier?.notes || "");

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("يرجى إدخال اسم المورد أو الورشة");
      return;
    }

    setSaving(true);
    try {
      if (supplier) {
        await updateMutation.mutateAsync({
          id: supplier.id,
          data: {
            name,
            code: code || undefined,
            category,
            contactPerson: contactPerson || undefined,
            phone: phone || undefined,
            email: email || undefined,
            vatNumber: vatNumber || undefined,
            crNumber: crNumber || undefined,
            address: address || undefined,
            paymentTerms,
            bankName: bankName || undefined,
            iban: iban || undefined,
            rating,
            status,
            notes: notes || undefined,
          },
        });
        toast.success("تم تحديث بيانات المورد بنجاح");
      } else {
        await createMutation.mutateAsync({
          name,
          code: code || undefined,
          category,
          contactPerson: contactPerson || undefined,
          phone: phone || undefined,
          email: email || undefined,
          vatNumber: vatNumber || undefined,
          crNumber: crNumber || undefined,
          address: address || undefined,
          paymentTerms,
          bankName: bankName || undefined,
          iban: iban || undefined,
          rating,
          status,
          notes: notes || undefined,
        });
        toast.success("تم تسجيل المورد الجديد بنجاح");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ بيانات المورد");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={supplier ? `تعديل المورد: ${supplier.name}` : "تسجيل مورد / ورشة جديدة"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="field">
            <span>اسم المورد أو الورشة *</span>
            <input
              type="text"
              className="input"
              placeholder="مثال: شركة النجم لقطع الغيار"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>التصنيف</span>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="قطع غيار">قطع غيار</option>
              <option value="ورشة صيانة">ورشة صيانة</option>
              <option value="زيوت وفلاتر">زيوت وفلاتر</option>
              <option value="إطارات">إطارات</option>
              <option value="وقود">وقود ومحطات</option>
              <option value="تأمين">شركات تأمين</option>
              <option value="عام">عام</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="field">
            <span>كود المورد (اختياري)</span>
            <input
              type="text"
              className="input"
              placeholder="يُترك فارغاً للتوليد التلقائي SUP-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>

          <label className="field">
            <span>حالة التعامل</span>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as "نشط" | "موقوف")}
            >
              <option value="نشط">نشط</option>
              <option value="موقوف">موقوف</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="field">
            <span>الشخص المسؤول</span>
            <input
              type="text"
              className="input"
              placeholder="اسم مندوب أو مدير المبيعات"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </label>

          <label className="field">
            <span>رقم الجوال / الهاتف</span>
            <input
              type="text"
              className="input"
              placeholder="05XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="field">
            <span>الرقم الضريبي (15 رقم)</span>
            <input
              type="text"
              className="input"
              placeholder="3XXXXXXXXXXXXXX"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              dir="ltr"
            />
          </label>

          <label className="field">
            <span>رقم السجل التجاري</span>
            <input
              type="text"
              className="input"
              placeholder="10XXXXXXXX"
              value={crNumber}
              onChange={(e) => setCrNumber(e.target.value)}
              dir="ltr"
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="field">
            <span>شروط وطريقة الدفع</span>
            <select
              className="input"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            >
              <option value="آجل 30 يوم">آجل 30 يوم</option>
              <option value="آجل 60 يوم">آجل 60 يوم</option>
              <option value="نقدي فوري">نقدي فوري</option>
              <option value="تحويل بنكي عند الاستلام">تحويل بنكي عند الاستلام</option>
              <option value="دفعة مقدمة والباقي آجل">دفعة مقدمة والباقي آجل</option>
            </select>
          </label>

          <label className="field">
            <span>التقييم (1 - 5 نجوم)</span>
            <select
              className="input"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              <option value={5}>⭐⭐⭐⭐⭐ (ممتاز - 5)</option>
              <option value={4}>⭐⭐⭐⭐ (جيد جداً - 4)</option>
              <option value={3}>⭐⭐⭐ (متوسط - 3)</option>
              <option value={2}>⭐⭐ (مقبول - 2)</option>
              <option value={1}>⭐ (ضعيف - 1)</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="field">
            <span>اسم البنك</span>
            <input
              type="text"
              className="input"
              placeholder="مثال: مصرف الراجحي"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </label>

          <label className="field">
            <span>رقم الآيبان (IBAN)</span>
            <input
              type="text"
              className="input"
              placeholder="SA..."
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              dir="ltr"
            />
          </label>
        </div>

        <label className="field">
          <span>العنوان / المدينة</span>
          <input
            type="text"
            className="input"
            placeholder="مثال: الرياض - صناعية الدائري مخرج 18"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <label className="field">
          <span>ملاحظات</span>
          <textarea
            className="input"
            rows={2}
            placeholder="أي تفاصيل أو اتفاقيات أسعار خاصة بهذا المورد..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <FormActions
          onCancel={onClose}
          label={saving ? "جارٍ الحفظ..." : supplier ? "تحديث المورد" : "تسجيل المورد"}
        />
      </form>
    </Modal>
  );
}

// Statement Modal
function SupplierStatementModal({
  supplierId,
  onClose,
}: {
  supplierId: number;
  onClose: () => void;
}) {
  const statementQuery = trpc.suppliers.statement.useQuery({ id: supplierId });
  const data = statementQuery.data;

  if (statementQuery.isLoading) {
    return (
      <Modal title="كشف حساب المورد" onClose={onClose}>
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
          جارٍ تحميل وتجميع حركات وفواتير المورد...
        </div>
      </Modal>
    );
  }

  if (!data || !data.supplier) {
    return (
      <Modal title="كشف حساب المورد" onClose={onClose}>
        <div style={{ padding: "2rem", textAlign: "center", color: "#e11d48" }}>
          تعذر العثور على بيانات المورد
        </div>
      </Modal>
    );
  }

  const { supplier, totalInvoiced, totalPaid, outstandingBalance, timeline } = data;

  let runningBalance = 0;
  const chronologicalTimeline = [...timeline].reverse().map((item) => {
    if (item.type === "فاتورة") {
      runningBalance += item.amount;
    } else {
      runningBalance -= item.amount;
    }
    return { ...item, balanceAfter: runningBalance };
  }).reverse();

  return (
    <Modal title={`كشف حساب المورد: ${supplier.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Supplier Info Bar */}
        <div
          style={{
            background: "#f8fafc",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            fontSize: "0.88rem",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b" }}>{supplier.name}</div>
            <div style={{ color: "#64748b", marginTop: "2px" }}>كود: {supplier.code} · تصنيف: {supplier.category}</div>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            <div>
              <span style={{ color: "#64748b" }}>الرقم الضريبي: </span>
              <strong>{supplier.vatNumber || "غير مسجل"}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>الهاتف: </span>
              <strong dir="ltr">{supplier.phone || "—"}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>شروط الدفع: </span>
              <strong>{supplier.paymentTerms}</strong>
            </div>
          </div>
        </div>

        {/* Statement Summary KPI */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "1rem", borderRadius: "8px" }}>
            <div style={{ color: "#1e40af", fontSize: "0.8rem", fontWeight: 700 }}>إجمالي الفواتير الصادرة</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e3a8a", marginTop: "0.3rem" }}>
              {formatSAR(totalInvoiced)}
            </div>
          </div>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "1rem", borderRadius: "8px" }}>
            <div style={{ color: "#15803d", fontSize: "0.8rem", fontWeight: 700 }}>إجمالي المدفوعات المسددة</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#14532d", marginTop: "0.3rem" }}>
              {formatSAR(totalPaid)}
            </div>
          </div>

          <div
            style={{
              background: outstandingBalance > 0 ? "#fff1f2" : "#f8fafc",
              border: `1.5px solid ${outstandingBalance > 0 ? "#fecdd3" : "#e2e8f0"}`,
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: outstandingBalance > 0 ? "#be123c" : "#475569", fontSize: "0.8rem", fontWeight: 700 }}>
              الرصيد المستحق القائم
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: outstandingBalance > 0 ? "#9f1239" : "#0f172a",
                marginTop: "0.3rem",
              }}
            >
              {formatSAR(outstandingBalance)}
            </div>
          </div>
        </div>

        {/* Timeline Table */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1rem", background: "#f8fafc", fontWeight: 700, fontSize: "0.9rem", borderBottom: "1px solid #e2e8f0" }}>
            حركات وفواتير الحساب ({chronologicalTimeline.length})
          </div>
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "right" }}>
                  <th style={{ padding: "0.6rem 0.8rem" }}>التاريخ</th>
                  <th style={{ padding: "0.6rem 0.8rem" }}>النوع</th>
                  <th style={{ padding: "0.6rem 0.8rem" }}>المرجع</th>
                  <th style={{ padding: "0.6rem 0.8rem" }}>البيان / الوصف</th>
                  <th style={{ padding: "0.6rem 0.8rem" }}>المبلغ</th>
                  <th style={{ padding: "0.6rem 0.8rem" }}>الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody>
                {chronologicalTimeline.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      لا توجد فواتير أو مدفوعات مسجلة لهذا المورد حتى الآن
                    </td>
                  </tr>
                ) : (
                  chronologicalTimeline.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.6rem 0.8rem" }}>{item.date}</td>
                      <td style={{ padding: "0.6rem 0.8rem" }}>
                        <span
                          style={{
                            background: item.type === "فاتورة" ? "#eff6ff" : "#f0fdf4",
                            color: item.type === "فاتورة" ? "#1e40af" : "#15803d",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.8rem", fontWeight: 600 }}>{item.reference}</td>
                      <td style={{ padding: "0.6rem 0.8rem", color: "#475569" }}>{item.description}</td>
                      <td
                        style={{
                          padding: "0.6rem 0.8rem",
                          fontWeight: 700,
                          color: item.type === "فاتورة" ? "#1e293b" : "#16a34a",
                        }}
                      >
                        {item.type === "دفعة مسددة" ? `(${formatSAR(item.amount)})` : formatSAR(item.amount)}
                      </td>
                      <td style={{ padding: "0.6rem 0.8rem", fontWeight: 700, color: item.balanceAfter > 0 ? "#dc2626" : "#1e293b" }}>
                        {formatSAR(item.balanceAfter)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            className="btn outline"
            onClick={() => window.print()}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Printer size={16} />
            <span>طباعة كشف الحساب</span>
          </button>
          <button className="btn primary" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}
