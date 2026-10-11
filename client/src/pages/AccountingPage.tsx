import { useState, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  DollarSign,
  PieChart,
  Scale,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ACCOUNT_TYPE_LABELS,
  NORMAL_BALANCE_FOR_TYPE,
  type AccountType,
  type NormalBalance,
} from "../../../shared/accounting-domain";

interface AccountingPageProps {
  canAccessFinance?: boolean;
}

export default function AccountingPage({ canAccessFinance = true }: AccountingPageProps) {
  const [activeTab, setActiveTab] = useState<
    "accounts" | "entries" | "ledger" | "trial-balance" | "statements" | "periods"
  >("accounts");

  const [statementSubTab, setStatementSubTab] = useState<"income" | "balance">("income");

  // Accounts state
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all");
  const [accountSearch, setAccountSearch] = useState("");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState<AccountType>("asset");
  const [newAccountParentId, setNewAccountParentId] = useState<string>("");
  const [newAccountDescription, setNewAccountDescription] = useState("");

  // Entries state
  const [entrySearch, setEntrySearch] = useState("");
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEntryDescription, setNewEntryDescription] = useState("");
  const [newEntryReference, setNewEntryReference] = useState("");
  const [newEntryLines, setNewEntryLines] = useState<
    Array<{ accountId: number; debit: number; credit: number; description: string }>
  >([
    { accountId: 0, debit: 0, credit: 0, description: "" },
    { accountId: 0, debit: 0, credit: 0, description: "" },
  ]);
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);

  // Ledger state
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<number | null>(null);
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");

  // Trial Balance state
  const [trialBalanceAsOfDate, setTrialBalanceAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Fiscal Periods state
  const [isNewPeriodOpen, setIsNewPeriodOpen] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const accountsQuery = trpc.accounting.listAccounts.useQuery(undefined);
  const entriesQuery = trpc.accounting.listEntries.useQuery(undefined);
  const periodsQuery = trpc.accounting.listPeriods.useQuery();
  const trialBalanceQuery = trpc.accounting.trialBalance.useQuery({
    asOfDate: trialBalanceAsOfDate || undefined,
  });
  const incomeStatementQuery = trpc.accounting.incomeStatement.useQuery({
    startDate: "2026-01-01",
    endDate: new Date().toISOString().slice(0, 10),
  });
  const balanceSheetQuery = trpc.accounting.balanceSheet.useQuery({
    asOfDate: new Date().toISOString().slice(0, 10),
  });

  const ledgerQuery = trpc.accounting.accountLedger.useQuery(
    {
      accountId: selectedLedgerAccountId ?? 0,
      startDate: ledgerStartDate || undefined,
      endDate: ledgerEndDate || undefined,
    },
    { enabled: Boolean(selectedLedgerAccountId && selectedLedgerAccountId > 0) }
  );

  // Mutations
  const seedAccountsMutation = trpc.accounting.seedStandardAccounts.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.accounting.listAccounts.invalidate();
      utils.accounting.trialBalance.invalidate();
    },
    onError: (err) => toast.error(`خطأ في التأسيس: ${err.message}`),
  });

  const createAccountMutation = trpc.accounting.createAccount.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الحساب بنجاح");
      setIsAddAccountOpen(false);
      setNewAccountCode("");
      setNewAccountName("");
      setNewAccountDescription("");
      utils.accounting.listAccounts.invalidate();
    },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  const createEntryMutation = trpc.accounting.createEntry.useMutation({
    onSuccess: () => {
      toast.success("تم ترحيل قيد اليومية بنجاح");
      setIsNewEntryOpen(false);
      setNewEntryDescription("");
      setNewEntryReference("");
      setNewEntryLines([
        { accountId: 0, debit: 0, credit: 0, description: "" },
        { accountId: 0, debit: 0, credit: 0, description: "" },
      ]);
      utils.accounting.listEntries.invalidate();
      utils.accounting.trialBalance.invalidate();
      utils.accounting.incomeStatement.invalidate();
      utils.accounting.balanceSheet.invalidate();
      if (selectedLedgerAccountId) utils.accounting.accountLedger.invalidate();
    },
    onError: (err) => toast.error(`تعذر ترحيل القيد: ${err.message}`),
  });

  const reverseEntryMutation = trpc.accounting.reverseEntry.useMutation({
    onSuccess: () => {
      toast.success("تم توليد قيد عكسي وعكس القيد بنجاح");
      utils.accounting.listEntries.invalidate();
      utils.accounting.trialBalance.invalidate();
      utils.accounting.incomeStatement.invalidate();
      utils.accounting.balanceSheet.invalidate();
      if (selectedLedgerAccountId) utils.accounting.accountLedger.invalidate();
    },
    onError: (err) => toast.error(`تعذر عكس القيد: ${err.message}`),
  });

  const createPeriodMutation = trpc.accounting.createPeriod.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة الفترة المالية بنجاح");
      setIsNewPeriodOpen(false);
      setNewPeriodName("");
      setNewPeriodStart("");
      setNewPeriodEnd("");
      utils.accounting.listPeriods.invalidate();
    },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  const closePeriodMutation = trpc.accounting.closePeriod.useMutation({
    onSuccess: () => {
      toast.success("تم إقفال الفترة المالية بنجاح");
      utils.accounting.listPeriods.invalidate();
    },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  const reopenPeriodMutation = trpc.accounting.reopenPeriod.useMutation({
    onSuccess: () => {
      toast.success("تمت إعادة فتح الفترة المالية");
      utils.accounting.listPeriods.invalidate();
    },
    onError: (err) => toast.error(`خطأ: ${err.message}`),
  });

  // Filtered accounts
  const accountsList = accountsQuery.data ?? [];
  const filteredAccounts = useMemo(() => {
    return accountsList.filter((acc) => {
      const matchType =
        accountTypeFilter === "all" || acc.type === accountTypeFilter;
      const matchSearch =
        !accountSearch ||
        acc.code.includes(accountSearch) ||
        acc.name.includes(accountSearch);
      return matchType && matchSearch;
    });
  }, [accountsList, accountTypeFilter, accountSearch]);

  // Entry balancing calculation
  const entryTotalDebit = useMemo(() => {
    return newEntryLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  }, [newEntryLines]);

  const entryTotalCredit = useMemo(() => {
    return newEntryLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  }, [newEntryLines]);

  const entryDiff = Math.abs(entryTotalDebit - entryTotalCredit);
  const isEntryBalanced = entryDiff < 0.005 && entryTotalDebit > 0;

  const handleAddLine = () => {
    setNewEntryLines((prev) => [
      ...prev,
      { accountId: 0, debit: 0, credit: 0, description: "" },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (newEntryLines.length <= 2) {
      toast.error("يجب الإبقاء على سطرين على الأقل للقيد المزدوج");
      return;
    }
    setNewEntryLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: "accountId" | "debit" | "credit" | "description",
    value: any
  ) => {
    setNewEntryLines((prev) => {
      const updated = [...prev];
      if (field === "debit") {
        const num = parseFloat(value) || 0;
        updated[index] = { ...updated[index], debit: num, credit: num > 0 ? 0 : updated[index].credit };
      } else if (field === "credit") {
        const num = parseFloat(value) || 0;
        updated[index] = { ...updated[index], credit: num, debit: num > 0 ? 0 : updated[index].debit };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handlePostEntry = () => {
    if (!newEntryDescription.trim()) {
      toast.error("يرجى إدخال وصف للقيد");
      return;
    }
    if (!isEntryBalanced) {
      toast.error(`القيد غير متوازن: الفارق (${entryDiff.toFixed(2)}) ر.س`);
      return;
    }
    const hasInvalidAccount = newEntryLines.some((l) => !l.accountId || l.accountId <= 0);
    if (hasInvalidAccount) {
      toast.error("يرجى تحديد حساب محاسبي صحيح لكل سطر");
      return;
    }

    createEntryMutation.mutate({
      entryDate: newEntryDate,
      description: newEntryDescription,
      reference: newEntryReference || undefined,
      lines: newEntryLines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description || undefined,
      })),
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                النواة المحاسبية ودفتر الأستاذ العام
              </h1>
              <p className="text-sm text-muted-foreground">
                إدارة شجرة الحسابات، قيود اليومية المزدوجة، ميزان المراجعة، والقوائم المالية الرسمية
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Cards */}
        <div className="flex items-center gap-2">
          {accountsList.length === 0 && (
            <button
              onClick={() => seedAccountsMutation.mutate({})}
              disabled={seedAccountsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              تأسيس الدليل المحاسبي القياسي (بنقرة واحدة)
            </button>
          )}

          {activeTab === "accounts" && (
            <button
              onClick={() => setIsAddAccountOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة حساب
            </button>
          )}

          {activeTab === "entries" && (
            <button
              onClick={() => setIsNewEntryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              قيد يومية جديد
            </button>
          )}

          {activeTab === "periods" && (
            <button
              onClick={() => setIsNewPeriodOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              فترة مالية جديدة
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-medium">
            <span>إجمالي الأصول</span>
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {balanceSheetQuery.data?.totalAssets?.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) ?? "0.00"} ر.س
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-medium">
            <span>إجمالي الالتزامات</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {balanceSheetQuery.data?.totalLiabilities?.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) ?? "0.00"} ر.س
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-medium">
            <span>صافي الدخل التشغيلي</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600">
            {incomeStatementQuery.data?.netIncome?.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) ?? "0.00"} ر.س
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-medium">
            <span>توازن ميزان المراجعة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {trialBalanceQuery.data?.isBalanced ? "متوازن وموثّق" : "جارٍ الفحص"}
            </span>
            <span className="text-xs text-muted-foreground">
              (المدين = الدائن)
            </span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 ${
            activeTab === "accounts"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          شجرة الحسابات ({accountsList.length})
        </button>

        <button
          onClick={() => setActiveTab("entries")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 ${
            activeTab === "entries"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          قيود اليومية العامة ({entriesQuery.data?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 ${
            activeTab === "ledger"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          دفتر الأستاذ العام
        </button>

        <button
          onClick={() => setActiveTab("trial-balance")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 ${
            activeTab === "trial-balance"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="w-4 h-4" />
          ميزان المراجعة
        </button>

        <button
          onClick={() => setActiveTab("statements")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 ${
            activeTab === "statements"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <PieChart className="w-4 h-4" />
          القوائم المالية (الدخل والميزانية)
        </button>

        <button
          onClick={() => setActiveTab("periods")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-colors border-b-2 ${
            activeTab === "periods"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="w-4 h-4" />
          الفترات المالية
        </button>
      </div>

      {/* TAB 1: ACCOUNTS TREE */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث برقم الحساب أو الاسم..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-muted-foreground">التصنيف:</span>
              {["all", "asset", "liability", "equity", "revenue", "expense"].map((t) => (
                <button
                  key={t}
                  onClick={() => setAccountTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    accountTypeFilter === t
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t === "all" ? "الكل" : ACCOUNT_TYPE_LABELS[t as AccountType]}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">رقم الحساب</th>
                    <th className="py-3 px-4">اسم الحساب</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4">طبيعة الرصيد</th>
                    <th className="py-3 px-4">المستوى</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        {accountsList.length === 0 ? (
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                              <Layers className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-foreground">شجرة الحسابات فارغة حالياً</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              يمكنك تأسيس الدليل المحاسبي القياسي لشركات النقل واللوجستيات بنقرة واحدة (أصول، التزامات، حقوق ملكية، إيرادات، مصروفات)، أو البدء بإضافة حساب مخصص يدوياً.
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-2">
                              <button
                                onClick={() => seedAccountsMutation.mutate({})}
                                disabled={seedAccountsMutation.isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                              >
                                <Sparkles className="w-4 h-4" />
                                {seedAccountsMutation.isPending ? "جارٍ التأسيس..." : "تأسيس الدليل القياسي (بنقرة واحدة)"}
                              </button>
                              <button
                                onClick={() => setIsAddAccountOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-colors shadow-sm"
                              >
                                <Plus className="w-4 h-4" />
                                إضافة حساب يدوياً
                              </button>
                            </div>
                          </div>
                        ) : (
                          "لا توجد حسابات مطابقة للبحث أو التصنيف المحدد."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-primary">
                          {acc.code}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <span style={{ paddingRight: `${(acc.level - 1) * 16}px` }}>
                            {acc.name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">
                            {ACCOUNT_TYPE_LABELS[acc.type as AccountType]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {acc.normalBalance === "debit" ? "مدين (Debit)" : "دائن (Credit)"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs font-mono">
                          مستوى {acc.level}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              acc.isActive
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-zinc-500/10 text-zinc-600"
                            }`}
                          >
                            {acc.isActive ? "نشط" : "معطل"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedLedgerAccountId(acc.id);
                              setActiveTab("ledger");
                            }}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            كشف أستاذ
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JOURNAL ENTRIES */}
      {activeTab === "entries" && (
        <div className="space-y-4">
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">رقم القيد</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">البيان / الوصف</th>
                    <th className="py-3 px-4">المرجع</th>
                    <th className="py-3 px-4">إجمالي المدين</th>
                    <th className="py-3 px-4">إجمالي الدائن</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(entriesQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        لا توجد قيود يومية مسجلة بعد.
                      </td>
                    </tr>
                  ) : (
                    (entriesQuery.data ?? []).map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {entry.entryNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {entry.entryDate}
                        </td>
                        <td className="py-3 px-4 font-medium max-w-xs truncate">
                          {entry.description}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs font-mono">
                          {entry.reference || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-600">
                          {entry.totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-600">
                          {entry.totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              entry.status === "posted"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : entry.status === "reversed"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-zinc-500/10 text-zinc-600"
                            }`}
                          >
                            {entry.status === "posted"
                              ? "مُرحّل"
                              : entry.status === "reversed"
                              ? "معكوس"
                              : "مسودة"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {entry.status === "posted" && !entry.isReversed && (
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من عكس القيد ${entry.entryNumber}؟ سيتم إنشاء قيد عكسي تلقائياً.`)) {
                                    reverseEntryMutation.mutate({ id: entry.id });
                                  }
                                }}
                                disabled={reverseEntryMutation.isPending}
                                className="text-xs text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                عكس القيد
                              </button>
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
        </div>
      )}

      {/* TAB 3: GENERAL LEDGER */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-card border border-border p-4 rounded-xl">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                اختر الحساب لعرض كشف الأستاذ:
              </label>
              <select
                value={selectedLedgerAccountId || ""}
                onChange={(e) => setSelectedLedgerAccountId(Number(e.target.value))}
                className="w-full text-sm bg-background border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- اختر حساباً --</option>
                {accountsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({ACCOUNT_TYPE_LABELS[a.type as AccountType]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                من تاريخ:
              </label>
              <input
                type="date"
                value={ledgerStartDate}
                onChange={(e) => setLedgerStartDate(e.target.value)}
                className="text-sm bg-background border border-border rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                إلى تاريخ:
              </label>
              <input
                type="date"
                value={ledgerEndDate}
                onChange={(e) => setLedgerEndDate(e.target.value)}
                className="text-sm bg-background border border-border rounded-lg p-2"
              />
            </div>
          </div>

          {selectedLedgerAccountId && ledgerQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">الرصيد الافتتاحي</div>
                  <div className="text-lg font-bold">
                    {ledgerQuery.data.openingBalance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">إجمالي الحركات المدينة</div>
                  <div className="text-lg font-bold text-emerald-600">
                    {ledgerQuery.data.totalPeriodDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">إجمالي الحركات الدائنة</div>
                  <div className="text-lg font-bold text-blue-600">
                    {ledgerQuery.data.totalPeriodCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
                <div className="bg-muted/40 p-3 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground">الرصيد الختامي</div>
                  <div className="text-lg font-bold text-primary">
                    {ledgerQuery.data.closingBalance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs font-semibold">
                    <tr>
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4">رقم القيد</th>
                      <th className="py-3 px-4">المرجع</th>
                      <th className="py-3 px-4">البيان</th>
                      <th className="py-3 px-4">مدين</th>
                      <th className="py-3 px-4">دائن</th>
                      <th className="py-3 px-4 font-bold">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {ledgerQuery.data.lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground">
                          لا توجد حركات مسجلة لهذا الحساب في الفترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      ledgerQuery.data.lines.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="py-3 px-4 font-mono text-xs">{row.entryDate}</td>
                          <td className="py-3 px-4 font-mono text-primary font-semibold">{row.entryNumber}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">{row.reference || "—"}</td>
                          <td className="py-3 px-4">{row.description}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-emerald-600">
                            {row.debit > 0 ? row.debit.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-blue-600">
                            {row.credit > 0 ? row.credit.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">
                            {row.balance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              يرجى اختيار حساب من القائمة أعلاه لعرض كشف دفتر الأستاذ العام الخاص به.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TRIAL BALANCE */}
      {activeTab === "trial-balance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground">حتى تاريخ:</label>
              <input
                type="date"
                value={trialBalanceAsOfDate}
                onChange={(e) => setTrialBalanceAsOfDate(e.target.value)}
                className="text-sm bg-background border border-border rounded-lg p-2"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">حالة التوازن:</span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  trialBalanceQuery.data?.isBalanced
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                }`}
              >
                {trialBalanceQuery.data?.isBalanced
                  ? "✓ متوازن محاسبياً (Debit = Credit)"
                  : "✗ غير متوازن!"}
              </span>
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs font-semibold">
                <tr>
                  <th className="py-3 px-4">كود الحساب</th>
                  <th className="py-3 px-4">اسم الحساب</th>
                  <th className="py-3 px-4">نوع الحساب</th>
                  <th className="py-3 px-4 text-emerald-700">مجموع المدين</th>
                  <th className="py-3 px-4 text-blue-700">مجموع الدائن</th>
                  <th className="py-3 px-4 font-bold text-emerald-700">رصيد مدين</th>
                  <th className="py-3 px-4 font-bold text-blue-700">رصيد دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(trialBalanceQuery.data?.accounts ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono font-semibold text-primary">{row.code}</td>
                    <td className="py-3 px-4 font-medium">{row.name}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[row.type as AccountType]}</td>
                    <td className="py-3 px-4 font-mono text-emerald-600">
                      {row.totalDebit > 0 ? row.totalDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-600">
                      {row.totalCredit > 0 ? row.totalCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      {row.balanceDebit > 0 ? row.balanceDebit.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {row.balanceCredit > 0 ? row.balanceCredit.toLocaleString("ar-SA", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/80 border-t-2 border-border font-bold">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-left font-bold">الإجمالي العام لميزان المراجعة:</td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-extrabold">
                    {trialBalanceQuery.data?.totalDebits.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </td>
                  <td className="py-3 px-4 font-mono text-blue-700 font-extrabold">
                    {trialBalanceQuery.data?.totalCredits.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: FINANCIAL STATEMENTS */}
      {activeTab === "statements" && (
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              onClick={() => setStatementSubTab("income")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                statementSubTab === "income"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              قائمة الدخل (Income Statement)
            </button>
            <button
              onClick={() => setStatementSubTab("balance")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                statementSubTab === "balance"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              الميزانية العمومية (Balance Sheet)
            </button>
          </div>

          {statementSubTab === "income" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Revenues */}
                <div className="border border-border rounded-xl bg-card p-4 shadow-xs">
                  <h3 className="font-bold text-emerald-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    الإيرادات التشغيلية
                  </h3>
                  <div className="divide-y divide-border/60">
                    {(incomeStatementQuery.data?.revenues ?? []).map((r) => (
                      <div key={r.id} className="py-2 flex justify-between text-sm">
                        <span>{r.name}</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {r.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border mt-3 pt-2 flex justify-between font-bold text-base">
                    <span>إجمالي الإيرادات:</span>
                    <span className="font-mono text-emerald-700">
                      {incomeStatementQuery.data?.totalRevenue.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                </div>

                {/* Expenses */}
                <div className="border border-border rounded-xl bg-card p-4 shadow-xs">
                  <h3 className="font-bold text-rose-700 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    المصروفات والتكاليف
                  </h3>
                  <div className="divide-y divide-border/60">
                    {(incomeStatementQuery.data?.expenses ?? []).map((e) => (
                      <div key={e.id} className="py-2 flex justify-between text-sm">
                        <span>{e.name}</span>
                        <span className="font-mono font-bold text-rose-600">
                          {e.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border mt-3 pt-2 flex justify-between font-bold text-base">
                    <span>إجمالي المصروفات:</span>
                    <span className="font-mono text-rose-700">
                      {incomeStatementQuery.data?.totalExpense.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Income Banner */}
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-foreground">صافي الربح / الخسارة للفترة:</h4>
                  <p className="text-xs text-muted-foreground">الفارق بين إجمالي الإيرادات وإجمالي المصروفات</p>
                </div>
                <div className="text-2xl font-black font-mono text-primary">
                  {incomeStatementQuery.data?.netIncome.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assets */}
                <div className="border border-border rounded-xl bg-card p-4 shadow-xs">
                  <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    الأصول (Assets)
                  </h3>
                  <div className="divide-y divide-border/60">
                    {(balanceSheetQuery.data?.assets ?? []).map((a) => (
                      <div key={a.id} className="py-2 flex justify-between text-sm">
                        <span>{a.name}</span>
                        <span className="font-mono font-bold text-primary">
                          {a.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t-2 border-border mt-3 pt-2 flex justify-between font-bold text-base">
                    <span>إجمالي الأصول:</span>
                    <span className="font-mono text-primary font-extrabold">
                      {balanceSheetQuery.data?.totalAssets.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                </div>

                {/* Liabilities + Equity */}
                <div className="space-y-4">
                  <div className="border border-border rounded-xl bg-card p-4 shadow-xs">
                    <h3 className="font-bold text-amber-600 mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      الالتزامات (Liabilities)
                    </h3>
                    <div className="divide-y divide-border/60">
                      {(balanceSheetQuery.data?.liabilities ?? []).map((l) => (
                        <div key={l.id} className="py-2 flex justify-between text-sm">
                          <span>{l.name}</span>
                          <span className="font-mono font-bold text-amber-600">
                            {l.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border mt-3 pt-2 flex justify-between font-bold text-sm">
                      <span>إجمالي الالتزامات:</span>
                      <span className="font-mono text-amber-700">
                        {balanceSheetQuery.data?.totalLiabilities.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                      </span>
                    </div>
                  </div>

                  <div className="border border-border rounded-xl bg-card p-4 shadow-xs">
                    <h3 className="font-bold text-blue-600 mb-3 flex items-center gap-2">
                      <Scale className="w-5 h-5" />
                      حقوق الملكية (Equity)
                    </h3>
                    <div className="divide-y divide-border/60">
                      {(balanceSheetQuery.data?.equity ?? []).map((e) => (
                        <div key={e.id} className="py-2 flex justify-between text-sm">
                          <span>{e.name}</span>
                          <span className="font-mono font-bold text-blue-600">
                            {e.amount.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                          </span>
                        </div>
                      ))}
                      <div className="py-2 flex justify-between text-sm text-emerald-600 font-semibold">
                        <span>صافي أرباح الفترة الحالية (من قائمة الدخل):</span>
                        <span className="font-mono">
                          {balanceSheetQuery.data?.currentPeriodNetIncome.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-border mt-3 pt-2 flex justify-between font-bold text-sm">
                      <span>إجمالي حقوق الملكية:</span>
                      <span className="font-mono text-blue-700">
                        {balanceSheetQuery.data?.totalEquity.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                      </span>
                    </div>
                  </div>

                  {/* Liabilities + Equity Sum */}
                  <div className="border-t-2 border-border p-3 bg-muted/40 rounded-xl flex justify-between font-bold text-base">
                    <span>إجمالي الالتزامات وحقوق الملكية:</span>
                    <span className="font-mono font-extrabold text-foreground">
                      {balanceSheetQuery.data?.totalLiabilitiesAndEquity.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: FISCAL PERIODS */}
      {activeTab === "periods" && (
        <div className="space-y-4">
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs font-semibold">
                <tr>
                  <th className="py-3 px-4">اسم الفترة</th>
                  <th className="py-3 px-4">تاريخ البداية</th>
                  <th className="py-3 px-4">تاريخ النهاية</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(periodsQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      لم يتم تعريف فترات مالية بعد.
                    </td>
                  </tr>
                ) : (
                  (periodsQuery.data ?? []).map((period) => (
                    <tr key={period.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{period.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{period.startDate}</td>
                      <td className="py-3 px-4 font-mono text-xs">{period.endDate}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            period.status === "open"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {period.status === "open" ? (
                            <>
                              <Unlock className="w-3 h-3" /> مفتوحة
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" /> مقفلة
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {period.status === "open" ? (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من إقفال الفترة "${period.name}"؟ لن يُسمح بالترحيل فيها بعد الإقفال.`)) {
                                closePeriodMutation.mutate({ id: period.id });
                              }
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                          >
                            إقفال الفترة
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`هل تريد إعادة فتح الفترة "${period.name}"؟`)) {
                                reopenPeriodMutation.mutate({ id: period.id });
                              }
                            }}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            إعادة فتح
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACCOUNT */}
      {isAddAccountOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1100 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsAddAccountOpen(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            style={{
              background: "#ffffff",
              color: "#1e293b",
              maxWidth: "540px",
              boxShadow: "0 25px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div className="modal-head" style={{ borderBottom: "1px solid #e2e8f0", padding: "1.25rem 1.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0, color: "#0f766e" }}>
                  إضافة حساب جديد إلى شجرة الحسابات
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  أدخل كود واسم الحساب والتصنيف المحاسبي لإدراجه في الدليل المالي
                </p>
              </div>
              <button className="icon-btn" onClick={() => setIsAddAccountOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: "1.5rem", background: "#ffffff" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    رقم / كود الحساب (مثال: 1107) *
                  </label>
                  <input
                    type="text"
                    value={newAccountCode}
                    onChange={(e) => setNewAccountCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      fontFamily: "monospace",
                      color: "#0f172a",
                    }}
                    placeholder="1107"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    اسم الحساب الرسمي *
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      color: "#0f172a",
                    }}
                    placeholder="مثال: حساب بنك الإنماء - الحساب الجاري"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                      التصنيف المحاسبي *
                    </label>
                    <select
                      value={newAccountType}
                      onChange={(e) => setNewAccountType(e.target.value as AccountType)}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.75rem",
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "0.5rem",
                        fontSize: "0.85rem",
                        color: "#0f172a",
                      }}
                    >
                      <option value="asset">أصول (Asset)</option>
                      <option value="liability">التزامات (Liability)</option>
                      <option value="equity">حقوق ملكية (Equity)</option>
                      <option value="revenue">إيرادات (Revenue)</option>
                      <option value="expense">مصروفات (Expense)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                      طبيعة الرصيد التلقائية
                    </label>
                    <input
                      type="text"
                      disabled
                      value={NORMAL_BALANCE_FOR_TYPE[newAccountType] === "debit" ? "مدين (Debit)" : "دائن (Credit)"}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.75rem",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: "0.5rem",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    الحساب الأب (اختياري للتفرع الهيكلي)
                  </label>
                  <select
                    value={newAccountParentId}
                    onChange={(e) => setNewAccountParentId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.85rem",
                      color: "#0f172a",
                    }}
                  >
                    <option value="">-- بلا حساب أب (حساب رئيسي) --</option>
                    {accountsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    ملاحظات أو بيان الاستخدام
                  </label>
                  <textarea
                    rows={2}
                    value={newAccountDescription}
                    onChange={(e) => setNewAccountDescription(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.85rem",
                      color: "#0f172a",
                    }}
                    placeholder="وصف طبيعة الحساب واستخدامه..."
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setIsAddAccountOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={createAccountMutation.isPending}
                  onClick={() => {
                    if (!newAccountCode.trim() || !newAccountName.trim()) {
                      toast.error("يرجى إدخال رقم الحساب واسمه");
                      return;
                    }
                    createAccountMutation.mutate({
                      code: newAccountCode.trim(),
                      name: newAccountName.trim(),
                      type: newAccountType,
                      normalBalance: NORMAL_BALANCE_FOR_TYPE[newAccountType],
                      parentId: newAccountParentId ? Number(newAccountParentId) : null,
                      description: newAccountDescription.trim() || null,
                    });
                  }}
                >
                  {createAccountMutation.isPending ? "جارٍ الحفظ..." : "حفظ الحساب"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW JOURNAL ENTRY */}
      {isNewEntryOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1100 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsNewEntryOpen(false);
          }}
        >
          <div
            className="modal-card wide"
            role="dialog"
            aria-modal="true"
            style={{
              background: "#ffffff",
              color: "#1e293b",
              maxWidth: "880px",
              boxShadow: "0 25px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div className="modal-head" style={{ borderBottom: "1px solid #e2e8f0", padding: "1.25rem 1.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0, color: "#0f766e" }}>
                  إنشاء قيد يومية عام متوازن (Journal Voucher)
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  إدخال أسطر القيد المزدوج مع التدقيق الآلي لتساوي المدين والدائن
                </p>
              </div>
              <button className="icon-btn" onClick={() => setIsNewEntryOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: "1.5rem", background: "#ffffff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    تاريخ القيد *
                  </label>
                  <input
                    type="date"
                    value={newEntryDate}
                    onChange={(e) => setNewEntryDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.85rem",
                      color: "#0f172a",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    المرجع (رقم الفاتورة / العقد / الإيصال)
                  </label>
                  <input
                    type="text"
                    value={newEntryReference}
                    onChange={(e) => setNewEntryReference(e.target.value)}
                    placeholder="مثال: INV-2026-0042 أو سداد دفعة عقد #1"
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.85rem",
                      color: "#0f172a",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                  شرح وبيان القيد *
                </label>
                <input
                  type="text"
                  value={newEntryDescription}
                  onChange={(e) => setNewEntryDescription(e.target.value)}
                  placeholder="مثال: إثبات سداد دفعة عميل في الحساب البنكي"
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.5rem",
                    fontSize: "0.85rem",
                    color: "#0f172a",
                  }}
                />
              </div>

              {/* Entry Lines */}
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#0f172a" }}>
                    أسطر القيد المزدوج:
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="btn outline"
                    style={{ padding: "0.25rem 0.65rem", fontSize: "0.8rem" }}
                  >
                    <Plus size={14} /> إضافة سطر قيد
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "280px", overflowY: "auto", paddingLeft: "0.25rem" }}>
                  {newEntryLines.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "5fr 3fr 3fr 1fr",
                        gap: "0.5rem",
                        alignItems: "center",
                        background: "#f8fafc",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <select
                          value={line.accountId || ""}
                          onChange={(e) => handleLineChange(idx, "accountId", Number(e.target.value))}
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.6rem",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "0.4rem",
                            fontSize: "0.8rem",
                            color: "#0f172a",
                          }}
                        >
                          <option value="">-- اختر الحساب --</option>
                          {accountsList.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="مدين (Dr)"
                          value={line.debit || ""}
                          onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.6rem",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "0.4rem",
                            fontSize: "0.85rem",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            color: "#059669",
                            textAlign: "left",
                          }}
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="دائن (Cr)"
                          value={line.credit || ""}
                          onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.6rem",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "0.4rem",
                            fontSize: "0.85rem",
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            color: "#2563eb",
                            textAlign: "left",
                          }}
                        />
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            fontWeight: "bold",
                          }}
                          title="حذف السطر"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balancing Verification Banner */}
              <div
                style={{
                  padding: "0.85rem 1.1rem",
                  borderRadius: "0.5rem",
                  border: isEntryBalanced ? "1px solid #a7f3d0" : "1px solid #fecdd3",
                  background: isEntryBalanced ? "#f0fdf4" : "#fff1f2",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: isEntryBalanced ? "#065f46" : "#9f1239" }}>
                  {isEntryBalanced ? (
                    <>
                      <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                      <span>القيد متوازن تماماً وجاهز للترحيل</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={18} style={{ color: "#f43f5e" }} />
                      <span>القيد غير متوازن — الفارق: {entryDiff.toFixed(2)} ر.س</span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: "1rem", fontFamily: "monospace", fontSize: "0.95rem" }}>
                  <span style={{ color: "#059669" }}>المدين: {entryTotalDebit.toFixed(2)}</span>
                  <span style={{ color: "#2563eb" }}>الدائن: {entryTotalCredit.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setIsNewEntryOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!isEntryBalanced || createEntryMutation.isPending}
                  onClick={handlePostEntry}
                  style={{
                    background: isEntryBalanced ? "#0f766e" : "#94a3b8",
                    cursor: isEntryBalanced ? "pointer" : "not-allowed",
                  }}
                >
                  {createEntryMutation.isPending ? "جارٍ الترحيل..." : "ترحيل القيد رسمياً"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW FISCAL PERIOD */}
      {isNewPeriodOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1100 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsNewPeriodOpen(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            style={{
              background: "#ffffff",
              color: "#1e293b",
              maxWidth: "480px",
              boxShadow: "0 25px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div className="modal-head" style={{ borderBottom: "1px solid #e2e8f0", padding: "1.25rem 1.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", margin: 0, color: "#0f766e" }}>
                  إضافة فترة مالية جديدة
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  تحديد اسم وتواريخ بداية ونهاية الفترة المحاسبية
                </p>
              </div>
              <button className="icon-btn" onClick={() => setIsNewPeriodOpen(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: "1.5rem", background: "#ffffff" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    اسم الفترة المحاسبية *
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: السنة المالية 2026 أو الربع الأول 2026"
                    value={newPeriodName}
                    onChange={(e) => setNewPeriodName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      color: "#0f172a",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    تاريخ البداية *
                  </label>
                  <input
                    type="date"
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      color: "#0f172a",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    تاريخ النهاية *
                  </label>
                  <input
                    type="date"
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      color: "#0f172a",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setIsNewPeriodOpen(false)}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={createPeriodMutation.isPending}
                  onClick={() => {
                    if (!newPeriodName || !newPeriodStart || !newPeriodEnd) {
                      toast.error("يرجى إدخال اسم وتواريخ الفترة كاملة");
                      return;
                    }
                    createPeriodMutation.mutate({
                      name: newPeriodName,
                      startDate: newPeriodStart,
                      endDate: newPeriodEnd,
                    });
                  }}
                >
                  {createPeriodMutation.isPending ? "جارٍ الحفظ..." : "حفظ الفترة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
