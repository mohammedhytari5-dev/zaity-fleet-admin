import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Award,
  Sparkles,
  Download,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Zap,
  Printer,
  ArrowUpLeft,
  Eye,
} from "lucide-react";
import { DocumentPreviewModal } from "./common";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";

type ModuleKey = string;

interface PurchaseRequestRow {
  id: number;
  ref: string;
  department: string;
  category: string;
  purpose: string;
  priority: "عادي" | "متوسط" | "عاجل" | "طارئ";
  estimatedBudget: number;
  status: "جديد" | "بانتظار العروض" | "قيد المقارنة" | "معتمد" | "أمر شراء صادر" | "مرفوض" | "مكتمل";
  requestedByName: string;
  selectedQuoteId?: number | null;
  approvalNotes?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

interface PurchaseQuoteRow {
  id: number;
  requestId: number;
  supplierName: string;
  supplierVat?: string | null;
  supplierPhone?: string | null;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  totalAmount: number;
  deliveryDays: number;
  warrantyPeriod: string;
  supplierRating: number;
  quoteFileUrl?: string | null;
  quoteFileName?: string | null;
  notes?: string | null;
  isSelected: number;
  selectionReason?: string | null;
}

export function ProcurementPage({ canApproveFinance }: { canApproveFinance: boolean }) {
  const utils = trpc.useUtils();
  const requestsQuery = trpc.procurement.listRequests.useQuery(undefined, { staleTime: 10000 });
  const createRequestMutation = trpc.procurement.createRequest.useMutation();
  const archiveRequestMutation = trpc.procurement.archiveRequest.useMutation();

  const [activeTab, setActiveTab] = useState<string>("الكل");
  const [search, setSearch] = useState("");
  const [newRequestModal, setNewRequestModal] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PurchaseRequestRow | null>(null);

  const [form, setForm] = useState({
    ref: `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    department: "الصيانة",
    category: "قطع غيار",
    purpose: "",
    priority: "عادي" as const,
    estimatedBudget: 0,
  });

  const list = (requestsQuery.data ?? []) as unknown as PurchaseRequestRow[];

  const filtered = list.filter(item => {
    const matchesSearch =
      item.ref.toLowerCase().includes(search.toLowerCase()) ||
      item.purpose.toLowerCase().includes(search.toLowerCase()) ||
      item.department.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "الكل" || item.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalBudget = list.reduce((sum, item) => sum + (item.estimatedBudget || 0), 0);
  const pendingQuotesCount = list.filter(item => item.status === "جديد" || item.status === "قيد المقارنة").length;
  const approvedCount = list.filter(item => item.status === "معتمد" || item.status === "أمر شراء صادر").length;

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.purpose.trim()) {
      toast.error("يرجى توضيح الغرض من الشراء والمواصفات");
      return;
    }
    try {
      await createRequestMutation.mutateAsync(form);
      toast.success("تم إنشاء طلب الشراء بنجاح");
      setNewRequestModal(false);
      setForm({
        ref: `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        department: "الصيانة",
        category: "قطع غيار",
        purpose: "",
        priority: "عادي",
        estimatedBudget: 0,
      });
      void utils.procurement.listRequests.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر إنشاء طلب الشراء");
    }
  };

  const handleArchive = (req: PurchaseRequestRow) => {
    toast(`هل أنت متأكد من حذف أو إلغاء طلب الشراء ${req.ref}؟`, {
      action: {
        label: "تأكيد الإلغاء",
        onClick: () => {
          archiveRequestMutation.mutate(
            { id: req.id },
            {
              onSuccess: () => {
                toast.success("تم إلغاء طلب الشراء");
                void utils.procurement.listRequests.invalidate();
                if (activeRequest?.id === req.id) setActiveRequest(null);
              },
              onError: err => toast.error(err.message),
            }
          );
        },
      },
      cancel: { label: "تراجع", onClick: () => {} },
    });
  };

  const issuePoMutation = trpc.procurement.issuePoAndPayable.useMutation();
  const [poPrintData, setPoPrintData] = useState<{ request: PurchaseRequestRow; quote: PurchaseQuoteRow } | null>(null);

  const handleQuickIssuePo = async (req: PurchaseRequestRow) => {
    try {
      await issuePoMutation.mutateAsync({ requestId: req.id });
      toast.success(`تم إصدار أمر الشراء PO للطلب ${req.ref} وترحيل فاتورة المورد إلى قسم المستحقات علينا بنجاح!`);
      void utils.procurement.listRequests.invalidate();
      void utils.payables.list.invalidate();
    } catch (err: any) {
      toast.error(err.message || "تعذر ترحيل الطلب إلى المستحقات");
    }
  };

  const handleOpenPoPrintForRequest = async (req: PurchaseRequestRow) => {
    try {
      const quotes = await utils.procurement.listQuotes.fetch({ requestId: req.id });
      const winning = quotes?.find(q => q.id === req.selectedQuoteId || q.isSelected === 1);
      if (!winning) {
        toast.warning("لم يتم العثور على عرض السعر المعتمد لهذا الطلب");
        return;
      }
      setPoPrintData({ request: req, quote: winning as unknown as PurchaseQuoteRow });
    } catch {
      toast.error("تعذر تحميل بيانات أمر الشراء");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">التشغيل والمشتريات / حوكمة التوريد</span>
          <h2>المشتريات وعروض الأسعار</h2>
          <p>إدارة طلبات الشراء (PR) ومقارنة عروض الأسعار الثلاثة واختيار العرض الأنسب المعتمد.</p>
        </div>
        <div style={{ display: "flex", gap: ".5rem" }}>
          <button className="btn primary" onClick={() => setNewRequestModal(true)}>
            <Plus size={16} /> طلب شراء جديد
          </button>
        </div>
      </div>

      <div className="quick-metrics">
        <div>
          <span>إجمالي الطلبات</span>
          <strong>{list.length.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>قيد التسعير والمقارنة</span>
          <strong className="amber-text">{pendingQuotesCount.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>طلبات معتمدة</span>
          <strong className="green-text">{approvedCount.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>إجمالي الميزانيات التقديرية</span>
          <strong>{totalBudget.toLocaleString("en-US")} SAR</strong>
        </div>
      </div>

      <div className="table-shell surface">
        <div className="table-toolbar">
          <div className="search-wrap">
            <input
              type="search"
              placeholder="ابحث بالرقم، الغرض، القسم، التصنيف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="tabs">
            {["الكل", "جديد", "قيد المقارنة", "معتمد", "أمر شراء صادر", "مرفوض"].map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>القسم والتصنيف</th>
                <th>الغرض / البند المطلوب</th>
                <th>الأولوية</th>
                <th>الميزانية التقديرية</th>
                <th>مقدم الطلب</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted-fg)" }}>
                    لا توجد طلبات شراء مسجلة حالياً
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong className="table-primary">{item.ref}</strong>
                      <small>{String(item.createdAt || "").slice(0, 10)}</small>
                    </td>
                    <td>
                      <strong>{item.department}</strong>
                      <small>{item.category}</small>
                    </td>
                    <td style={{ maxWidth: "260px" }}>
                      <span title={item.purpose}>{item.purpose}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.priority === "طارئ" || item.priority === "عاجل"
                            ? "red"
                            : item.priority === "متوسط"
                            ? "amber"
                            : "gray"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <strong>{item.estimatedBudget > 0 ? `${item.estimatedBudget.toLocaleString("en-US")} SAR` : "غير محدد"}</strong>
                    </td>
                    <td>{item.requestedByName}</td>
                    <td>
                      <span
                        className={`badge ${
                          item.status === "معتمد" || item.status === "أمر شراء صادر"
                            ? "green"
                            : item.status === "قيد المقارنة" || item.status === "جديد"
                            ? "amber"
                            : "gray"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn outline"
                        style={{ padding: ".35rem .75rem", fontSize: ".85rem" }}
                        onClick={() => setActiveRequest(item)}
                      >
                        <Award size={14} /> محضر المقارنة
                      </button>
                      {(item.status === "معتمد" || item.status === "أمر شراء صادر") && (
                        <button
                          className="btn outline"
                          style={{ padding: ".35rem .75rem", fontSize: ".85rem", color: "var(--teal-dark)" }}
                          onClick={() => void handleOpenPoPrintForRequest(item)}
                          title="عرض وطباعة أمر الشراء الرسمي"
                        >
                          <Printer size={14} /> أمر الشراء PO
                        </button>
                      )}
                      {item.status === "معتمد" && canApproveFinance && (
                        <button
                          className="btn outline"
                          style={{ padding: ".35rem .75rem", fontSize: ".85rem", color: "#059669", borderColor: "#a7f3d0" }}
                          disabled={issuePoMutation.isPending}
                          onClick={() => void handleQuickIssuePo(item)}
                          title="تحويل إلى فاتورة مورد في قسم المستحقات"
                        >
                          <ArrowUpLeft size={14} /> ترحيل للمستحقات
                        </button>
                      )}
                      <button
                        className="row-menu-btn danger"
                        title="إلغاء الطلب"
                        onClick={() => handleArchive(item)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال إنشاء طلب شراء جديد */}
      {newRequestModal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNewRequestModal(false); }}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h3>إنشاء طلب شراء جديد (Purchase Request)</h3>
                <p>أدخل بيانات الاحتياج والمواصفات للبدء في طلب واستقبال عروض الأسعار.</p>
              </div>
              <button className="icon-btn" onClick={() => setNewRequestModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateRequest}>
                <div className="form-grid">
                  <label className="field">
                    <span>رقم الطلب المرجعي *</span>
                    <input
                      type="text"
                      value={form.ref}
                      onChange={e => setForm({ ...form, ref: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>القسم الطالب *</span>
                    <select
                      value={form.department}
                      onChange={e => setForm({ ...form, department: e.target.value })}
                    >
                      <option>الصيانة</option>
                      <option>التشغيل والحركة</option>
                      <option>الإدارة العامة</option>
                      <option>تقنية المعلومات</option>
                      <option>المخزون</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>تصنيف المشتريات *</span>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                    >
                      <option>قطع غيار</option>
                      <option>زيوت وفلاتر</option>
                      <option>إطارات وبطاريات</option>
                      <option>خدمات ورش خارجية</option>
                      <option>أدوات ومعدات ورشة</option>
                      <option>قرطاسية ومستلزمات</option>
                      <option>أخرى</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>درجة الأولوية *</span>
                    <select
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value as any })}
                    >
                      <option>عادي</option>
                      <option>متوسط</option>
                      <option>عاجل</option>
                      <option>طارئ</option>
                    </select>
                  </label>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>الميزانية التقديرية (اختياري بالريال SAR)</span>
                    <input
                      type="number"
                      value={form.estimatedBudget || ""}
                      onChange={e => setForm({ ...form, estimatedBudget: Number(e.target.value) || 0 })}
                      placeholder="مثال: 5000"
                    />
                  </label>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>الغرض والمواصفات المطلوبة بالتفصيل *</span>
                    <textarea
                      rows={3}
                      value={form.purpose}
                      onChange={e => setForm({ ...form, purpose: e.target.value })}
                      placeholder="مثال: طلب شراء 10 أطقم فحمات فرامل وبطاريات لحافلات مشروع نقل الرياض..."
                      required
                    />
                  </label>
                </div>
                <div className="form-actions" style={{ marginTop: "1.25rem" }}>
                  <button className="btn primary" type="submit" disabled={createRequestMutation.isPending}>
                    {createRequestMutation.isPending ? "جارٍ الحفظ…" : "إنشاء الطلب"}
                  </button>
                  <button className="btn ghost" type="button" onClick={() => setNewRequestModal(false)}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* مودال محضر مقارنة عروض الأسعار 3-Quotes Comparison */}
      {activeRequest && (
        <QuoteComparisonModal
          request={activeRequest}
          canApproveFinance={canApproveFinance}
          onClose={() => setActiveRequest(null)}
          onRefresh={() => void utils.procurement.listRequests.invalidate()}
        />
      )}

      {/* مودال طباعة أمر الشراء الرسمي (PO) */}
      {poPrintData && (
        <PurchaseOrderPrintModal
          request={poPrintData.request}
          quote={poPrintData.quote}
          onClose={() => setPoPrintData(null)}
        />
      )}
    </>
  );
}

/**
 * نافذة مقارنة عروض الأسعار (محضر المقارنة واختيار المورد الفائز)
 */
function QuoteComparisonModal({
  request,
  canApproveFinance,
  onClose,
  onRefresh,
}: {
  request: PurchaseRequestRow;
  canApproveFinance: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const quotesQuery = trpc.procurement.listQuotes.useQuery({ requestId: request.id });
  const suppliersQuery = trpc.suppliers.list.useQuery(undefined, { staleTime: 30000 });
  const createQuoteMutation = trpc.procurement.createQuote.useMutation();
  const selectQuoteMutation = trpc.procurement.selectQuote.useMutation();
  const deleteQuoteMutation = trpc.procurement.deleteQuote.useMutation();

  const [addQuoteOpen, setAddQuoteOpen] = useState(false);
  const [awardModal, setAwardModal] = useState<PurchaseQuoteRow | null>(null);
  const [awardReason, setAwardReason] = useState("السعر الأقل مع مطابقة المواصفات وسرعة التوريد");
  const [poPrintOpen, setPoPrintOpen] = useState(false);
  const [previewQuoteDoc, setPreviewQuoteDoc] = useState<{
    url: string;
    name: string;
    title: string;
    entity: string;
  } | null>(null);
  const issuePoMutation = trpc.procurement.issuePoAndPayable.useMutation();

  const handleIssuePoAndPayable = async () => {
    try {
      await issuePoMutation.mutateAsync({ requestId: request.id });
      toast.success("تم إصدار أمر الشراء PO وتحويل فاتورة المورد إلى قسم المستحقات علينا بنجاح!");
      void utils.procurement.listRequests.invalidate();
      void utils.payables.list.invalidate();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "تعذر ترحيل الطلب إلى المستحقات");
    }
  };

  const [quoteForm, setQuoteForm] = useState({
    supplierId: null as number | null,
    supplierName: "",
    supplierPhone: "",
    supplierVat: "",
    itemDescription: request.purpose,
    quantity: 1,
    unitPrice: 0,
    deliveryDays: 3,
    warrantyPeriod: "سنة واحدة",
    supplierRating: 4,
    notes: "",
    quoteFileUrl: "" as string | undefined,
    quoteFileName: "" as string | undefined,
  });

  const quotes = (quotesQuery.data ?? []) as unknown as PurchaseQuoteRow[];
  const winningQuote = quotes.find(q => q.isSelected === 1 || q.id === request.selectedQuoteId);

  const minPrice = quotes.length > 0 ? Math.min(...quotes.map(q => q.totalAmount).filter(p => p > 0)) : 0;
  const minDelivery = quotes.length > 0 ? Math.min(...quotes.map(q => q.deliveryDays).filter(d => d > 0)) : 0;

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteForm.supplierName.trim()) {
      toast.error("يرجى إدخال اسم المورد");
      return;
    }
    const unitPrice = Math.max(0, quoteForm.unitPrice);
    const quantity = Math.max(1, quoteForm.quantity);
    const subtotal = unitPrice * quantity;
    const taxAmount = Math.round(subtotal * 0.15);
    const totalAmount = subtotal + taxAmount;

    try {
      await createQuoteMutation.mutateAsync({
        requestId: request.id,
        supplierId: quoteForm.supplierId || undefined,
        supplierName: quoteForm.supplierName,
        supplierPhone: quoteForm.supplierPhone || "—",
        supplierVat: quoteForm.supplierVat || "—",
        itemDescription: quoteForm.itemDescription || request.purpose,
        quantity,
        unitPrice,
        taxAmount,
        totalAmount,
        deliveryDays: quoteForm.deliveryDays || 3,
        warrantyPeriod: quoteForm.warrantyPeriod || "لا يوجد",
        supplierRating: quoteForm.supplierRating || 4,
        notes: quoteForm.notes,
        quoteFileUrl: quoteForm.quoteFileUrl || undefined,
        quoteFileName: quoteForm.quoteFileName || undefined,
      });
      toast.success("تمت إضافة عرض السعر للمحضر");
      setAddQuoteOpen(false);
      setQuoteForm({
        supplierId: null,
        supplierName: "",
        supplierPhone: "",
        supplierVat: "",
        itemDescription: request.purpose,
        quantity: 1,
        unitPrice: 0,
        deliveryDays: 3,
        warrantyPeriod: "سنة واحدة",
        supplierRating: 4,
        notes: "",
        quoteFileUrl: "",
        quoteFileName: "",
      });
      void utils.procurement.listQuotes.invalidate({ requestId: request.id });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "تعذر حفظ عرض السعر");
    }
  };

  const handleAwardQuote = async () => {
    if (!awardModal) return;
    try {
      await selectQuoteMutation.mutateAsync({
        requestId: request.id,
        quoteId: awardModal.id,
        selectionReason: awardReason,
      });
      toast.success(`تم اعتماد عرض ${awardModal.supplierName} وإصدار الموافقة`);
      setAwardModal(null);
      void utils.procurement.listQuotes.invalidate({ requestId: request.id });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "تعذر اعتماد عرض السعر");
    }
  };

  const handleDeleteQuote = (quoteId: number) => {
    toast("هل ترغب بحذف هذا العرض من المحضر؟", {
      action: {
        label: "حذف",
        onClick: () => {
          deleteQuoteMutation.mutate(
            { id: quoteId },
            {
              onSuccess: () => {
                toast.success("تم حذف العرض");
                void utils.procurement.listQuotes.invalidate({ requestId: request.id });
                onRefresh();
              },
              onError: err => toast.error(err.message),
            }
          );
        },
      },
      cancel: { label: "إلغاء", onClick: () => {} },
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card wide" role="dialog" aria-modal="true" style={{ maxWidth: "1050px" }}>
        <div className="modal-head">
          <div>
            <h3>محضر مقارنة عروض الأسعار · {request.ref}</h3>
            <p>
              {request.department} · {request.category} · {request.purpose}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* كرت حالة الاعتماد الحالية والإجراءات المترتبة عليها */}
          {(request.status === "معتمد" || request.status === "أمر شراء صادر") && (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.28)",
                borderRadius: ".75rem",
                padding: "1.1rem 1.3rem",
                marginBottom: "1.2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <CheckCircle2 size={26} style={{ color: "#10b981", flexShrink: 0 }} />
                <div>
                  <strong style={{ color: "#065f46", fontSize: "1.05rem" }}>
                    {request.status === "أمر شراء صادر"
                      ? "تم إصدار أمر الشراء (PO) وترحيل الفاتورة إلى قسم المستحقات علينا بنجاح"
                      : `تم اعتماد الترسية بنجاح بواسطة ${request.approvedByName || "الإدارة المالية"}`}
                  </strong>
                  <p style={{ margin: "0.25rem 0 0", fontSize: ".85rem", color: "#047857" }}>
                    {winningQuote
                      ? `المورد المعتمد: ${winningQuote.supplierName} · القيمة الإجمالية: ${winningQuote.totalAmount.toLocaleString("en-US")} SAR`
                      : request.approvalNotes || "العرض الأنسب"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: ".6rem" }}>
                {request.status === "معتمد" && canApproveFinance && (
                  <button
                    className="btn primary"
                    style={{ padding: ".45rem .9rem", fontSize: ".85rem", background: "#059669" }}
                    onClick={() => void handleIssuePoAndPayable()}
                    disabled={issuePoMutation.isPending}
                  >
                    <ArrowUpLeft size={15} />
                    <span>{issuePoMutation.isPending ? "جارٍ الترحيل..." : "تحويل إلى فاتورة مورد (المستحقات)"}</span>
                  </button>
                )}
                {winningQuote && (
                  <button
                    className="btn outline"
                    style={{ padding: ".45rem .9rem", fontSize: ".85rem", background: "#fff", color: "var(--teal-dark)" }}
                    onClick={() => setPoPrintOpen(true)}
                  >
                    <Printer size={15} />
                    <span>طباعة أمر الشراء (PO)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <strong style={{ fontSize: "1.05rem" }}>
                العروض المقدمة ({quotes.length} من أصل 3 عروض مستهدفة)
              </strong>
              <div style={{ fontSize: ".85rem", color: "var(--muted-fg)", marginTop: ".2rem" }}>
                {quotes.length < 3
                  ? `يُوصى بإدخال ${3 - quotes.length} عرض إضافي لاكتمال الحوكمة والمقارنة النظامية`
                  : "تم استيفاء الحد الأدنى من العروض (3 موردين) لاكتمال محضر الترسية"}
              </div>
            </div>
            {request.status !== "معتمد" && (
              <button className="btn outline" onClick={() => setAddQuoteOpen(true)}>
                <Plus size={15} /> إضافة عرض سعر مورد
              </button>
            )}
          </div>

          {/* نموذج إضافة عرض سعر جديد */}
          {addQuoteOpen && (
            <div className="surface" style={{ padding: "1.25rem", marginBottom: "1.25rem", border: "1px dashed var(--border)" }}>
              <h4 style={{ marginBottom: ".75rem" }}>تسجيل عرض سعر من مورد</h4>
              <form onSubmit={handleAddQuote}>
                <div className="form-grid">
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>المورد / الورشة *</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <select
                        value={quoteForm.supplierId ? String(quoteForm.supplierId) : ""}
                        onChange={(e) => {
                          const selId = Number(e.target.value);
                          if (selId) {
                            const found = ((suppliersQuery.data ?? []) as any[]).find((s) => s.id === selId);
                            if (found) {
                              setQuoteForm((prev) => ({
                                ...prev,
                                supplierId: selId,
                                supplierName: found.name,
                                supplierPhone: found.phone || prev.supplierPhone,
                                supplierVat: found.vatNumber || prev.supplierVat,
                                supplierRating: found.rating || prev.supplierRating,
                              }));
                            }
                          } else {
                            setQuoteForm((prev) => ({ ...prev, supplierId: null }));
                          }
                        }}
                      >
                        <option value="">-- اختر من قائمة الموردين المعتمدين --</option>
                        {((suppliersQuery.data ?? []) as any[]).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} · {s.name} ({s.category})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="أو أدخل اسم المورد كتابة..."
                        value={quoteForm.supplierName}
                        onChange={(e) => setQuoteForm({ ...quoteForm, supplierName: e.target.value })}
                        required
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>هاتف التواصل</span>
                    <input
                      type="text"
                      placeholder="05xxxxxxxx"
                      value={quoteForm.supplierPhone}
                      onChange={e => setQuoteForm({ ...quoteForm, supplierPhone: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>الرقم الضريبي للمورد</span>
                    <input
                      type="text"
                      placeholder="15 رقم"
                      maxLength={15}
                      value={quoteForm.supplierVat}
                      onChange={e => setQuoteForm({ ...quoteForm, supplierVat: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>الكمية *</span>
                    <input
                      type="number"
                      min={1}
                      value={quoteForm.quantity}
                      onChange={e => setQuoteForm({ ...quoteForm, quantity: Number(e.target.value) || 1 })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>سعر الوحدة (غير شامل الضريبة) *</span>
                    <input
                      type="number"
                      min={0}
                      value={quoteForm.unitPrice || ""}
                      onChange={e => setQuoteForm({ ...quoteForm, unitPrice: Number(e.target.value) || 0 })}
                      placeholder="SAR"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>مدة التوريد (أيام) *</span>
                    <input
                      type="number"
                      min={1}
                      value={quoteForm.deliveryDays}
                      onChange={e => setQuoteForm({ ...quoteForm, deliveryDays: Number(e.target.value) || 1 })}
                    />
                  </label>
                  <label className="field">
                    <span>الضمان المقدم</span>
                    <select
                      value={quoteForm.warrantyPeriod}
                      onChange={e => setQuoteForm({ ...quoteForm, warrantyPeriod: e.target.value })}
                    >
                      <option>لا يوجد</option>
                      <option>شهر واحد</option>
                      <option>3 أشهر</option>
                      <option>6 أشهر</option>
                      <option>سنة واحدة</option>
                      <option>سنتان</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>تقييم المورد (نجوم)</span>
                    <select
                      value={quoteForm.supplierRating}
                      onChange={e => setQuoteForm({ ...quoteForm, supplierRating: Number(e.target.value) })}
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (ممتاز - 5)</option>
                      <option value={4}>⭐⭐⭐⭐ (جيد جداً - 4)</option>
                      <option value={3}>⭐⭐⭐ (متوسط - 3)</option>
                      <option value={2}>⭐⭐ (مقبول - 2)</option>
                      <option value={1}>⭐ (ضعيف - 1)</option>
                    </select>
                  </label>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>ملف أو صورة عرض السعر (PDF / صورة)</span>
                    <input
                      type="file"
                      accept={SUPPORTED_UPLOAD_ACCEPT}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await readUploadDataUrl(file);
                          setQuoteForm((prev) => ({
                            ...prev,
                            quoteFileUrl: url,
                            quoteFileName: file.name,
                          }));
                        } catch (err: any) {
                          toast.error(err.message || "تعذر قراءة الملف");
                        }
                      }}
                    />
                    {quoteForm.quoteFileName && (
                      <small style={{ color: "var(--teal)", fontWeight: 600 }}>
                        الملف المرفق: {quoteForm.quoteFileName}
                      </small>
                    )}
                  </label>
                  <label className="field" style={{ gridColumn: "span 2" }}>
                    <span>ملاحظات إضافية على العرض</span>
                    <input
                      type="text"
                      placeholder="شروط الدفع، التوصيل المجاني، أصل القطع..."
                      value={quoteForm.notes}
                      onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                    />
                  </label>
                </div>
                <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
                  <button className="btn primary" type="submit" disabled={createQuoteMutation.isPending}>
                    {createQuoteMutation.isPending ? "جارٍ الحفظ…" : "حفظ العرض للمقارنة"}
                  </button>
                  <button className="btn ghost" type="button" onClick={() => setAddQuoteOpen(false)}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* جدول المقارنة التفصيلي بين عروض الموردين */}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>المورد</th>
                  <th>الكمية والسعر</th>
                  <th>الضريبة 15%</th>
                  <th>الإجمالي الشامل</th>
                  <th>مدة التوريد</th>
                  <th>الضمان</th>
                  <th>التقييم</th>
                  <th>الترسية والاعتماد</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted-fg)" }}>
                      لم يتم إدخال أي عروض أسعار لهذا الطلب بعد. انقر على «إضافة عرض سعر مورد» للبدء.
                    </td>
                  </tr>
                ) : (
                  quotes.map(q => {
                    const isLowest = q.totalAmount === minPrice && quotes.length > 1;
                    const isFastest = q.deliveryDays === minDelivery && quotes.length > 1;
                    const isSelected = q.isSelected === 1;

                    return (
                      <tr
                        key={q.id}
                        style={{
                          background: isSelected
                            ? "rgba(16, 185, 129, 0.08)"
                            : undefined,
                        }}
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                            <Building2 size={16} />
                            <div>
                              <strong>{q.supplierName}</strong>
                              <small>{q.supplierPhone || "لا يوجد هاتف"}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong>{q.unitPrice.toLocaleString("en-US")} SAR</strong>
                            <small>الكمية: {q.quantity}</small>
                          </div>
                        </td>
                        <td>{q.taxAmount.toLocaleString("en-US")} SAR</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                            <strong style={{ fontSize: "1.05rem", color: isLowest ? "#10b981" : undefined }}>
                              {q.totalAmount.toLocaleString("en-US")} SAR
                            </strong>
                            {isLowest && (
                              <span
                                style={{
                                  background: "#10b981",
                                  color: "#fff",
                                  padding: ".15rem .4rem",
                                  borderRadius: ".3rem",
                                  fontSize: ".7rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: ".2rem",
                                }}
                              >
                                <TrendingDown size={12} /> الأقل سعراً
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                            <span>{q.deliveryDays} أيام</span>
                            {isFastest && (
                              <span
                                style={{
                                  background: "#f59e0b",
                                  color: "#fff",
                                  padding: ".15rem .4rem",
                                  borderRadius: ".3rem",
                                  fontSize: ".7rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: ".2rem",
                                }}
                              >
                                <Zap size={11} /> الأسرع
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{q.warrantyPeriod}</td>
                        <td>{"⭐".repeat(Math.max(1, Math.min(5, q.supplierRating)))}</td>
                        <td className="actions-cell">
                          <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                            {q.quoteFileUrl && (
                              <button
                                type="button"
                                className="btn outline"
                                title="معاينة عرض السعر داخل النظام"
                                style={{ padding: ".3rem .55rem", fontSize: ".8rem" }}
                                onClick={() =>
                                  setPreviewQuoteDoc({
                                    url: q.quoteFileUrl!,
                                    name: q.quoteFileName || `عرض-سعر-${q.supplierName}`,
                                    title: `عرض سعر · ${q.supplierName}`,
                                    entity: `طلب شراء ${request.ref}`,
                                  })
                                }
                              >
                                <Eye size={13} /> معاينة
                              </button>
                            )}
                            {isSelected ? (
                              <span
                                style={{
                                  background: "#10b981",
                                  color: "#fff",
                                  padding: ".3rem .6rem",
                                  borderRadius: ".4rem",
                                  fontSize: ".8rem",
                                  fontWeight: "bold",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: ".3rem",
                                }}
                              >
                                <Award size={14} /> العرض المعتمد
                              </span>
                            ) : (
                              <>
                                {canApproveFinance && request.status !== "معتمد" && (
                                  <button
                                    className="btn primary"
                                    style={{ padding: ".3rem .65rem", fontSize: ".8rem" }}
                                    onClick={() => setAwardModal(q)}
                                  >
                                    اعتماد وترسية
                                  </button>
                                )}
                                {request.status !== "معتمد" && (
                                  <button
                                    className="row-menu-btn danger"
                                    title="حذف العرض"
                                    onClick={() => handleDeleteQuote(q.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button className="btn outline" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* نافذة تأكيد الترسية والاعتماد المالي */}
      {awardModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h3>اعتماد وترسية طلب الشراء</h3>
                <p>تأكيد اختيار المورد: <strong>{awardModal.supplierName}</strong> بقيمة إجمالية <strong>{awardModal.totalAmount.toLocaleString("en-US")} SAR</strong></p>
              </div>
              <button className="icon-btn" onClick={() => setAwardModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>مبررات اختيار هذا العرض (لأغراض الحوكمة والتدقيق) *</span>
                <textarea
                  rows={3}
                  value={awardReason}
                  onChange={e => setAwardReason(e.target.value)}
                  placeholder="اكتب سبب الترسية، مثل: أقل الأسعار، توفر الضمان الكافي، مطابقة المواصفات الفنية..."
                  required
                />
              </label>
              <div className="form-actions" style={{ marginTop: "1.25rem" }}>
                <button
                  className="btn primary"
                  disabled={selectQuoteMutation.isPending || !awardReason.trim()}
                  onClick={() => void handleAwardQuote()}
                >
                  {selectQuoteMutation.isPending ? "جارٍ الاعتماد…" : "تأكيد الاعتماد والترسية الرسمية"}
                </button>
                <button className="btn ghost" onClick={() => setAwardModal(null)}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة طباعة أمر الشراء من داخل محضر المقارنة */}
      {poPrintOpen && winningQuote && (
        <PurchaseOrderPrintModal
          request={request}
          quote={winningQuote}
          onClose={() => setPoPrintOpen(false)}
        />
      )}

      {/* نافذة معاينة عرض السعر داخل النظام */}
      {previewQuoteDoc && (
        <DocumentPreviewModal
          title={previewQuoteDoc.title}
          fileName={previewQuoteDoc.name}
          fileUrl={previewQuoteDoc.url}
          type="عرض سعر مورد"
          entity={previewQuoteDoc.entity}
          status="ساري"
          onClose={() => setPreviewQuoteDoc(null)}
        />
      )}
    </div>
  );
}

/**
 * نافذة طباعة أمر الشراء الرسمي المعتمد (Official Purchase Order - PO)
 */
function PurchaseOrderPrintModal({
  request,
  quote,
  onClose,
}: {
  request: PurchaseRequestRow;
  quote: PurchaseQuoteRow;
  onClose: () => void;
}) {
  const handlePrint = () => {
    window.print();
  };

  const poNumber = `PO-${request.ref.replace(/^PR-/, "")}`;
  const poDate = request.approvedAt
    ? new Date(request.approvedAt).toLocaleDateString("ar-SA")
    : new Date().toLocaleDateString("ar-SA");

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card wide" role="dialog" aria-modal="true" style={{ maxWidth: "900px" }}>
        <div className="modal-head no-print">
          <div>
            <h3>أمر شراء رسمي (Purchase Order)</h3>
            <p>معاينة المستند الرسمي المعتمد للطباعة وتزويد المورد به</p>
          </div>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <button className="btn primary" onClick={handlePrint}>
              <Printer size={15} /> طباعة أمر الشراء (A4)
            </button>
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #purchase-order-printable, #purchase-order-printable * {
                visibility: visible !important;
              }
              #purchase-order-printable {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 20mm !important;
                box-sizing: border-box !important;
                background: #ffffff !important;
                color: #000000 !important;
                border: none !important;
                box-shadow: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div
            id="purchase-order-printable"
            style={{
              background: "#ffffff",
              color: "#1e293b",
              padding: "2.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            }}
          >
            {/* الترويسة الرسمية للشركة */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f766e", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ margin: "0 0 .3rem", fontSize: "1.45rem", color: "#0f766e" }}>شركة ثقة التوصيل للنقل والخدمات اللوجستية</h2>
                <div style={{ fontSize: ".85rem", color: "#64748b" }}>سجل تجاري: 1010000000 · المملكة العربية السعودية</div>
                <div style={{ fontSize: ".85rem", color: "#64748b" }}>الرقم الضريبي الموحد: <strong>300000000000003</strong></div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", color: "#0f766e", padding: ".4rem .8rem", borderRadius: ".4rem", fontWeight: "bold", fontSize: "1.1rem" }}>
                  أمر شراء رسمي (PO)
                </div>
                <div style={{ marginTop: ".5rem", fontSize: ".9rem" }}>
                  <strong>رقم أمر الشراء:</strong> {poNumber}
                </div>
                <div style={{ fontSize: ".85rem", color: "#64748b" }}>
                  <strong>رقم الطلب المرجعي:</strong> {request.ref}
                </div>
                <div style={{ fontSize: ".85rem", color: "#64748b" }}>
                  <strong>تاريخ الاعتماد:</strong> {poDate}
                </div>
              </div>
            </div>

            {/* تفاصيل المورد والجهة الطالبة */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: ".5rem", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: ".8rem", color: "#64748b", fontWeight: "bold", marginBottom: ".4rem" }}>بيانات المورد المعتمد (Vendor / Supplier)</div>
                <div style={{ fontSize: "1.05rem", fontWeight: "bold", color: "#0f172a" }}>{quote.supplierName}</div>
                {quote.supplierVat && quote.supplierVat !== "—" && (
                  <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".25rem" }}>
                    الرقم الضريبي للمورد: <strong>{quote.supplierVat}</strong>
                  </div>
                )}
                {quote.supplierPhone && quote.supplierPhone !== "—" && (
                  <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".2rem" }}>
                    هاتف التواصل: {quote.supplierPhone}
                  </div>
                )}
                <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".2rem" }}>
                  مدة التوريد المتفق عليها: <strong>{quote.deliveryDays} أيام عمل</strong>
                </div>
                <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".2rem" }}>
                  فترة الضمان: <strong>{quote.warrantyPeriod}</strong>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: ".5rem", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: ".8rem", color: "#64748b", fontWeight: "bold", marginBottom: ".4rem" }}>بيانات طلب الشراء والجهة الطالبة</div>
                <div style={{ fontSize: ".95rem", color: "#0f172a" }}>
                  القسم الطالب: <strong>{request.department}</strong>
                </div>
                <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".25rem" }}>
                  تصنيف المشتريات: {request.category}
                </div>
                <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".25rem" }}>
                  طالب الشراء: {request.requestedByName || "مسؤول النظام"}
                </div>
                <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".25rem" }}>
                  درجة الأولوية: <span style={{ fontWeight: "bold", color: request.priority === "عاجل" || request.priority === "طارئ" ? "#dc2626" : "#0f766e" }}>{request.priority}</span>
                </div>
                <div style={{ fontSize: ".85rem", color: "#475569", marginTop: ".25rem" }}>
                  الاعتماد المالي: <strong>{request.approvedByName || "الإدارة المالية"}</strong>
                </div>
              </div>
            </div>

            {/* جدول بنود أمر الشراء */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: ".9rem", fontWeight: "bold", color: "#0f766e", marginBottom: ".6rem" }}>
                تفاصيل البنود والكميات المطلوبة:
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={{ padding: ".6rem", textAlign: "right" }}>#</th>
                    <th style={{ padding: ".6rem", textAlign: "right" }}>الوصف والمواصفات</th>
                    <th style={{ padding: ".6rem", textAlign: "center" }}>الكمية</th>
                    <th style={{ padding: ".6rem", textAlign: "left" }}>سعر الوحدة</th>
                    <th style={{ padding: ".6rem", textAlign: "left" }}>ضريبة القيمة المضافة (15%)</th>
                    <th style={{ padding: ".6rem", textAlign: "left" }}>الإجمالي شامل الضريبة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: ".75rem .6rem", verticalAlign: "top" }}>1</td>
                    <td style={{ padding: ".75rem .6rem" }}>
                      <strong style={{ display: "block", color: "#0f172a" }}>{quote.itemDescription || request.purpose}</strong>
                      {quote.notes && (
                        <div style={{ fontSize: ".8rem", color: "#64748b", marginTop: ".2rem" }}>
                          ملاحظات ومواصفات: {quote.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: ".75rem .6rem", textAlign: "center" }}>{quote.quantity}</td>
                    <td style={{ padding: ".75rem .6rem", textAlign: "left" }}>{quote.unitPrice.toLocaleString("en-US")} SAR</td>
                    <td style={{ padding: ".75rem .6rem", textAlign: "left" }}>{quote.taxAmount.toLocaleString("en-US")} SAR</td>
                    <td style={{ padding: ".75rem .6rem", textAlign: "left", fontWeight: "bold", color: "#0f766e" }}>
                      {quote.totalAmount.toLocaleString("en-US")} SAR
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ملخص المبالغ المالية */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.75rem" }}>
              <div style={{ width: "320px", background: "#f8fafc", padding: "1rem", borderRadius: ".5rem", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: ".25rem 0", fontSize: ".9rem" }}>
                  <span style={{ color: "#64748b" }}>المجموع الفرعي (غير شامل الضريبة):</span>
                  <strong>{(quote.unitPrice * quote.quantity).toLocaleString("en-US")} SAR</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: ".25rem 0", fontSize: ".9rem" }}>
                  <span style={{ color: "#64748b" }}>ضريبة القيمة المضافة (15%):</span>
                  <strong>{quote.taxAmount.toLocaleString("en-US")} SAR</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: ".5rem 0 0", marginTop: ".4rem", borderTop: "2px solid #cbd5e1", fontSize: "1.1rem", color: "#0f766e" }}>
                  <strong>الإجمالي النهائي المستحق:</strong>
                  <strong>{quote.totalAmount.toLocaleString("en-US")} SAR</strong>
                </div>
              </div>
            </div>

            {/* شروط وأحكام أمر الشراء */}
            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: ".5rem", border: "1px solid #e2e8f0", fontSize: ".8rem", color: "#475569", marginBottom: "1.75rem" }}>
              <strong style={{ display: "block", color: "#0f172a", marginBottom: ".3rem" }}>شروط التوريد والسداد:</strong>
              <ul style={{ margin: 0, paddingRight: "1.2rem", lineHeight: 1.6 }}>
                <li>يجب إرفاق أصل هذا الأمر مع فاتورة التوريد الضريبية الرسمية لضمان سرعة الصرف المالي.</li>
                <li>يتم فحص ومطابقة الأصناف الموردة مع المواصفات المعتمدة قبل التوقيع على سند الاستلام الفعلي.</li>
                <li>تلتزم المنشأة بسداد المستحقات طبقاً لشروط وأجل السداد المتفق عليها بعد فحص واعتماد الفاتورة في قسم المستحقات.</li>
              </ul>
            </div>

            {/* خانة التوقيعات والاعتماد الرسمي */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", textAlign: "center", paddingTop: "1rem", borderTop: "1px dashed #cbd5e1" }}>
              <div>
                <div style={{ fontSize: ".85rem", color: "#64748b", marginBottom: "2rem" }}>إعداد قسم المشتريات</div>
                <div style={{ borderBottom: "1px solid #94a3b8", width: "70%", margin: "0 auto .3rem" }}></div>
                <div style={{ fontSize: ".8rem", fontWeight: "bold" }}>التوقيع والتاريخ</div>
              </div>
              <div>
                <div style={{ fontSize: ".85rem", color: "#64748b", marginBottom: "2rem" }}>اعتماد الإدارة المالية</div>
                <div style={{ borderBottom: "1px solid #94a3b8", width: "70%", margin: "0 auto .3rem" }}></div>
                <div style={{ fontSize: ".8rem", fontWeight: "bold" }}>{request.approvedByName || "المدير المالي"}</div>
              </div>
              <div>
                <div style={{ fontSize: ".85rem", color: "#64748b", marginBottom: "2rem" }}>الختم المعتمد</div>
                <div style={{ height: "45px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ border: "2px dashed #0f766e", borderRadius: "50%", width: "55px", height: "55px", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e", fontSize: ".65rem", fontWeight: "bold" }}>
                    معتمد
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions no-print" style={{ marginTop: "1.25rem" }}>
            <button className="btn primary" onClick={handlePrint}>
              <Printer size={15} /> طباعة المستند (A4)
            </button>
            <button className="btn ghost" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
