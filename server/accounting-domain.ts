import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  accounts,
  fiscalPeriods,
  journalEntries,
  journalLines,
  type Account,
  type FiscalPeriod,
  type InsertAccount,
  type InsertFiscalPeriod,
  type InsertJournalEntry,
  type InsertJournalLine,
  type JournalEntry,
  type JournalLine,
} from "../drizzle/schema";
import {
  calculateRunningBalance,
  NORMAL_BALANCE_FOR_TYPE,
  STANDARD_CHART_OF_ACCOUNTS,
  validateJournalLines,
  type AccountType,
  type JournalLineInput,
  type NormalBalance,
} from "../shared/accounting-domain";
import { roundMoney, sumMoney } from "../shared/money";

export class AccountingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountingDomainError";
  }
}

export type DbClient = MySql2Database<any>;

/**
 * Generates the next sequential entry number for a given calendar year.
 * Format: JV-YYYY-00001
 */
export async function generateNextEntryNumber(
  db: DbClient,
  year: number
): Promise<string> {
  const prefix = `JV-${year}-%`;
  const result = await db
    .select({ entryNumber: journalEntries.entryNumber })
    .from(journalEntries)
    .where(sql`${journalEntries.entryNumber} LIKE ${prefix}`)
    .orderBy(desc(journalEntries.id))
    .limit(1);

  if (!result || result.length === 0) {
    return `JV-${year}-00001`;
  }

  const latest = result[0].entryNumber;
  const parts = latest.split("-");
  const lastSeq = parseInt(parts[parts.length - 1], 10);
  const nextSeq = Number.isNaN(lastSeq) ? 1 : lastSeq + 1;
  return `JV-${year}-${String(nextSeq).padStart(5, "0")}`;
}

/**
 * Seeds the standard Saudi fleet chart of accounts if the table is empty.
 */
export async function seedStandardAccountsIfEmpty(
  db: DbClient,
  branchId?: number | null
): Promise<{ seeded: number; message: string }> {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .limit(1);

  const count = Number(existing[0]?.count || 0);
  if (count > 0) {
    return { seeded: 0, message: "شجرة الحسابات تحتوي على حسابات بالفعل" };
  }

  // Insert in parent-to-child order (level 1 first, then level 2, then level 3)
  const sorted = [...STANDARD_CHART_OF_ACCOUNTS].sort(
    (a, b) => a.level - b.level
  );
  const codeToIdMap = new Map<string, number>();
  let insertedCount = 0;

  for (const item of sorted) {
    const parentId = item.parentCode
      ? codeToIdMap.get(item.parentCode) ?? null
      : null;
    const normalBalance: NormalBalance = NORMAL_BALANCE_FOR_TYPE[item.type];

    const [res] = await db.insert(accounts).values({
      code: item.code,
      name: item.name,
      type: item.type,
      normalBalance,
      parentId,
      level: item.level,
      isActive: 1,
      branchId: branchId ?? null,
      description: item.description ?? null,
    });

    const newId = (res as any).insertId || (res as any)[0]?.insertId;
    if (newId) {
      codeToIdMap.set(item.code, Number(newId));
      insertedCount++;
    }
  }

  return {
    seeded: insertedCount,
    message: `تم تأسيس شجرة الحسابات القياسية بنجاح (${insertedCount} حساب)`,
  };
}

/**
 * Creates a validated, balanced double-entry journal entry with its lines.
 */
