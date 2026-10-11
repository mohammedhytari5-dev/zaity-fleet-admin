import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCompanyDate } from "@shared/date-utils";
import { normalizeQuickSearch } from "@/lib/quick-search";
import { appendReportSummary } from "@/lib/report-export";
import { compareReportMetric, previousReportPeriod } from "@shared/report-comparison";
import {
  CarFront,
  Wrench,
  CircleDollarSign,
  ArrowUpLeft,
  Clock3,
  ArrowDownLeft,
  Activity,
  Truck,
  Search,
  Download,
} from "lucide-react";
import type { ModuleKey, Row } from "./types";
import {
  PageHeader,
  MetricCard,
  Field,
  formatSAR,
  exportCsv,
} from "./common";

export type ReportData = {
  period: { from: string; to: string };
  fleet: Record<string, number>;
  finance: Record<string, number>;
  maintenance: Record<string, number>;
  projects: Record<string, number>;
  documents: Record<string, number>;
  people: Record<string, number>;
  details: {
    payments: Row[];
    receivablesAging: Row[];
    claims: Row[];
    contracts: Row[];
    payables: Row[];
    maintenance: Row[];
    operatingExpenses: Row[];
    vehicleProfitability: Row[];
    projectProfitability: Row[];
    clientProfitability: Row[];
    employees: Row[];
    drivers: Row[];
  };
};

