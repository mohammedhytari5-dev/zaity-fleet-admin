import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { matchesQuickSearch } from "@/lib/quick-search";
import { isWithinUpcomingDays, formatCompanyDate } from "@shared/date-utils";
import { countOutstandingClaims, totalOutstandingClaims } from "@shared/receivables";
import {
  Activity,
  Archive,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
} from "lucide-react";
import type { Row, Contract, Claim, PaymentRow } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  MetricCard,
  ContextMenu,
  exportCsv,
  formatSAR,
  addCalendarDays,
} from "./common";

export function FinancePage({
  onAction,
  onOpenForm,
  contracts,
  claims,
  payments,
  onPaymentArchive,
}: {
  onAction: (action: string, row: Row) => void;
  onOpenForm: (row?: Row) => void;
  contracts: Contract[];
  claims: Claim[];
  payments: PaymentRow[];
  onPaymentArchive: (payment: PaymentRow) => void;
}) {
  const [location, navigate] = useLocation();
  const view: "contracts" | "claims" = location.startsWith("/dashboard/financial/claims")
    ? "claims"
    : "contracts";
  const [tab, setTab] = useState("كل العقود");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<number | null>(null);

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
    requestAnimationFrame(() =>
      document.getElementById("finance-payment-ledger")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [location]);

  const choosePaymentPeriod = (period: string) => {
    const todayText = formatCompanyDate();
    setPaymentPeriod(period);
    if (period === "all") {
      setPaymentDateFrom("");
      setPaymentDateTo("");
      return;
    }
    if (period === "month") {
      setPaymentDateFrom(`${todayText.slice(0, 7)}-01`);
      setPaymentDateTo(todayText);
      return;
    }
    if (period === "year") {
      setPaymentDateFrom(`${todayText.slice(0, 4)}-01-01`);
      setPaymentDateTo(todayText);
      return;
    }
    if (period === "30days") {
      setPaymentDateFrom(addCalendarDays(todayText, -29));
      setPaymentDateTo(todayText);
    }
  };

  const filteredPayments = payments
    .filter((payment) => {
      if (!paymentDateFrom && !paymentDateTo) return true;
      const paidAt = String(payment.paidAt || "").slice(0, 10);
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(paidAt) &&
        (!paymentDateFrom || paidAt >= paymentDateFrom) &&
        (!paymentDateTo || paidAt <= paymentDateTo)
      );
    })
    .filter((payment) => matchesQuickSearch(payment, paymentSearch));

  const isClaimOverdue = (claim: Row) => {
    const due = typeof claim.due === "string" ? claim.due.slice(0, 10) : "";
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(due) &&
      due < formatCompanyDate() &&
      !["تم صرفها", "مرفوضة", "ملغاة", "غير مرفوعة"].includes(String(claim.status))
    );
  };

  const rows = view === "contracts" ? contracts : claims;
  const filtered = rows.filter((r) => {
    const matchesSearch = matchesQuickSearch(r, search);
    const matchesTab =
      view === "contracts"
        ? tab === "كل العقود" || r.status === tab
        : tab === "كل المطالبات" || (tab === "متأخرة" ? isClaimOverdue(r) : r.status === tab);
    return matchesSearch && matchesTab;
  });

  const switchView = (nextView: "contracts" | "claims") =>
    navigate(`/dashboard/financial/${nextView}`);

  const activeContracts = contracts.filter((contract) => contract.status === "قائم");
  const totalValue = activeContracts.reduce((sum, contract) => sum + Number(contract.total || 0), 0);
  const collectedValue = activeContracts.reduce((sum, contract) => sum + Number(contract.collected || 0), 0);
  const outstandingValue = Math.max(0, totalValue - collectedValue);
  const collectionRate = totalValue ? ((collectedValue / totalValue) * 100).toFixed(1) : "0.0";
  const expiringSoon = activeContracts.filter((contract) => isWithinUpcomingDays(contract.expiry, 60)).length;

  const paymentTotal = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstandingClaims = totalOutstandingClaims(claims);
  const outstandingClaimCount = countOutstandingClaims(claims);

  return (
    <>
      <PageHeader
        eyebrow="المالية / الأداء"
        title="المالية"
        description="إدارة العقود والمطالبات والتحصيل والتقارير المالية في لوحة واحدة."
        action={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"}
        onAction={() =>
          onOpenForm(
            view === "claims"
              ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` }
              : undefined
          )
        }
      />

      <div className="finance-switch">
        <button className={view === "contracts" ? "active" : ""} onClick={() => switchView("contracts")}>
          العقود المالية
        </button>
        <button className={view === "claims" ? "active" : ""} onClick={() => switchView("claims")}>
          المطالبات المالية
        </button>
        <button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}>
          تسجيل دفعة
        </button>
      </div>

      <div className="metrics-grid finance-metrics">
        <MetricCard
          title="قيمة العقود الفعالة"
          value={formatSAR(totalValue)}
          helper={`${activeContracts.length} عقود قائمة`}
          icon={FileText}
          tone="teal"
        />
        <MetricCard
          title="المحصل"
          value={formatSAR(collectedValue)}
          helper={`${collectionRate}% من الإجمالي`}
          icon={CheckCircle2}
          tone="blue"
        />
        <MetricCard
          title="المتبقي"
          value={formatSAR(outstandingValue)}
          helper="من العقود القائمة"
          icon={Clock3}
          tone="orange"
        />
        <MetricCard
          title="عقود قاربت على الانتهاء"
          value={String(expiringSoon)}
          helper="خلال ٦٠ يومًا"
          icon={Activity}
          tone="violet"
        />
      </div>

      <TableShell
        columns={
          view === "contracts"
            ? ["رقم العقد", "العميل", "النوع", "القيمة الإجمالية", "المحصل", "تاريخ الانتهاء", "الحالة"]
            : ["رقم المطالبة", "العميل", "العقد", "القيمة", "الاستحقاق", "المدفوع", "الحالة"]
        }
        onExport={() => exportCsv(filtered, Object.keys(filtered[0] || {}).filter((k) => k !== "id"), view)}
        search={search}
        setSearch={setSearch}
        tabs={
          view === "contracts"
            ? ["كل العقود", "قائم", "مكتمل", "عرض سعر"]
            : [
                "كل المطالبات",
                "غير مرفوعة",
                "جديدة",
                "تحت الإجراء",
                "تم اعتمادها",
                "تم صرفها",
                "متأخرة",
                "مرفوضة",
                "ملغاة",
              ]
        }
        activeTab={tab}
        setActiveTab={setTab}
        addLabel={view === "contracts" ? "إنشاء عقد" : "إنشاء مطالبة"}
        onAdd={() =>
          onOpenForm(
            view === "claims"
              ? { id: Date.now(), recordType: "claim", ref: `CL-${Date.now()}` }
              : undefined
          )
        }
      >
        {filtered.map((r: any) =>
          view === "contracts" ? (
            <tr key={r.id}>
              <td>
                <strong className="table-primary">{r.ref}</strong>
                <small>
                  {r.createdAt
                    ? `أُنشئ في ${new Date(r.createdAt).toLocaleDateString("en-GB")}`
                    : "تاريخ الإنشاء غير متوفر"}
                </small>
              </td>
              <td>{r.client}</td>
              <td>{r.type}</td>
              <td>{formatSAR(r.total)}</td>
              <td>{formatSAR(r.collected)}</td>
              <td>{r.expiry}</td>
              <td>
                <Badge>{r.status}</Badge>
              </td>
              <td className="actions-cell">
                <button
                  className="row-menu-btn"
                  title="إصدار فاتورة ضريبية لهذا العقد"
                  onClick={() => navigate(`/dashboard/invoices?contractId=${r.id}`)}
                >
                  <Receipt size={16} />
                </button>
                <button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}>
                  <MoreHorizontal size={18} />
                </button>
                {menu === r.id && (
                  <ContextMenu
                    row={r}
                    module="finance"
                    onClose={() => setMenu(null)}
                    onAction={(action) => {
                      setMenu(null);
                      if (action === "create-invoice") {
                        navigate(`/dashboard/invoices?contractId=${r.id}`);
                      } else {
                        onAction(action, r);
                      }
                    }}
                  />
                )}
              </td>
            </tr>
          ) : (
            <tr key={r.id}>
              <td>
                <strong className="table-primary">{r.ref}</strong>
              </td>
              <td>{r.client}</td>
              <td>{r.contract}</td>
              <td>{formatSAR(r.amount)}</td>
              <td>{r.due}</td>
              <td>{formatSAR(r.paid)}</td>
              <td>
                <Badge>{r.status}</Badge>
                {isClaimOverdue(r) && <small className="red-text">متأخرة الاستحقاق</small>}
              </td>
              <td className="actions-cell">
                <button className="row-menu-btn" onClick={() => setMenu(menu === r.id ? null : r.id)}>
                  <MoreHorizontal size={18} />
                </button>
                {menu === r.id && (
                  <ContextMenu
                    row={r}
                    module="finance"
                    onClose={() => setMenu(null)}
                    onAction={(action) => {
                      setMenu(null);
                      onAction(action, r);
                    }}
                  />
                )}
              </td>
            </tr>
          )
        )}
      </TableShell>

      <section
        id="finance-payment-ledger"
        className="surface mini-table"
        style={{ marginTop: "1rem", scrollMarginTop: "1rem" }}
      >
        <div className="section-head">
          <div>
            <h2>سجل الدفعات والتحصيل</h2>
            <span>
              {filteredPayments.length} من {payments.length} دفعة تطابق البحث والفترة
            </span>
          </div>
          <div className="row-actions">
            <button
              className="btn outline"
              disabled={!filteredPayments.length}
              onClick={() =>
                exportCsv(
                  filteredPayments.map((payment) => ({
                    ...payment,
                    link: payment.contractId
                      ? `عقد #${payment.contractId}`
                      : payment.claimId
                      ? `مطالبة #${payment.claimId}`
                      : "غير مرتبط",
                  })),
                  ["paidAt", "amount", "method", "reference", "link"],
                  "payments-ledger",
                  ["التاريخ", "المبلغ (SAR)", "طريقة الدفع", "المرجع", "الربط"]
                )
              }
            >
              <Download size={15} />
              تصدير النتائج
            </button>
            <button className="btn outline" onClick={() => onOpenForm({ id: Date.now(), recordType: "payment" })}>
              <Plus size={15} />
              تسجيل دفعة
            </button>
          </div>
        </div>

        <div className="report-filter-grid finance-period-filter">
          <label className="report-search">
            <Search size={15} />
            <input
              value={paymentSearch}
              onChange={(event) => setPaymentSearch(event.target.value)}
              placeholder="ابحث بالمرجع أو طريقة الدفع…"
            />
          </label>
          <label className="field">
            <span>الفترة</span>
            <select value={paymentPeriod} onChange={(event) => choosePaymentPeriod(event.target.value)}>
              <option value="all">كل الفترات</option>
              <option value="month">هذا الشهر</option>
              <option value="30days">آخر 30 يومًا</option>
              <option value="year">هذا العام</option>
              <option value="custom">تخصيص الفترة</option>
            </select>
          </label>
          <label className="field">
            <span>من تاريخ</span>
            <input
              type="date"
              value={paymentDateFrom}
              onChange={(event) => {
                setPaymentPeriod("custom");
                setPaymentDateFrom(event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>إلى تاريخ</span>
            <input
              type="date"
              value={paymentDateTo}
              onChange={(event) => {
                setPaymentPeriod("custom");
                setPaymentDateTo(event.target.value);
              }}
            />
          </label>
        </div>

        {filteredPayments.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>طريقة الدفع</th>
                  <th>المرجع</th>
                  <th>الربط</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paidAt}</td>
                    <td>{formatSAR(payment.amount)}</td>
                    <td>{payment.method}</td>
                    <td>{payment.reference}</td>
                    <td>
                      {payment.contractId ? (
                        <span style={{ fontWeight: 600, color: "var(--teal-dark)" }}>عقد #{payment.contractId}</span>
                      ) : payment.claimId ? (
                        <span style={{ color: "#2563eb" }}>مطالبة #{payment.claimId}</span>
                      ) : (
                        "غير مرتبط"
                      )}
                    </td>
                    <td className="actions-cell">
                      <button
                        className="row-menu-btn"
                        title="تعديل الدفعة"
                        onClick={() => onOpenForm({ ...payment, recordType: "payment" })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="row-menu-btn danger"
                        title="إلغاء الدفعة"
                        onClick={() => onPaymentArchive(payment)}
                      >
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "1.5rem" }}>
            {payments.length ? (
              <>
                <strong>لا توجد دفعات تطابق البحث والفترة المحددة</strong>
                <span>غيّر كلمات البحث أو نطاق التاريخ لعرض نتائج أخرى.</span>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setPaymentSearch("");
                    choosePaymentPeriod("all");
                  }}
                >
                  مسح الفلاتر
                </button>
              </>
            ) : (
              <>
                <strong>لا توجد دفعات مسجلة</strong>
                <span>سجّل أول دفعة من زر تسجيل دفعة.</span>
              </>
            )}
          </div>
        )}
      </section>

      <section className="surface" style={{ marginTop: "1rem", padding: "1.25rem" }}>
        <div className="section-head">
          <div>
            <h2>تقرير مالي مختصر</h2>
            <span>الدفعات ضمن الفترة المحددة؛ رصيد المطالبات والعقود يعكس الحالة الحالية</span>
          </div>
          <button
            className="btn outline"
            onClick={() =>
              exportCsv(
                [
                  { id: 1, metric: "إجمالي العقود القائمة", value: totalValue },
                  { id: 2, metric: "إجمالي الدفعات", value: paymentTotal },
                  { id: 3, metric: "المطالبات المتبقية حاليًا", value: outstandingClaims },
                  { id: 4, metric: "من تاريخ", value: paymentDateFrom || "كل الفترات" },
                  { id: 5, metric: "إلى تاريخ", value: paymentDateTo || "كل الفترات" },
                ],
                ["metric", "value"],
                "financial-report"
              )
            }
          >
            <Download size={15} />
            تصدير التقرير
          </button>
        </div>
        <div className="metrics-grid finance-metrics">
          <MetricCard
            title="إجمالي الدفعات"
            value={formatSAR(paymentTotal)}
            helper={`${filteredPayments.length} دفعة في الفترة`}
            icon={CircleDollarSign}
            tone="blue"
          />
          <MetricCard
            title="متبقي المطالبات"
            value={formatSAR(outstandingClaims)}
            helper={`${outstandingClaimCount} مطالبة غير محصلة`}
            icon={Clock3}
            tone="orange"
          />
          <MetricCard
            title="نسبة التحصيل"
            value={`${collectionRate}%`}
            helper="من العقود القائمة"
            icon={CheckCircle2}
            tone="teal"
          />
        </div>
      </section>
    </>
  );
}

export default FinancePage;
