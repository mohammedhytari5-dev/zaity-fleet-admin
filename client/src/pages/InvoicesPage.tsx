import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import {
  Receipt,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  Layers,
  Search,
  Filter,
  Printer,
  Eye,
  QrCode,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Percent,
  Download,
  Info,
  Clock,
  User,
  Hash,
} from "lucide-react";
import {
  calculateInvoiceTotals,
  INVOICE_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  parseZatcaTlvBase64,
  type InvoiceLineInput,
  type InvoiceType,
  type DocumentType,
} from "../../../shared/zatca-domain";
import type { TaxInvoice, TaxInvoiceLine } from "../../../drizzle/schema";

interface InvoicesPageProps {
  canAccessFinance?: boolean;
}

export default function InvoicesPage({ canAccessFinance = true }: InvoicesPageProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "vat-declaration">("invoices");

  // Invoices list state
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);

  // Create invoice state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invType, setInvType] = useState<InvoiceType>("simplified");
  const [docType, setDocType] = useState<DocumentType>("invoice");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issueTime, setIssueTime] = useState(
    new Date().toTimeString().slice(0, 8)
  );

  // Seller info (prefilled company defaults)
  const [sellerName, setSellerName] = useState("شركة ثقة التوصيل المحدودة");
  const [sellerVatNumber, setSellerVatNumber] = useState("310123456700003");
  const [sellerCity, setSellerCity] = useState("الرياض");
  const [sellerAddress, setSellerAddress] = useState("طريق الملك فهد، حي الصحافة");

  // Buyer info
  const [buyerName, setBuyerName] = useState("");
  const [buyerVatNumber, setBuyerVatNumber] = useState("");
  const [buyerCity, setBuyerCity] = useState("الرياض");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [postToAccounting, setPostToAccounting] = useState(true);

  // Lines
  const [lines, setLines] = useState<InvoiceLineInput[]>([
    {
      itemDescription: "إيجار وتشغيل مركبة - عقد شهري",
      quantity: 1,
      unitPrice: 2500,
      discount: 0,
      vatRate: 15,
      vatCategory: "S",
    },
  ]);

  // VAT Declaration state
  const currentYear = new Date().getFullYear();
  const [vatStartDate, setVatStartDate] = useState(`${currentYear}-01-01`);
  const [vatEndDate, setVatEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Linked Contract & Client State
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const invoicesQuery = trpc.invoices.list.useQuery(undefined);
  const contractsQuery = trpc.contracts.list.useQuery(undefined, { enabled: canAccessFinance });
  const clientsQuery = trpc.clients.list.useQuery(undefined, { enabled: canAccessFinance });
  const singleInvoiceQuery = trpc.invoices.get.useQuery(
    { id: selectedInvoiceId! },
    { enabled: Boolean(selectedInvoiceId) }
  );
  const vatDeclarationQuery = trpc.invoices.vatDeclaration.useQuery({
    startDate: vatStartDate,
    endDate: vatEndDate,
  });

  // Handle contract selection with smart auto-fill
  const handleSelectContract = (cId: number | null) => {
    setSelectedContractId(cId);
    if (!cId) {
      setSelectedClientId(null);
      return;
    }
    const contract = contractsQuery.data?.find((c) => c.id === cId);
    if (!contract) return;
    setSelectedClientId(contract.clientId ?? null);
    setBuyerName(contract.client || "");

    const client = clientsQuery.data?.find(
      (c) => (contract.clientId && c.id === contract.clientId) || c.name === contract.client
    );
    if (client) {
      if (client.vat && client.vat !== "—") {
        setBuyerVatNumber(client.vat);
        setInvType("standard"); // Corporate with VAT -> Standard B2B
      }
      if (client.location && client.location !== "—") {
        setBuyerCity(client.location);
      }
    }

    const contractTotal = Number(contract.total) || 0;
    const suggestedPrice = contractTotal > 0 ? (contractTotal >= 12000 ? Math.round(contractTotal / 12) : contractTotal) : 2500;
    setLines([
      {
        itemDescription: `خدمات إدارة وتشغيل أسطول - عقد رقم ${contract.ref}`,
        quantity: 1,
        unitPrice: suggestedPrice,
        discount: 0,
        vatRate: 15,
        vatCategory: "S",
      },
    ]);
  };

  // Check URL query parameters for pre-selected contract
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cId = params.get("contractId");
    if (cId && contractsQuery.data?.length) {
      const contract = contractsQuery.data.find((c) => c.id === Number(cId));
      if (contract) {
        handleSelectContract(contract.id);
        setIsCreateOpen(true);
      }
    }
  }, [contractsQuery.data]);

  // Create mutation
  const createInvoiceMutation = trpc.invoices.create.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إصدار الفاتورة الضريبية رقم ${data.invoice.invoiceNumber} بنجاح!`);
      utils.invoices.list.invalidate();
      utils.invoices.vatDeclaration.invalidate();
      setIsCreateOpen(false);
      setSelectedInvoiceId(data.invoice.id);
      setIsInvoiceViewOpen(true);
      // Reset form
      setSelectedContractId(null);
      setSelectedClientId(null);
      setBuyerName("");
      setBuyerVatNumber("");
      setNotes("");
      setLines([
        {
          itemDescription: "إيجار وتشغيل مركبة",
          quantity: 1,
          unitPrice: 1000,
          discount: 0,
          vatRate: 15,
          vatCategory: "S",
        },
      ]);
    },
    onError: (err) => {
      toast.error(err.message || "فشل إصدار الفاتورة");
    },
  });

  // Calculate live preview totals for the create modal
  const liveTotals = useMemo(() => {
    return calculateInvoiceTotals(lines);
  }, [lines]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (!invoicesQuery.data) return [];
    return invoicesQuery.data.filter((inv) => {
      if (typeFilter !== "all" && inv.invoiceType !== typeFilter) return false;
      if (docTypeFilter !== "all" && inv.documentType !== docTypeFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
        const matchBuyer = inv.buyerName.toLowerCase().includes(q);
        const matchVat = inv.buyerVatNumber?.toLowerCase().includes(q);
        if (!matchNum && !matchBuyer && !matchVat) return false;
      }
      return true;
    });
  }, [invoicesQuery.data, typeFilter, docTypeFilter, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const list = invoicesQuery.data || [];
    let taxable = 0;
    let vat = 0;
    let gross = 0;
    let standardCount = 0;
    let simplifiedCount = 0;
    let creditNotesCount = 0;

    for (const inv of list) {
      const mult = inv.documentType === "credit_note" ? -1 : 1;
      taxable += inv.totalExcludingVat * mult;
      vat += inv.totalVat * mult;
      gross += inv.totalIncludingVat * mult;

      if (inv.documentType === "credit_note") creditNotesCount++;
      else if (inv.invoiceType === "standard") standardCount++;
      else simplifiedCount++;
    }

    return {
      taxable: Math.max(0, taxable),
      vat: Math.max(0, vat),
      gross: Math.max(0, gross),
      totalCount: list.length,
      standardCount,
      simplifiedCount,
      creditNotesCount,
    };
  }, [invoicesQuery.data]);

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemDescription: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        vatRate: 15,
        vatCategory: "S",
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) {
      toast.warning("يجب أن تحتوي الفاتورة على بند واحد على الأقل");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof InvoiceLineInput, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
      toast.error("يرجى إدخال اسم العميل / المشتري");
      return;
    }
    if (invType === "standard" && !buyerVatNumber.trim()) {
      toast.error("الرقم الضريبي للمشتري إلزامي في الفواتير القياسية (B2B)");
      return;
    }
    for (const l of lines) {
      if (!l.itemDescription.trim()) {
        toast.error("يرجى كتابة وصف جميع البنود");
        return;
      }
    }

    createInvoiceMutation.mutate({
      invoiceType: invType,
      documentType: docType,
      issueDate,
      issueTime,
      sellerName,
      sellerVatNumber,
      sellerCity,
      sellerAddress,
      buyerName,
      buyerVatNumber: buyerVatNumber.trim() || undefined,
      buyerCity,
      buyerAddress,
      contractId: selectedContractId ?? undefined,
      clientId: selectedClientId ?? undefined,
      notes,
      postToAccounting,
      lines,
    });
  };

  return (
    <div className="invoices-container" style={{ paddingBottom: 60 }}>
      {/* Top Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Receipt size={14} />
            <span>هيئة الزكاة والضريبة والجمارك (ZATCA)</span>
          </div>
          <h1>الفوترة الإلكترونية والضريبة</h1>
          <p>
            إصدار وإدارة الفواتير الضريبية (B2B القياسية و B2C المبسطة) المتوافقة مع متطلبات هيئة الزكاة،
            وترميز رموز الاستجابة السريعة TLV، وإقرارات ضريبة القيمة المضافة.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn primary"
            onClick={() => setIsCreateOpen(true)}
            style={{ fontWeight: 600 }}
          >
            <Plus size={16} />
            <span>إصدار فاتورة ضريبية</span>
          </button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>المبيعات الخاضعة للضريبة</span>
            <FileText size={16} color="var(--teal)" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            {metrics.taxable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 13, fontWeight: 500, marginRight: 5 }}> ر.س</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            إجمالي الفواتير الصادرة بدون الضريبة
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>ضريبة القيمة المضافة (15%)</span>
            <Percent size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#d97706" }}>
            {metrics.vat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 13, fontWeight: 500, marginRight: 5 }}> ر.س</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            الضريبة المحصلة الواجب توريدها للهيئة
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>الإجمالي شامل الضريبة</span>
            <Building2 size={16} color="var(--teal-dark)" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--teal-dark)" }}>
            {metrics.gross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 13, fontWeight: 500, marginRight: 5 }}> ر.س</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            القيمة الإجمالية الصافية للفواتير
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", marginBottom: 8 }}>
            <span style={{ fontSize: 12 }}>إجمالي الوثائق المصدرة</span>
            <Layers size={16} color="#4f46e5" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            {metrics.totalCount}
            <span style={{ fontSize: 13, fontWeight: 500, marginRight: 5 }}> وثيقة</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", gap: 8 }}>
            <span>{metrics.standardCount} قياسية</span>
            <span>·</span>
            <span>{metrics.simplifiedCount} مبسطة</span>
            {metrics.creditNotesCount > 0 && (
              <>
                <span>·</span>
                <span>{metrics.creditNotesCount} إشعار دائن</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: 12,
          borderBottom: "1px solid var(--line)",
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setActiveTab("invoices")}
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "invoices" ? "2px solid var(--teal)" : "2px solid transparent",
            color: activeTab === "invoices" ? "var(--teal-dark)" : "var(--muted)",
            fontWeight: activeTab === "invoices" ? 600 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Receipt size={16} />
          <span>سجل الفواتير والإشعارات</span>
        </button>

        <button
          onClick={() => setActiveTab("vat-declaration")}
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "vat-declaration" ? "2px solid var(--teal)" : "2px solid transparent",
            color: activeTab === "vat-declaration" ? "var(--teal-dark)" : "var(--muted)",
            fontWeight: activeTab === "vat-declaration" ? 600 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <ShieldCheck size={16} />
          <span>إقرار ضريبة القيمة المضافة (ZATCA)</span>
        </button>
      </div>

      {/* TAB 1: Invoices List */}
      {activeTab === "invoices" && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 260 }}>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  maxWidth: 320,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Search
                  size={15}
                  style={{ position: "absolute", right: 12, color: "var(--muted)" }}
                />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة أو اسم العميل أو الرقم الضريبي..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    height: 38,
                    borderRadius: 9,
                    border: "1px solid var(--line)",
                    padding: "0 34px 0 12px",
                    background: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  height: 38,
                  borderRadius: 9,
                  border: "1px solid var(--line)",
                  padding: "0 12px",
                  background: "#fff",
                  fontSize: 13,
                }}
              >
                <option value="all">جميع الأنواع</option>
                <option value="standard">فاتورة قياسية (B2B)</option>
                <option value="simplified">فاتورة مبسطة (B2C)</option>
              </select>

              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                style={{
                  height: 38,
                  borderRadius: 9,
                  border: "1px solid var(--line)",
                  padding: "0 12px",
                  background: "#fff",
                  fontSize: 13,
                }}
              >
                <option value="all">جميع المستندات</option>
                <option value="invoice">فاتورة</option>
                <option value="credit_note">إشعار دائن</option>
                <option value="debit_note">إشعار مدين</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {invoicesQuery.isLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                جارٍ تحميل الفواتير الضريبية...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div style={{ padding: 50, textAlign: "center" }}>
                <Receipt size={40} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: 16, marginBottom: 6 }}>لا توجد فواتير ضريبية مطابقة</h3>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
                  يمكنك إصدار فاتورة ضريبية متوافقة مع هيئة الزكاة بضغطة زر.
                </p>
                <button className="btn primary" onClick={() => setIsCreateOpen(true)}>
                  <Plus size={15} />
                  <span>إصدار أول فاتورة ضريبية</span>
                </button>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 12 }}>
                    <th style={{ padding: "12px 16px" }}>رقم الفاتورة</th>
                    <th style={{ padding: "12px 16px" }}>النوع والمستند</th>
                    <th style={{ padding: "12px 16px" }}>التاريخ والوقت</th>
                    <th style={{ padding: "12px 16px" }}>العميل / المشتري</th>
                    <th style={{ padding: "12px 16px" }}>المجموع بدون ضريبة</th>
                    <th style={{ padding: "12px 16px" }}>ضريبة 15%</th>
                    <th style={{ padding: "12px 16px" }}>الإجمالي المستحق</th>
                    <th style={{ padding: "12px 16px" }}>حالة ZATCA</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafdfc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--teal-dark)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <FileText size={15} />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              background: inv.invoiceType === "standard" ? "#e0e7ff" : "#dcfce7",
                              color: inv.invoiceType === "standard" ? "#3730a3" : "#166534",
                              width: "fit-content",
                            }}
                          >
                            {INVOICE_TYPE_LABELS[inv.invoiceType]}
                          </span>
                          {inv.documentType !== "invoice" && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                                background: "#fee2e2",
                                color: "#991b1b",
                                width: "fit-content",
                              }}
                            >
                              {DOCUMENT_TYPE_LABELS[inv.documentType]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: 12 }}>
                        <div>{inv.issueDate}</div>
                        <div style={{ fontSize: 11 }}>{inv.issueTime}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{inv.buyerName}</div>
                        {inv.buyerVatNumber && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            الضريبي: {inv.buyerVatNumber}
                          </div>
                        )}
                        {inv.contractId && (
                          <div style={{ marginTop: 4 }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "#f1f5f9",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              عقد #{inv.contractId}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 500 }}>
                        {inv.totalExcludingVat.toLocaleString("en-US", { minimumFractionDigits: 2 })} ر.س
                      </td>
                      <td style={{ padding: "14px 16px", color: "#d97706", fontWeight: 600 }}>
                        {inv.totalVat.toLocaleString("en-US", { minimumFractionDigits: 2 })} ر.س
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--ink)" }}>
                        {inv.totalIncludingVat.toLocaleString("en-US", { minimumFractionDigits: 2 })} ر.س
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#e6f5f1",
                            color: "var(--teal-dark)",
                          }}
                        >
                          <ShieldCheck size={12} />
                          <span>متوافقة (المرحلة 1 و 2)</span>
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <button
                          className="btn outline"
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setIsInvoiceViewOpen(true);
                          }}
                          style={{ height: 32, padding: "0 10px", fontSize: 12 }}
                        >
                          <Eye size={14} />
                          <span>عرض وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VAT Declaration (إقرار ضريبة القيمة المضافة) */}
      {activeTab === "vat-declaration" && (
        <div>
          {/* Date Selector Header */}
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                إقرار ضريبة القيمة المضافة (نموذج 101 - هيئة الزكاة والضريبة والجمارك)
              </h3>
              <p style={{ color: "var(--muted)", fontSize: 12 }}>
                ملخص احتساب ضريبة المخرجات على المبيعات والخدمات والتعديلات للفترة المحددة.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>من:</span>
                <input
                  type="date"
                  value={vatStartDate}
                  onChange={(e) => setVatStartDate(e.target.value)}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    padding: "0 8px",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>إلى:</span>
                <input
                  type="date"
                  value={vatEndDate}
                  onChange={(e) => setVatEndDate(e.target.value)}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    padding: "0 8px",
                    fontSize: 13,
                  }}
                />
              </div>

              <button
                className="btn outline"
                onClick={() => utils.invoices.vatDeclaration.invalidate()}
              >
                تحديث التقرير
              </button>
            </div>
          </div>

          {/* Declaration Report Breakdown */}
          {vatDeclarationQuery.isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              جارٍ احتساب الإقرار الضريبي للفترة...
            </div>
          ) : vatDeclarationQuery.data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Highlight Box for Net VAT Payable */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1aa892, #077865)",
                  borderRadius: 14,
                  padding: "24px 28px",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 6px 20px rgba(7, 120, 101, 0.2)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
                    صافي الضريبة المستحقة للسداد للهيئة (Net Output VAT Payable)
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>
                    {vatDeclarationQuery.data.netVatPayable.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    <span style={{ fontSize: 16, fontWeight: 500, marginRight: 8 }}> ر.س</span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                    الفترة من {vatDeclarationQuery.data.startDate} إلى {vatDeclarationQuery.data.endDate}
                  </div>
                </div>

                <div style={{ textAlign: "left", opacity: 0.9, fontSize: 13 }}>
                  <div>عدد الفواتير الصادرة: <strong>{vatDeclarationQuery.data.totalInvoices}</strong></div>
                  <div>فواتير B2B قياسية: <strong>{vatDeclarationQuery.data.standardInvoicesCount}</strong></div>
                  <div>فواتير B2C مبسطة: <strong>{vatDeclarationQuery.data.simplifiedInvoicesCount}</strong></div>
                  {vatDeclarationQuery.data.creditNotesCount > 0 && (
                    <div>إشعارات دائنة: <strong>{vatDeclarationQuery.data.creditNotesCount}</strong></div>
                  )}
                </div>
              </div>

              {/* Form 101 Table */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--line)",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  تفصيل ضريبة المخرجات (المبيعات) - بند 1 في نموذج الإقرار
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 12 }}>
                      <th style={{ padding: "12px 20px" }}>بند الإقرار</th>
                      <th style={{ padding: "12px 20px" }}>المبلغ الخاضع للضريبة (ر.س)</th>
                      <th style={{ padding: "12px 20px" }}>مبلغ الضريبة 15% (ر.س)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 20px", fontWeight: 600 }}>
                        1.1 المبيعات الخاضعة للنسبة الأساسية (15%)
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        {vatDeclarationQuery.data.totalSalesExcludingVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: "#d97706" }}>
                        {vatDeclarationQuery.data.totalOutputVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        1.2 المبيعات للمواطنين (الخدمات الصحية / التعليمية الأهلية)
                      </td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        1.3 المبيعات المحلية الخاضعة للنسبة الصفرية
                      </td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        1.4 الصادرات
                      </td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 20px" }}>
                        1.5 المبيعات المعفاة من الضريبة
                      </td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                      <td style={{ padding: "14px 20px" }}>0.00</td>
                    </tr>
                    <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}>
                      <td style={{ padding: "16px 20px" }}>
                        إجمالي المبيعات وضريبة المخرجات
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        {vatDeclarationQuery.data.totalSalesExcludingVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--teal-dark)", fontSize: 15 }}>
                        {vatDeclarationQuery.data.totalOutputVat.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {isCreateOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  إصدار فاتورة ضريبية متوافقة مع ZATCA
                </h2>
                <small style={{ color: "var(--muted)" }}>
                  توليد الفاتورة، تشفير رمز الاستجابة السريعة TLV Base64، وترحيل القيد آلياً إلى دفتر الأستاذ.
                </small>
              </div>
              <button
                className="btn outline"
                onClick={() => setIsCreateOpen(false)}
                style={{ height: 32 }}
              >
                إغلاق
              </button>
            </div>

            <form onSubmit={handleSubmitInvoice} style={{ padding: 24 }}>
              {/* Linked Contract Quick Selector */}
              <div
                style={{
                  background: selectedContractId ? "#f0fdf4" : "#f8fafc",
                  border: `1px solid ${selectedContractId ? "#86efac" : "var(--line)"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 20,
                  transition: "all .2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: selectedContractId ? "#166534" : "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileText size={16} />
                    <span>ربط الفاتورة بعقد مالي وقائم (تعبئة ذكية متكاملة)</span>
                    {selectedContractId && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: "#dcfce7",
                          color: "#15803d",
                          padding: "2px 8px",
                          borderRadius: 6,
                        }}
                      >
                        تم الربط بنجاح
                      </span>
                    )}
                  </label>
                  {selectedContractId && (
                    <button
                      type="button"
                      onClick={() => handleSelectContract(null)}
                      style={{
                        fontSize: 12,
                        color: "#b91c1c",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      إلغاء الربط والعودة للإدخال اليدوي
                    </button>
                  )}
                </div>

                <select
                  value={selectedContractId ?? ""}
                  onChange={(e) => handleSelectContract(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 8,
                    border: `1px solid ${selectedContractId ? "#4ade80" : "var(--line)"}`,
                    padding: "0 12px",
                    fontSize: 13,
                    background: "#fff",
                    fontWeight: selectedContractId ? 600 : 400,
                  }}
                >
                  <option value="">-- فاتورة حرة (أو اختر أحد العقود للربط التلقائي والترحيل للمحاسبة) --</option>
                  {(contractsQuery.data ?? []).map((cn) => (
                    <option key={cn.id} value={cn.id}>
                      {cn.ref} · العميل: {cn.client} · القيمة الإجمالية: {Number(cn.total).toLocaleString("en-US")} ر.س {cn.status ? `(${cn.status})` : ""}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  عند اختيار العقد، يتم جلب بيانات العميل ورقمه الضريبي وتفاصيل العقد تلقائياً، وتوثيق الفاتورة في قيود الأستاذ العام المرتبطة بالعقد.
                </div>
              </div>

              {/* Type and Date Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    نوع الفاتورة
                  </label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as InvoiceType)}
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  >
                    <option value="simplified">مبسطة (B2C) - للأفراد والمؤسسات</option>
                    <option value="standard">قياسية (B2B) - للشركات مع رقم ضريبي</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    نوع المستند
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocumentType)}
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  >
                    <option value="invoice">فاتورة مبيعات</option>
                    <option value="credit_note">إشعار دائن (مرتجع / خصم)</option>
                    <option value="debit_note">إشعار مدين (زيادة مطالبة)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    تاريخ الإصدار
                  </label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    وقت الإصدار
                  </label>
                  <input
                    type="text"
                    value={issueTime}
                    onChange={(e) => setIssueTime(e.target.value)}
                    placeholder="HH:mm:ss"
                    style={{
                      width: "100%",
                      height: 38,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      padding: "0 10px",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Seller & Buyer Info */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  padding: 16,
                  background: "var(--surface-2)",
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                {/* Seller Box */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal-dark)", marginBottom: 10 }}>
                    بيانات المورّد (منشأتنا)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      type="text"
                      disabled
                      value={sellerName}
                      style={{ height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", background: "#fff", fontSize: 12 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        disabled
                        value={`الرقم الضريبي: ${sellerVatNumber}`}
                        style={{ flex: 1, height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", background: "#fff", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        disabled
                        value={sellerCity}
                        style={{ width: 90, height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", background: "#fff", fontSize: 12 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Buyer Box */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>
                    بيانات العميل / المشتري
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      type="text"
                      required
                      placeholder="اسم العميل أو المنشأة..."
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      style={{ height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", fontSize: 12 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder={invType === "standard" ? "الرقم الضريبي (15 رقم إلزامي للمنشآت)" : "الرقم الضريبي (اختياري للأفراد)"}
                        value={buyerVatNumber}
                        onChange={(e) => setBuyerVatNumber(e.target.value)}
                        style={{ flex: 1, height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", fontSize: 12 }}
                      />
                      <input
                        type="text"
                        placeholder="المدينة"
                        value={buyerCity}
                        onChange={(e) => setBuyerCity(e.target.value)}
                        style={{ width: 90, height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", fontSize: 12 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>
                    بنود الفاتورة والخدمات الخاضعة للضريبة
                  </label>
                  <button
                    type="button"
                    className="btn outline"
                    onClick={handleAddLine}
                    style={{ height: 30, fontSize: 12 }}
                  >
                    <Plus size={13} />
                    <span>إضافة بند</span>
                  </button>
                </div>

                <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                        <th style={{ padding: "8px 10px", width: "40%" }}>الوصف / الخدمة</th>
                        <th style={{ padding: "8px 10px", width: "12%" }}>الكمية</th>
                        <th style={{ padding: "8px 10px", width: "16%" }}>السعر (ر.س)</th>
                        <th style={{ padding: "8px 10px", width: "12%" }}>الخصم (ر.س)</th>
                        <th style={{ padding: "8px 10px", width: "14%" }}>الضريبة 15%</th>
                        <th style={{ padding: "8px 10px", width: "6%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => {
                        const sub = Math.max(0, (line.quantity || 1) * (line.unitPrice || 0) - (line.discount || 0));
                        const vat = (sub * (line.vatRate ?? 15)) / 100;
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: "8px 10px" }}>
                              <input
                                type="text"
                                required
                                placeholder="وصف البند أو الخدمة..."
                                value={line.itemDescription}
                                onChange={(e) => handleLineChange(idx, "itemDescription", e.target.value)}
                                style={{ width: "100%", height: 32, borderRadius: 6, border: "1px solid var(--line)", padding: "0 8px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input
                                type="number"
                                min={0.01}
                                step="any"
                                required
                                value={line.quantity}
                                onChange={(e) => handleLineChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                                style={{ width: "100%", height: 32, borderRadius: 6, border: "1px solid var(--line)", padding: "0 8px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                required
                                value={line.unitPrice}
                                onChange={(e) => handleLineChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                                style={{ width: "100%", height: 32, borderRadius: 6, border: "1px solid var(--line)", padding: "0 8px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.discount || 0}
                                onChange={(e) => handleLineChange(idx, "discount", parseFloat(e.target.value) || 0)}
                                style={{ width: "100%", height: 32, borderRadius: 6, border: "1px solid var(--line)", padding: "0 8px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "8px 10px", color: "#d97706", fontWeight: 600 }}>
                              {vat.toFixed(2)} ر.س
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: 4 }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary and Ledger Posting */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr",
                  gap: 16,
                  background: "#f8faf9",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={postToAccounting}
                      onChange={(e) => setPostToAccounting(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span>ترحيل قيد محاسبي آلياً إلى دفتر الأستاذ العام</span>
                  </label>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, paddingRight: 24 }}>
                    سيتم قيد: مدين حساب العملاء (1103) بالمبلغ الإجمالي، ودائن إيرادات التشغيل (4101) بالمبلغ قبل الضريبة،
                    ودائن ضريبة القيمة المضافة المحصلة (2104) بمبلغ 15%.
                  </p>

                  <div style={{ marginTop: 12 }}>
                    <input
                      type="text"
                      placeholder="ملاحظات إضافية على الفاتورة (اختياري)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid var(--line)", padding: "0 10px", fontSize: 12 }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>المجموع الخاضع للضريبة:</span>
                    <span style={{ fontWeight: 600 }}>{liveTotals.totalExcludingVat.toFixed(2)} ر.س</span>
                  </div>
                  {liveTotals.totalDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#ef4444" }}>
                      <span>إجمالي الخصم:</span>
                      <span>-{liveTotals.totalDiscount.toFixed(2)} ر.س</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#d97706" }}>
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span style={{ fontWeight: 700 }}>{liveTotals.totalVat.toFixed(2)} ر.س</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px dashed var(--line)",
                      paddingTop: 8,
                      fontSize: 16,
                      fontWeight: 800,
                      color: "var(--teal-dark)",
                    }}
                  >
                    <span>الإجمالي المستحق:</span>
                    <span>{liveTotals.totalIncludingVat.toFixed(2)} ر.س</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={createInvoiceMutation.isPending}
                  style={{ minWidth: 150 }}
                >
                  {createInvoiceMutation.isPending ? "جارٍ الإصدار..." : "إصدار الفاتورة وتشفير QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE / OFFICIAL ZATCA A4 INVOICE MODAL */}
      {isInvoiceViewOpen && selectedInvoiceId && (
        <ZatcaInvoiceModal
          invoiceId={selectedInvoiceId}
          onClose={() => {
            setIsInvoiceViewOpen(false);
            setSelectedInvoiceId(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Component: Official Printable ZATCA A4 Invoice Modal & QR Code Viewer
// ---------------------------------------------------------------------
function ZatcaInvoiceModal({
  invoiceId,
  onClose,
}: {
  invoiceId: number;
  onClose: () => void;
}) {
  const query = trpc.invoices.get.useQuery({ id: invoiceId });
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showTlvInspector, setShowTlvInspector] = useState(false);

  useEffect(() => {
    if (query.data?.invoice?.qrCodeData && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        query.data.invoice.qrCodeData,
        {
          width: 130,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error("Error generating QR Canvas:", error);
        }
      );
    }
  }, [query.data?.invoice?.qrCodeData]);

  if (query.isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ background: "#fff", padding: 30, borderRadius: 12 }}>
          جارٍ تحميل الفاتورة الضريبية...
        </div>
      </div>
    );
  }

  const invoice = query.data?.invoice;
  const lines = query.data?.lines || [];
  const parsedQr = query.data?.parsedQr || {};

  if (!invoice) return null;

  const isB2B = invoice.invoiceType === "standard";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 880,
          maxHeight: "95vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Action Bar */}
        <div
          className="no-print"
          style={{
            padding: "14px 24px",
            background: "#f4f8f7",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: isB2B ? "#e0e7ff" : "#dcfce7",
                color: isB2B ? "#3730a3" : "#166534",
              }}
            >
              {INVOICE_TYPE_LABELS[invoice.invoiceType]}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{invoice.invoiceNumber}</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn outline"
              onClick={() => setShowTlvInspector(!showTlvInspector)}
              style={{ height: 34, fontSize: 12 }}
            >
              <QrCode size={14} />
              <span>فحص كود ZATCA TLV</span>
            </button>
            <button
              className="btn primary"
              onClick={handlePrint}
              style={{ height: 34, fontSize: 12 }}
            >
              <Printer size={14} />
              <span>طباعة الفاتورة A4</span>
            </button>
            <button className="btn outline" onClick={onClose} style={{ height: 34, fontSize: 12 }}>
              إغلاق
            </button>
          </div>
        </div>

        {/* TLV Inspector Box (collapsible) */}
        {showTlvInspector && (
          <div
            className="no-print"
            style={{
              padding: "16px 24px",
              background: "#fafbfb",
              borderBottom: "1px solid var(--line)",
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--teal-dark)", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} />
              <span>فحص حقول الرمز الشريطي المعتمد من هيئة الزكاة (ZATCA TLV Tags 1-6)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><strong>Tag 1 (اسم المورد):</strong> {parsedQr[1] || "—"}</div>
              <div><strong>Tag 2 (الرقم الضريبي للمورد):</strong> {parsedQr[2] || "—"}</div>
              <div><strong>Tag 3 (الوقت والتاريخ ISO):</strong> {parsedQr[3] || "—"}</div>
              <div><strong>Tag 4 (الإجمالي شامل الضريبة):</strong> {parsedQr[4] || "—"} ر.س</div>
              <div><strong>Tag 5 (إجمالي الضريبة 15%):</strong> {parsedQr[5] || "—"} ر.س</div>
              <div><strong>Tag 6 (البصمة المشفرة SHA-256):</strong> <span style={{ fontSize: 10, wordBreak: "break-all" }}>{parsedQr[6] || "—"}</span></div>
            </div>
          </div>
        )}

        {/* PRINTABLE A4 INVOICE SHEET */}
        <div id="printable-invoice" style={{ padding: "36px 40px", color: "#111827", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111827", paddingBottom: 20, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
                {isB2B ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", letterSpacing: 1 }}>
                {isB2B ? "TAX INVOICE" : "SIMPLIFIED TAX INVOICE"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div><strong>رقم الفاتورة / Invoice No:</strong> {invoice.invoiceNumber}</div>
                <div><strong>تاريخ الإصدار / Issue Date:</strong> {invoice.issueDate} {invoice.issueTime}</div>
                <div><strong>المعرف الفريد / UUID:</strong> <span style={{ fontSize: 10, fontFamily: "monospace" }}>{invoice.uuid}</span></div>
              </div>
            </div>

            {/* Official QR Code Box */}
            <div style={{ textAlign: "center" }}>
              <canvas ref={qrCanvasRef} style={{ display: "block", margin: "0 auto", borderRadius: 4 }} />
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                رمز الاستجابة السريعة المعتمد ZATCA QR
              </div>
            </div>
          </div>

          {/* Seller & Buyer Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 24 }}>
            {/* Seller Details */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid #e5e7eb", paddingBottom: 4, marginBottom: 8 }}>
                بيانات المورّد / Seller Details
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div><strong>الاسم:</strong> {invoice.sellerName}</div>
                <div><strong>الرقم الضريبي / VAT No:</strong> {invoice.sellerVatNumber}</div>
                <div><strong>العنوان / Address:</strong> {invoice.sellerAddress}</div>
                <div><strong>المدينة / City:</strong> {invoice.sellerCity}</div>
              </div>
            </div>

            {/* Buyer Details */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid #e5e7eb", paddingBottom: 4, marginBottom: 8 }}>
                بيانات العميل (المشتري) / Buyer Details
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div><strong>الاسم:</strong> {invoice.buyerName}</div>
                {invoice.buyerVatNumber ? (
                  <div><strong>الرقم الضريبي / VAT No:</strong> {invoice.buyerVatNumber}</div>
                ) : (
                  <div><strong>الرقم الضريبي:</strong> غير مسجل (مستهلك نهائي B2C)</div>
                )}
                {invoice.buyerAddress && <div><strong>العنوان:</strong> {invoice.buyerAddress}</div>}
                {invoice.buyerCity && <div><strong>المدينة:</strong> {invoice.buyerCity}</div>}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "2px solid #111827" }}>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>م / #</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>السلع والخدمات / Description</th>
                <th style={{ padding: "10px 8px", textAlign: "center" }}>الكمية / Qty</th>
                <th style={{ padding: "10px 8px", textAlign: "center" }}>السعر الإفرادي / Price</th>
                <th style={{ padding: "10px 8px", textAlign: "center" }}>الخصم / Discount</th>
                <th style={{ padding: "10px 8px", textAlign: "center" }}>الخاضع للضريبة / Taxable</th>
                <th style={{ padding: "10px 8px", textAlign: "center" }}>نسبة الضريبة / Rate</th>
                <th style={{ padding: "10px 8px", textAlign: "center" }}>مبلغ الضريبة / VAT</th>
                <th style={{ padding: "10px 8px", textAlign: "left" }}>المجموع شامل الضريبة / Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>{idx + 1}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{l.itemDescription}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>{l.quantity}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>{l.unitPrice.toFixed(2)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>{l.discount.toFixed(2)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>{l.subtotal.toFixed(2)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>{l.vatRate}%</td>
                  <td style={{ padding: "10px 8px", textAlign: "center", color: "#d97706", fontWeight: 600 }}>{l.vatAmount.toFixed(2)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>{l.total.toFixed(2)} ر.س</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary Table */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 340, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #e5e7eb" }}>
                <span>الإجمالي قبل الضريبة / Total Excl. VAT:</span>
                <span style={{ fontWeight: 600 }}>{invoice.totalExcludingVat.toFixed(2)} ر.س</span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #e5e7eb", color: "#ef4444" }}>
                  <span>إجمالي الخصم / Total Discount:</span>
                  <span>-{invoice.totalDiscount.toFixed(2)} ر.س</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #e5e7eb", color: "#d97706", fontWeight: 600 }}>
                <span>ضريبة القيمة المضافة 15% / VAT (15%):</span>
                <span>{invoice.totalVat.toFixed(2)} ر.س</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#f3f4f6", fontWeight: 800, fontSize: 15 }}>
                <span>الإجمالي المستحق / Total Due:</span>
                <span style={{ color: "var(--teal-dark)" }}>{invoice.totalIncludingVat.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>

          {/* Notes and footer */}
          <div style={{ marginTop: 32, borderTop: "1px solid #e5e7eb", paddingTop: 14, fontSize: 11, color: "#6b7280", display: "flex", justifyContent: "space-between" }}>
            <div>
              {invoice.notes && <div><strong>ملاحظات:</strong> {invoice.notes}</div>}
              <div>فاتورة إلكترونية صادرة ومعتمدة وفقاً للائحة الفوترة الإلكترونية بالمملكة العربية السعودية.</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div>صفحة 1 من 1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