export function ReportsPage({
  canAccess,
}: {
  canAccess: (key: ModuleKey) => boolean;
}) {
  const [location] = useLocation();
  const initialParams = useMemo(
    () => new URLSearchParams(location.split("?")[1] ?? ""),
    []
  );
  const lastReportLocation = useRef(location);
  const skipReportUrlWrite = useRef(false);
  const companyToday = formatCompanyDate();
  const asUtcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
  const asDateInput = (date: Date) => date.toISOString().slice(0, 10);
  const [from, setFrom] = useState(
    initialParams.get("from") || `${companyToday.slice(0, 7)}-01`
  );
  const [to, setTo] = useState(initialParams.get("to") || companyToday);
  const [section, setSection] = useState(initialParams.get("report") || "claims");
  const [search, setSearch] = useState(initialParams.get("q") || "");
  const [status, setStatus] = useState(initialParams.get("status") || "");
  const [scope, setScope] = useState(initialParams.get("scope") || "");
  const [agingBucket, setAgingBucket] = useState(initialParams.get("aging") || "");
  const [sort, setSort] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(() => {
    const key = initialParams.get("sort");
    const direction = initialParams.get("direction");
    return key && (direction === "asc" || direction === "desc")
      ? { key, direction }
      : null;
  });
  const validRange = from <= to;
  const { data, isFetching } = trpc.reports.summary.useQuery(
    { from, to },
    { staleTime: 15000, enabled: validRange }
  );
  const report = data as ReportData | undefined;
  const comparisonPeriod = validRange ? previousReportPeriod({ from, to }) : null;
  const { data: previousData, isFetching: isFetchingPrevious } =
    trpc.reports.summary.useQuery(
      comparisonPeriod ?? { from, to },
      { staleTime: 15000, enabled: validRange && Boolean(report) }
    );
  const previousReport = previousData as ReportData | undefined;

  const sections: Record<
    string,
    { title: string; rows: Row[]; columns: string[]; labels: string[] }
  > = {
    payments: {
      title: "دفعات التحصيل خلال الفترة",
      rows: report?.details.payments ?? [],
      columns: [
        "paidAt",
        "client",
        "contract",
        "claim",
        "amount",
        "method",
        "reference",
      ],
      labels: [
        "تاريخ التحصيل",
        "العميل",
        "العقد",
        "المطالبة",
        "المبلغ",
        "طريقة الدفع",
        "المرجع",
      ],
    },
    receivablesAging: {
      title: "أعمار المستحقات الحالية",
      rows: report?.details.receivablesAging ?? [],
      columns: [
        "ref",
        "client",
        "status",
        "amount",
        "paid",
        "outstanding",
        "due",
        "daysOverdue",
        "agingBucket",
      ],
      labels: [
        "المطالبة",
        "العميل",
        "الحالة",
        "قيمة المطالبة",
        "المدفوع",
        "الرصيد المفتوح",
        "تاريخ الاستحقاق",
        "أيام التأخير",
        "فئة العمر",
      ],
    },
    claims: {
      title: "المطالبات الصادرة خلال الفترة",
      rows: report?.details.claims ?? [],
      columns: [
        "ref",
        "client",
        "status",
        "amount",
        "paidInPeriod",
        "outstandingNow",
        "due",
      ],
      labels: [
        "المطالبة",
        "العميل",
        "الحالة",
        "قيمة المطالبة",
        "المحصل بالفترة",
        "المتبقي الآن",
        "الاستحقاق",
      ],
    },
    contracts: {
      title: "العقود المبدوءة خلال الفترة",
      rows: report?.details.contracts ?? [],
      columns: [
        "ref",
        "client",
        "status",
        "total",
        "collectedInPeriod",
        "startDate",
        "expiry",
      ],
      labels: [
        "العقد",
        "العميل",
        "الحالة",
        "قيمة العقد",
        "المحصل بالفترة",
        "البداية",
        "الانتهاء",
      ],
    },
    payables: {
      title: "فواتير الموردين الصادرة خلال الفترة",
      rows: report?.details.payables ?? [],
      columns: [
        "ref",
        "supplier",
        "status",
        "amount",
        "paidInPeriod",
        "remainingNow",
        "pendingApprovalAmount",
        "issueDate",
        "dueDate",
      ],
      labels: [
        "الفاتورة",
        "المورد",
        "الحالة",
        "القيمة",
        "المسدد بالفترة",
        "المتبقي المعتمد",
        "قيد الاعتماد",
        "تاريخ الفاتورة",
        "الاستحقاق",
      ],
    },
    maintenance: {
      title: "أوامر الصيانة خلال الفترة",
      rows: report?.details.maintenance ?? [],
      columns: [
        "ref",
        "vehicle",
        "status",
        ...(canAccess("finance")
          ? [
              "estimatedCost",
              ...(canAccess("payables")
                ? ["invoicedCost", "costVariance", "invoiceCount"]
                : []),
            ]
          : []),
        "start",
        "expectedReturn",
      ],
      labels: [
        "الطلب",
        "المركبة",
        "الحالة",
        ...(canAccess("finance")
          ? [
              "التقدير المعتمد",
              ...(canAccess("payables")
                ? ["الفواتير المعتمدة", "الفرق عن التقدير", "عدد الفواتير"]
                : []),
            ]
          : []),
        "الدخول",
        "العودة المتوقعة",
      ],
    },
    vehicleProfitability: {
      title: "تكلفة وعائد كل باص",
      rows: report?.details.vehicleProfitability ?? [],
      columns: [
        "plate",
        "expense",
        "revenue",
        "purchaseInPeriod",
        "netReturn",
        "busCount",
      ],
      labels: [
        "الباص",
        "المصروف بالفترة",
        "الإيراد المحصل المخصص",
        "الشراء بالفترة",
        "الصافي النقدي",
        "عدد الباصات",
      ],
    },
    projectProfitability: {
      title: "التشغيل حسب المشروع",
      rows: report?.details.projectProfitability ?? [],
      columns: ["name", "expense", "revenue", "netOperatingResult", "busCount"],
      labels: [
        "المشروع",
        "المصروفات",
        "الإيراد المحصل المخصص",
        "صافي التشغيل*",
        "عدد الباصات",
      ],
    },
    clientProfitability: {
      title: "التشغيل حسب العميل",
      rows: report?.details.clientProfitability ?? [],
      columns: ["name", "expense", "revenue", "netOperatingResult", "busCount"],
      labels: [
        "العميل",
        "المصروفات",
        "الإيراد المحصل المخصص",
        "صافي التشغيل*",
        "عدد الباصات",
      ],
    },
    operatingExpenses: {
      title: "تفاصيل مصروفات التشغيل",
      rows: report?.details.operatingExpenses ?? [],
      columns: [
        "spentAt",
        "vehicle",
        "category",
        "description",
        "vendor",
        "amount",
        "projectName",
        "clientName",
      ],
      labels: [
        "التاريخ",
        "المركبة",
        "الفئة",
        "الوصف",
        "المورد",
        "المبلغ",
        "المشروع",
        "العميل",
      ],
    },
    employees: {
      title: "الموظفون",
      rows: report?.details.employees ?? [],
      columns: [
        "employeeNo",
        "name",
        "department",
        "jobTitle",
        "hireDate",
        "status",
      ],
      labels: [
        "رقم الموظف",
        "الاسم",
        "الإدارة",
        "المسمى الوظيفي",
        "تاريخ التعيين",
        "الحالة",
      ],
    },
    drivers: {
      title: "السائقون",
      rows: report?.details.drivers ?? [],
      columns: ["name", "status", "vehicle", "renewal", "renewalStatus"],
      labels: [
        "السائق",
        "الحالة",
        "المركبة",
        "تاريخ تجديد الرخصة",
        "حالة الرخصة",
      ],
    },
  };

  const sectionModules: Record<string, ModuleKey[]> = {
    payments: ["finance"],
    receivablesAging: ["finance"],
    claims: ["finance"],
    contracts: ["finance"],
    payables: ["payables"],
    maintenance: ["maintenance"],
    vehicleProfitability: ["finance", "vehicles"],
    projectProfitability: ["finance", "projects"],
    clientProfitability: ["finance", "clients"],
    operatingExpenses: ["finance", "vehicles"],
    employees: ["employees"],
    drivers: ["drivers"],
  };

  const visibleSections = Object.fromEntries(
    Object.entries(sections).filter(([key]) =>
      sectionModules[key].every(canAccess)
    )
  );
  const activeSection = visibleSections[section]
    ? section
    : Object.keys(visibleSections)[0] ?? "";

  useEffect(() => {
    if (location === lastReportLocation.current) return;
    lastReportLocation.current = location;
    skipReportUrlWrite.current = true;
    const params = new URLSearchParams(location.split("?")[1] ?? "");
    const candidateFrom =
      params.get("from") || `${companyToday.slice(0, 7)}-01`;
    const candidateTo = params.get("to") || companyToday;
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    setFrom(validDate(candidateFrom) ? candidateFrom : `${companyToday.slice(0, 7)}-01`);
    setTo(validDate(candidateTo) ? candidateTo : companyToday);
    const requestedSection = params.get("report") || "claims";
    setSection(
      visibleSections[requestedSection]
        ? requestedSection
        : Object.keys(visibleSections)[0] ?? ""
    );
    setSearch(params.get("q") || "");
    setStatus(params.get("status") || "");
    setScope(params.get("scope") || "");
    setAgingBucket(params.get("aging") || "");
    const sortKey = params.get("sort");
    const sortDirection = params.get("direction");
    setSort(
      sortKey && (sortDirection === "asc" || sortDirection === "desc")
        ? { key: sortKey, direction: sortDirection }
        : null
    );
  }, [location, companyToday, visibleSections]);

  useEffect(() => {
    if (skipReportUrlWrite.current) {
      skipReportUrlWrite.current = false;
      return;
    }
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (visibleSections[activeSection]) params.set("report", activeSection);
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (scope) params.set("scope", scope);
    if (agingBucket) params.set("aging", agingBucket);
    if (sort) {
      params.set("sort", sort.key);
      params.set("direction", sort.direction);
    }
    const next = `/dashboard/reports?${params.toString()}`;
    if (`${location}` !== next)
      window.history.replaceState(window.history.state, "", next);
  }, [
    location,
    from,
    to,
    activeSection,
    search,
    status,
    scope,
    agingBucket,
    sort,
    visibleSections,
  ]);

  const current = visibleSections[activeSection];
  const contextualKey: Record<string, string> = {
    payments: "client",
    receivablesAging: "client",
    claims: "client",
    contracts: "client",
    payables: "supplier",
    maintenance: "vehicle",
    vehicleProfitability: "plate",
    projectProfitability: "name",
    clientProfitability: "name",
    operatingExpenses: "category",
    employees: "department",
    drivers: "renewalStatus",
  };
  const contextualLabel: Record<string, string> = {
    payments: "العميل",
    receivablesAging: "العميل",
    claims: "العميل",
    contracts: "العميل",
    payables: "المورد",
    maintenance: "المركبة",
    vehicleProfitability: "المركبة",
    projectProfitability: "المشروع",
    clientProfitability: "العميل",
    operatingExpenses: "الفئة",
    employees: "الإدارة",
    drivers: "حالة الرخصة",
  };
  const categoryKey = contextualKey[activeSection];
  const normalizedReportSearch = normalizeQuickSearch(search);
  const uniqueValues = (key: string) =>
    Array.from(
      new Set(
        (current?.rows ?? [])
          .map((row) => String(row[key] ?? ""))
          .filter((value) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b, "ar"));

  const visibleRows = (current?.rows ?? [])
    .filter((row) => {
      const matchesSearch =
        !normalizedReportSearch ||
        current.columns.some((column) =>
          normalizeQuickSearch(row[column]).includes(normalizedReportSearch)
        );
      const matchesStatus = !status || String(row.status ?? "") === status;
      const matchesScope = !scope || String(row[categoryKey] ?? "") === scope;
      const matchesAgingBucket =
        activeSection !== "receivablesAging" ||
        !agingBucket ||
        String(row.agingBucket ?? "") === agingBucket;
      return matchesSearch && matchesStatus && matchesScope && matchesAgingBucket;
    })
    .sort((a, b) => {
      if (!sort) return 0;
      const left = a[sort.key];
      const right = b[sort.key];
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left ?? "").localeCompare(String(right ?? ""), "ar", {
              numeric: true,
              sensitivity: "base",
            });
      return sort.direction === "asc" ? comparison : -comparison;
    });

  const totalFields: Record<string, Array<{ key: string; label: string }>> = {
    payments: [{ key: "amount", label: "إجمالي التحصيل" }],
    receivablesAging: [
      { key: "amount", label: "قيمة المطالبات" },
      { key: "paid", label: "المدفوع" },
      { key: "outstanding", label: "الرصيد المفتوح" },
    ],
    claims: [
      { key: "amount", label: "إجمالي المطالبات" },
      { key: "paidInPeriod", label: "المحصل بالفترة" },
      { key: "outstandingNow", label: "المتبقي الآن" },
    ],
    contracts: [
      { key: "total", label: "قيمة العقود" },
      { key: "collectedInPeriod", label: "المحصل بالفترة" },
    ],
    payables: [
      { key: "amount", label: "إجمالي الفواتير" },
      { key: "paidInPeriod", label: "المسدد بالفترة" },
      { key: "remainingNow", label: "المتبقي المعتمد" },
      { key: "pendingApprovalAmount", label: "فواتير قيد الاعتماد" },
    ],
    maintenance: canAccess("finance")
      ? [
          { key: "estimatedCost", label: "إجمالي التقدير" },
          ...(canAccess("payables")
            ? [
                { key: "invoicedCost", label: "إجمالي الفواتير المعتمدة" },
                { key: "costVariance", label: "الفرق عن التقدير" },
              ]
            : []),
        ]
      : [],
    vehicleProfitability: [
      { key: "expense", label: "المصروف" },
      { key: "revenue", label: "الإيراد" },
      { key: "purchaseInPeriod", label: "شراء الأصول" },
      { key: "netReturn", label: "الصافي النقدي" },
    ],
    projectProfitability: [
      { key: "expense", label: "المصروف" },
      { key: "revenue", label: "الإيراد" },
      { key: "netOperatingResult", label: "صافي التشغيل" },
    ],
    clientProfitability: [
      { key: "expense", label: "المصروف" },
      { key: "revenue", label: "الإيراد" },
      { key: "netOperatingResult", label: "صافي التشغيل" },
    ],
    operatingExpenses: [{ key: "amount", label: "إجمالي المصروفات" }],
  };

  const toAmount = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const digits: Record<string, string> = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
    };
    const normalized = String(value ?? "")
      .replace(/[٠-٩]/g, (digit) => digits[digit])
      .replace(/[٬,]/g, "")
      .replace(/[^0-9.\-]/g, "");
    return Number(normalized) || 0;
  };

  const filteredTotals = (totalFields[activeSection] ?? []).map((field) => ({
    ...field,
    value: visibleRows.reduce((sum, row) => sum + toAmount(row[field.key]), 0),
  }));

  const setPeriod = (days: number | "month" | "quarter" | "year") => {
    const endValue = formatCompanyDate();
    const start = asUtcDate(endValue);
    if (days === "month") start.setUTCDate(1);
    else if (days === "quarter")
      start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
    else if (days === "year") start.setUTCMonth(0, 1);
    else start.setUTCDate(start.getUTCDate() - days + 1);
    setFrom(asDateInput(start));
    setTo(endValue);
  };

  const switchSection = (key: string) => {
    setSection(key);
    setSearch("");
    setStatus("");
    setScope("");
    setAgingBucket("");
    setSort(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="الإدارة / التقارير"
        title="التقارير"
        description="ملخص موحد للأسطول والمالية والصيانة والمشاريع والموظفين ضمن فترة قابلة للتحديد والتصدير."
      />
      <div className="surface report-period-panel">
        <div className="report-period-head">
          <div>
            <strong>نطاق التقرير</strong>
            <span>اختر فترة جاهزة أو حدّد التواريخ يدويًا</span>
          </div>
          <div className="report-presets">
            {[
              ["اليوم", 1],
              ["7 أيام", 7],
              ["30 يومًا", 30],
              ["هذا الشهر", "month"],
              ["هذا الربع", "quarter"],
              ["هذه السنة", "year"],
            ].map(([label, days]) => (
              <button
                key={String(label)}
                className="report-preset"
                onClick={() => setPeriod(days as number | "month" | "quarter" | "year")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="report-period-fields">
          <Field label="من تاريخ" type="date" value={from} onChange={setFrom} />
          <Field label="إلى تاريخ" type="date" value={to} onChange={setTo} />
          <div className="report-fetch-state">
            <span
              className={`report-state-dot ${
                isFetching ? "loading" : validRange && report ? "ready" : "error"
              }`}
            />
            <span>
              {!validRange
                ? "نطاق التاريخ غير صالح"
                : isFetching
                ? "جارٍ تحديث التقرير…"
                : report
                ? `${report.period.from} — ${report.period.to}`
                : "تعذر تحميل البيانات"}
            </span>
          </div>
        </div>
        {!validRange && (
          <div className="report-range-error">
            تاريخ البداية يجب أن يسبق تاريخ النهاية أو يساويه.
          </div>
        )}
      </div>

      {report && (
        <>
          <div className="metrics-grid">
            {canAccess("vehicles") && (
              <>
                <MetricCard
                  title="إجمالي الأسطول"
                  value={String(report.fleet.total)}
                  helper={
                    report.fleet.working +
                    " تعمل · " +
                    report.fleet.ready +
                    " جاهزة"
                  }
                  icon={CarFront}
                  tone="teal"
                />
                <MetricCard
                  title="في الصيانة / متوقفة"
                  value={report.fleet.maintenance + " / " + report.fleet.stopped}
                  helper="الحالة الحالية"
                  icon={Wrench}
                  tone="orange"
                />
              </>
            )}
            {canAccess("finance") && (
              <MetricCard
                title="المطالبات غير المحصلة"
                value={formatSAR(report.finance.receivableOutstanding)}
                helper={
                  "رصيد حالي · " +
                  report.finance.unpaidClaims +
                  " مطالبة · " +
                  report.finance.overdueClaims +
                  " متأخرة"
                }
                icon={CircleDollarSign}
                tone="blue"
              />
            )}
            {canAccess("payables") && (
              <MetricCard
                title="المستحقات على الشركة"
                value={formatSAR(report.finance.payablesOutstanding)}
                helper={
                  "رصيد حالي معتمد · " +
                  report.finance.overduePayables +
                  " فاتورة متأخرة"
                }
                icon={ArrowUpLeft}
                tone="orange"
              />
            )}
            {canAccess("payables") &&
              report.finance.payablesPendingApproval > 0 && (
                <MetricCard
                  title="فواتير بانتظار اعتماد المالية"
                  value={formatSAR(report.finance.payablesPendingApprovalAmount)}
                  helper={`${report.finance.payablesPendingApproval.toLocaleString(
                    "en-US"
                  )} فاتورة مرفوعة ولم تُعتمد بعد`}
                  icon={Clock3}
                  tone="violet"
                />
              )}
            {canAccess("finance") && (
              <MetricCard
                title="التحصيل بالفترة"
                value={formatSAR(report.finance.incomingInPeriod)}
                helper="الدفعات الواردة المسجلة ضمن الفترة"
                icon={ArrowDownLeft}
                tone="blue"
              />
            )}
            {canAccess("payables") && (
              <MetricCard
                title="الصرف بالفترة"
                value={formatSAR(report.finance.outgoingInPeriod)}
                helper="الدفعات الصادرة المسجلة ضمن الفترة"
                icon={Activity}
                tone="violet"
              />
            )}
            {canAccess("finance") && canAccess("vehicles") && (
              <MetricCard
                title="تكلفة / إيراد تشغيل الباصات"
                value={
                  formatSAR(report.finance.vehicleCostsInPeriod) +
                  " / " +
                  formatSAR(report.finance.allocatedVehicleRevenueInPeriod)
                }
                helper={
                  "الصافي مع الشراء المسجل بالفترة " +
                  formatSAR(report.finance.fleetVehicleNetInPeriod)
                }
                icon={CarFront}
                tone="teal"
              />
            )}
            {canAccess("projects") && (
              <MetricCard
                title="المشاريع النشطة"
                value={String(report.projects.activeNow)}
                helper={
                  canAccess("vehicles")
                    ? report.projects.assignedVehicles +
                      " مركبة مسندة · " +
                      report.projects.requiredVehicles +
                      " مطلوبة"
                    : report.projects.requiredVehicles + " مركبة مطلوبة"
                }
                icon={Truck}
                tone="blue"
              />
            )}
          </div>
          {comparisonPeriod && (
            <section className="surface report-comparison">
              <div className="section-head">
                <div>
                  <h2>مقارنة بالفترة السابقة</h2>
                  <span>
                    مقارنة الفترة {from} — {to} بالفترة المساوية لها{" "}
                    {comparisonPeriod.from} — {comparisonPeriod.to}
                  </span>
                </div>
                <span
                  className={`report-state-dot ${
                    isFetchingPrevious
                      ? "loading"
                      : previousReport
                      ? "ready"
                      : "error"
                  }`}
                  aria-label={
                    isFetchingPrevious
                      ? "جار تحميل المقارنة"
                      : previousReport
                      ? "المقارنة جاهزة"
                      : "تعذرت المقارنة"
                  }
                />
              </div>
              {previousReport ? (
                <div className="report-comparison-grid">
                  {[
                    ...(canAccess("finance")
                      ? [
                          {
                            key: "incoming",
                            label: "التحصيل الوارد",
                            current: report.finance.incomingInPeriod,
                            previous: previousReport.finance.incomingInPeriod,
                            increaseIsFavorable: true,
                          },
                        ]
                      : []),
                    ...(canAccess("payables")
                      ? [
                          {
                            key: "outgoing",
                            label: "الصرف للموردين",
                            current: report.finance.outgoingInPeriod,
                            previous: previousReport.finance.outgoingInPeriod,
                            increaseIsFavorable: false,
                          },
                        ]
                      : []),
                    ...(canAccess("maintenance")
                      ? [
                          {
                            key: "maintenance",
                            label: "تكلفة الصيانة",
                            current: report.maintenance.costInPeriod,
                            previous: previousReport.maintenance.costInPeriod,
                            increaseIsFavorable: false,
                          },
                        ]
                      : []),
                  ].map((item) => {
                    const comparison = compareReportMetric(
                      item.current,
                      item.previous,
                      item.increaseIsFavorable
                    );
                    const trend =
                      comparison.direction === "up"
                        ? `زيادة ${comparison.percent}%`
                        : comparison.direction === "down"
                        ? `انخفاض ${comparison.percent}%`
                        : comparison.direction === "new"
                        ? "بدأ التسجيل"
                        : "دون تغير";
                    return (
                      <div className="report-comparison-item" key={item.key}>
                        <span>{item.label}</span>
                        <strong>{formatSAR(item.current)}</strong>
                        <small className={comparison.tone}>
                          {trend} · السابقة {formatSAR(item.previous)}
                        </small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="field-note">
                  {isFetchingPrevious
                    ? "جار تحميل بيانات المقارنة…"
                    : "تعذر تحميل الفترة السابقة؛ تبقى أرقام الفترة الحالية متاحة."}
                </div>
              )}
            </section>
          )}
          <div className="quick-metrics">
            {canAccess("finance") && (
              <div>
                <span>عقود جديدة بالفترة</span>
                <strong>
                  {formatSAR(report.finance.contractsValueInPeriod)}
                </strong>
              </div>
            )}
            {canAccess("maintenance") && (
              <div>
                <span>أوامر صيانة بالفترة</span>
                <strong>
                  {report.maintenance.openedInPeriod.toLocaleString("en-US")}
                </strong>
              </div>
            )}
            {canAccess("maintenance") && canAccess("finance") && (
              <div>
                <span>إنفاق الصيانة المثبت بالفترة</span>
                <strong>{formatSAR(report.maintenance.costInPeriod)}</strong>
              </div>
            )}
            {canAccess("employees") && (
              <div>
                <span>الموظفون النشطون</span>
                <strong>
                  {report.people.activeEmployees.toLocaleString("en-US")}
                </strong>
              </div>
            )}
            {canAccess("drivers") && (
              <div>
                <span>السائقون المتاحون</span>
                <strong>
                  {report.people.availableDrivers.toLocaleString("en-US")}
                </strong>
              </div>
            )}
            {canAccess("documents") && (
              <>
                <div>
                  <span>مستندات تنتهي خلال الفترة</span>
                  <strong className="amber-text">
                    {report.documents.expiringInPeriod.toLocaleString("en-US")}
                  </strong>
                </div>
                <div>
                  <span>مستندات منتهية الآن</span>
                  <strong className="red-text">
                    {report.documents.expiredNow.toLocaleString("en-US")}
                  </strong>
                </div>
              </>
            )}
          </div>
          {current ? (
            <section className="surface report-detail-panel">
              <div className="section-head">
                <div>
                  <h2>{current.title}</h2>
                  <span>
                    {visibleRows.length.toLocaleString("en-US")} من{" "}
                    {current.rows.length.toLocaleString("en-US")} سجل
                  </span>
                </div>
                <button
                  className="btn outline"
                  disabled={!visibleRows.length}
                  onClick={() =>
                    exportCsv(
                      appendReportSummary(
                        visibleRows,
                        current.columns,
                        filteredTotals
                      ),
                      current.columns,
                      "zaity-" +
                        activeSection +
                        "-" +
                        (activeSection === "employees" ||
                        activeSection === "drivers" ||
                        activeSection === "receivablesAging"
                          ? "snapshot"
                          : `${from}-${to}`),
                      current.labels
                    )
                  }
                >
                  <Download size={15} />
                  تصدير مع الإجمالي
                </button>
              </div>
              <div className="finance-switch report-section-tabs">
                {Object.entries(visibleSections).map(([key, item]) => (
                  <button
                    key={key}
                    className={activeSection === key ? "active" : ""}
                    onClick={() => switchSection(key)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <div className="report-filter-grid">
                <label className="report-search">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ابحث في نتائج التقرير…"
                  />
                </label>
                {current.columns.includes("status") && (
                  <label className="field">
                    <span>الحالة</span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="">كل الحالات</option>
                      {uniqueValues("status").map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>{contextualLabel[activeSection]}</span>
                  <select
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                  >
                    <option value="">الكل</option>
                    {uniqueValues(categoryKey).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                {activeSection === "receivablesAging" && (
                  <label className="field">
                    <span>عمر المستحق</span>
                    <select
                      value={agingBucket}
                      onChange={(event) => setAgingBucket(event.target.value)}
                    >
                      <option value="">كل الفئات</option>
                      {uniqueValues("agingBucket").map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className="btn ghost report-reset"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setScope("");
                    setAgingBucket("");
                    setSort(null);
                  }}
                >
                  مسح الفلاتر
                </button>
              </div>
              {filteredTotals.length > 0 && (
                <>
                  <div className="report-filter-total-heading">
                    <strong>إجماليات النتائج المطابقة</strong>
                    <span>تُعاد حسابها بعد كل تغيير في البحث أو الفلاتر</span>
                  </div>
                  <div className="quick-metrics report-filter-totals">
                    <div>
                      <span>السجلات المطابقة</span>
                      <strong>{visibleRows.length.toLocaleString("en-US")}</strong>
                    </div>
                    {filteredTotals.map((total) => (
                      <div key={total.key}>
                        <span>{total.label}</span>
                        <strong>{formatSAR(total.value)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {current.labels.map((label, index) => {
                        const key = current.columns[index];
                        return (
                          <th key={key}>
                            <button
                              className="report-sort"
                              onClick={() =>
                                setSort((previous) =>
                                  previous?.key === key
                                    ? {
                                        key,
                                        direction:
                                          previous.direction === "asc"
                                            ? "desc"
                                            : "asc",
                                      }
                                    : { key, direction: "asc" }
                                )
                              }
                            >
                              {label}
                              {sort?.key === key
                                ? sort.direction === "asc"
                                  ? " ↑"
                                  : " ↓"
                                : ""}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length ? (
                      visibleRows.map((row, rowIndex) => (
                        <tr key={row.id ?? activeSection + "-" + rowIndex}>
                          {current.columns.map((column) => (
                            <td key={column}>
                              {typeof row[column] === "number" &&
                              [
                                "amount",
                                "paid",
                                "remaining",
                                "outstanding",
                                "paidInPeriod",
                                "outstandingNow",
                                "remainingNow",
                                "pendingApprovalAmount",
                                "total",
                                "collected",
                                "collectedInPeriod",
                                "expense",
                                "revenue",
                                "purchaseInPeriod",
                                "netReturn",
                                "netOperatingResult",
                                "estimatedCost",
                                "invoicedCost",
                                "costVariance",
                              ].includes(column)
                                ? formatSAR(row[column])
                                : row[column] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={current.columns.length}>
                          <div className="report-empty">
                            لا توجد نتائج تطابق الفلاتر الحالية.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="surface report-detail-panel">
              <div className="empty-state">
                <strong>لا توجد بيانات تقارير متاحة لحسابك</strong>
                <span>تواصل مع مدير النظام لإضافة صلاحيات الوحدات المطلوبة.</span>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

export default ReportsPage;