export async function createJournalEntryWithLines(
  db: DbClient,
  input: {
    entryDate: string;
    description: string;
    reference?: string;
    sourceType?: string;
    sourceId?: number;
    branchId?: number;
    fiscalPeriodId?: number | null;
    createdBy?: number | null;
    status?: "draft" | "posted";
    lines: JournalLineInput[];
  }
): Promise<{ entry: JournalEntry; lines: JournalLine[] }> {
  const validation = validateJournalLines(input.lines);
  if (!validation.valid) {
    throw new AccountingDomainError(validation.error || "القيد غير متوازن");
  }

  const dateMatch = input.entryDate.match(/^(\d{4})/);
  const year = dateMatch ? parseInt(dateMatch[1], 10) : new Date().getFullYear();

  // Check fiscal period if specified
  if (input.fiscalPeriodId) {
    const period = await db
      .select()
      .from(fiscalPeriods)
      .where(eq(fiscalPeriods.id, input.fiscalPeriodId))
      .limit(1);

    if (!period || period.length === 0) {
      throw new AccountingDomainError("الفترة المالية المحددة غير موجودة");
    }
    if (period[0].status === "closed") {
      throw new AccountingDomainError("لا يمكن الترحيل في فترة مالية مقفلة");
    }
  }

  const accountIds = Array.from(new Set(input.lines.map((l) => l.accountId)));
  const existingAccounts = await db
    .select()
    .from(accounts)
    .where(inArray(accounts.id, accountIds));

  if (existingAccounts.length !== accountIds.length) {
    throw new AccountingDomainError("أحد الحسابات المحددة غير موجود في شجرة الحسابات");
  }

  const inactiveAccount = existingAccounts.find((a) => !a.isActive || a.archivedAt);
  if (inactiveAccount) {
    throw new AccountingDomainError(
      `الحساب "${inactiveAccount.name}" غير مفعّل أو مؤرشف ولا يمكن القيد عليه`
    );
  }

  const entryNumber = await generateNextEntryNumber(db, year);
  const status = input.status || "posted";
  const branchId = input.branchId || 1;

  // Insert entry header
  const [entryRes] = await db.insert(journalEntries).values({
    entryNumber,
    entryDate: input.entryDate,
    description: input.description,
    reference: input.reference || "—",
    sourceType: input.sourceType || "manual",
    sourceId: input.sourceId || null,
    status,
    isReversed: 0,
    branchId,
    fiscalPeriodId: input.fiscalPeriodId ?? null,
    totalDebit: validation.totalDebit,
    totalCredit: validation.totalCredit,
    createdBy: input.createdBy ?? null,
    postedAt: new Date(),
  });

  const entryId = Number((entryRes as any).insertId || (entryRes as any)[0]?.insertId);

  // Insert entry lines
  const linesToInsert: InsertJournalLine[] = input.lines.map((line, idx) => ({
    entryId,
    accountId: line.accountId,
    debit: roundMoney(line.debit || 0),
    credit: roundMoney(line.credit || 0),
    description: line.description || input.description,
    branchId: line.branchId || branchId,
    vehicleId: line.vehicleId ?? null,
    projectId: line.projectId ?? null,
    contractId: line.contractId ?? null,
    driverId: line.driverId ?? null,
    clientId: line.clientId ?? null,
    lineOrder: idx + 1,
  }));

  for (const line of linesToInsert) {
    await db.insert(journalLines).values(line);
  }

  const createdEntry = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);

  const createdLines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.entryId, entryId))
    .orderBy(journalLines.lineOrder);

  return { entry: createdEntry[0], lines: createdLines };
}

/**
 * Reverses a posted journal entry by generating a counter-balancing entry.
 * Debit lines become Credit lines, Credit lines become Debit lines.
 */
export async function reverseJournalEntry(
  db: DbClient,
  entryId: number,
  userId?: number | null,
  reason?: string
): Promise<{ reversalEntry: JournalEntry; originalEntry: JournalEntry }> {
  const [original] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .limit(1);

  if (!original) {
    throw new AccountingDomainError("القيد المطلوب عكسه غير موجود");
  }
  if (original.isReversed) {
    throw new AccountingDomainError("هذا القيد تم عكسه مسبقاً ولا يمكن عكسه مجدداً");
  }
  if (original.status !== "posted") {
    throw new AccountingDomainError("لا يمكن عكس قيد غير مُرحّل");
  }

  const lines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.entryId, entryId));

  const invertedLines: JournalLineInput[] = lines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit, // swap
    credit: l.debit, // swap
    description: `عكس قيد: ${l.description || original.description}`,
    branchId: l.branchId,
    vehicleId: l.vehicleId,
    projectId: l.projectId,
    contractId: l.contractId,
    driverId: l.driverId,
    clientId: l.clientId,
  }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const reversalDesc = `قيد عكسي للقيد رقم ${original.entryNumber}${
    reason ? ` — ${reason}` : ""
  }`;

  const { entry: reversalEntry } = await createJournalEntryWithLines(db, {
    entryDate: todayStr,
    description: reversalDesc,
    reference: `REV-${original.entryNumber}`,
    sourceType: "reversal",
    sourceId: original.id,
    branchId: original.branchId,
    fiscalPeriodId: original.fiscalPeriodId,
    createdBy: userId ?? null,
    lines: invertedLines,
  });

  // Mark original entry as reversed
  await db
    .update(journalEntries)
    .set({
      isReversed: 1,
      reversedEntryId: reversalEntry.id,
      status: "reversed",
    })
    .where(eq(journalEntries.id, original.id));

  const [updatedOriginal] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, original.id))
    .limit(1);

  return { reversalEntry, originalEntry: updatedOriginal };
}

/**
 * Computes the General Ledger (كشف حساب دفتر الأستاذ) for an account.
 */
export async function getAccountLedgerReport(
  db: DbClient,
  accountId: number,
  options?: {
    startDate?: string;
    endDate?: string;
    branchId?: number;
  }
) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new AccountingDomainError("الحساب المطلوب غير موجود");
  }

  const normalBalance = account.normalBalance as NormalBalance;

  // Opening balance calculation before startDate
  let openingBalance = 0;
  if (options?.startDate) {
    const priorConditions = [
      eq(journalLines.accountId, accountId),
      eq(journalEntries.status, "posted"),
      sql`${journalEntries.entryDate} < ${options.startDate}`,
    ];
    if (options?.branchId) {
      priorConditions.push(eq(journalLines.branchId, options.branchId));
    }

    const priorLines = await db
      .select({
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(...priorConditions));

    for (const line of priorLines) {
      openingBalance = calculateRunningBalance(
        openingBalance,
        line.debit,
        line.credit,
        normalBalance
      );
    }
  }

  // Lines in selected period
  const periodConditions = [
    eq(journalLines.accountId, accountId),
    eq(journalEntries.status, "posted"),
  ];
  if (options?.startDate) {
    periodConditions.push(sql`${journalEntries.entryDate} >= ${options.startDate}`);
  }
  if (options?.endDate) {
    periodConditions.push(sql`${journalEntries.entryDate} <= ${options.endDate}`);
  }
  if (options?.branchId) {
    periodConditions.push(eq(journalLines.branchId, options.branchId));
  }

  const rawLines = await db
    .select({
      id: journalLines.id,
      entryId: journalLines.entryId,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      reference: journalEntries.reference,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      vehicleId: journalLines.vehicleId,
      projectId: journalLines.projectId,
      contractId: journalLines.contractId,
      driverId: journalLines.driverId,
      clientId: journalLines.clientId,
      branchId: journalLines.branchId,
      createdAt: journalLines.createdAt,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(...periodConditions))
    .orderBy(journalEntries.entryDate, journalLines.id);

  let runningBalance = openingBalance;
  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;

  const rows = rawLines.map((line) => {
    totalPeriodDebit = sumMoney([totalPeriodDebit, line.debit]);
    totalPeriodCredit = sumMoney([totalPeriodCredit, line.credit]);
    runningBalance = calculateRunningBalance(
      runningBalance,
      line.debit,
      line.credit,
      normalBalance
    );
    return {
      ...line,
      balance: runningBalance,
    };
  });

  return {
    account,
    openingBalance,
    lines: rows,
    closingBalance: runningBalance,
    totalPeriodDebit: roundMoney(totalPeriodDebit),
    totalPeriodCredit: roundMoney(totalPeriodCredit),
  };
}

/**
 * Computes Trial Balance (ميزان المراجعة) across all active accounts.
 */
export async function getTrialBalanceReport(
  db: DbClient,
  options?: {
    asOfDate?: string;
    branchId?: number;
  }
) {
  const activeAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isActive, 1), isNull(accounts.archivedAt)))
    .orderBy(accounts.code);

  const conditions = [eq(journalEntries.status, "posted")];
  if (options?.asOfDate) {
    conditions.push(sql`${journalEntries.entryDate} <= ${options.asOfDate}`);
  }
  if (options?.branchId) {
    conditions.push(eq(journalLines.branchId, options.branchId));
  }

  const aggregated = await db
    .select({
      accountId: journalLines.accountId,
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(...conditions))
    .groupBy(journalLines.accountId);

  const aggMap = new Map<number, { debit: number; credit: number }>();
  for (const row of aggregated) {
    aggMap.set(row.accountId, {
      debit: roundMoney(Number(row.totalDebit)),
      credit: roundMoney(Number(row.totalCredit)),
    });
  }

  let totalDebits = 0;
  let totalCredits = 0;

  const rows = activeAccounts.map((account) => {
    const agg = aggMap.get(account.id) || { debit: 0, credit: 0 };
    const net = agg.debit - agg.credit;

    let balanceDebit = 0;
    let balanceCredit = 0;

    if (account.normalBalance === "debit") {
      if (net >= 0) balanceDebit = roundMoney(net);
      else balanceCredit = roundMoney(Math.abs(net));
    } else {
      if (net <= 0) balanceCredit = roundMoney(Math.abs(net));
      else balanceDebit = roundMoney(net);
    }

    totalDebits = sumMoney([totalDebits, balanceDebit]);
    totalCredits = sumMoney([totalCredits, balanceCredit]);

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      totalDebit: agg.debit,
      totalCredit: agg.credit,
      balanceDebit,
      balanceCredit,
    };
  });

  totalDebits = roundMoney(totalDebits);
  totalCredits = roundMoney(totalCredits);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return {
    asOfDate: options?.asOfDate || new Date().toISOString().slice(0, 10),
    accounts: rows,
    totalDebits,
    totalCredits,
    isBalanced,
  };
}

/**
 * Computes Income Statement (قائمة الدخل) for a specific period.
 * Net Income = Revenues - Expenses
 */
export async function getIncomeStatementReport(
  db: DbClient,
  options: {
    startDate: string;
    endDate: string;
    branchId?: number;
  }
) {
  const trialBalance = await getTrialBalanceReport(db, {
    asOfDate: options.endDate,
    branchId: options.branchId,
  });

  const revenues = trialBalance.accounts
    .filter((a) => a.type === "revenue")
    .map((a) => ({
      ...a,
      amount: roundMoney(a.balanceCredit - a.balanceDebit),
    }));

  const expenses = trialBalance.accounts
    .filter((a) => a.type === "expense")
    .map((a) => ({
      ...a,
      amount: roundMoney(a.balanceDebit - a.balanceCredit),
    }));

  const totalRevenue = sumMoney(revenues.map((r) => r.amount));
  const totalExpense = sumMoney(expenses.map((e) => e.amount));
  const netIncome = roundMoney(totalRevenue - totalExpense);

  return {
    startDate: options.startDate,
    endDate: options.endDate,
    revenues,
    expenses,
    totalRevenue,
    totalExpense,
    netIncome,
    isProfitable: netIncome >= 0,
  };
}

/**
 * Computes Balance Sheet (الميزانية العمومية) as of a date.
 * Assets = Liabilities + Equity
 */
export async function getBalanceSheetReport(
  db: DbClient,
  options?: {
    asOfDate?: string;
    branchId?: number;
  }
) {
  const asOfDate = options?.asOfDate || new Date().toISOString().slice(0, 10);
  const trialBalance = await getTrialBalanceReport(db, {
    asOfDate,
    branchId: options?.branchId,
  });

  const assets = trialBalance.accounts
    .filter((a) => a.type === "asset")
    .map((a) => ({
      ...a,
      amount: roundMoney(a.balanceDebit - a.balanceCredit),
    }));

  const liabilities = trialBalance.accounts
    .filter((a) => a.type === "liability")
    .map((a) => ({
      ...a,
      amount: roundMoney(a.balanceCredit - a.balanceDebit),
    }));

  const equity = trialBalance.accounts
    .filter((a) => a.type === "equity")
    .map((a) => ({
      ...a,
      amount: roundMoney(a.balanceCredit - a.balanceDebit),
    }));

  // Net Income from Revenues and Expenses as of date
  const totalRevenue = sumMoney(
    trialBalance.accounts
      .filter((a) => a.type === "revenue")
      .map((a) => roundMoney(a.balanceCredit - a.balanceDebit))
  );
  const totalExpense = sumMoney(
    trialBalance.accounts
      .filter((a) => a.type === "expense")
      .map((a) => roundMoney(a.balanceDebit - a.balanceCredit))
  );
  const currentPeriodNetIncome = roundMoney(totalRevenue - totalExpense);

  const totalAssets = sumMoney(assets.map((a) => a.amount));
  const totalLiabilities = sumMoney(liabilities.map((l) => l.amount));
  const totalBaseEquity = sumMoney(equity.map((e) => e.amount));
  const totalEquity = roundMoney(totalBaseEquity + currentPeriodNetIncome);
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity);

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    asOfDate,
    assets,
    liabilities,
    equity,
    currentPeriodNetIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
  };
}
