import { roundMoney, sumMoney, isValidMoneyAmount } from "./money";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type NormalBalance = "debit" | "credit";
export type JournalEntryStatus = "draft" | "posted" | "reversed";
export type FiscalPeriodStatus = "open" | "closed";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

export const NORMAL_BALANCE_FOR_TYPE: Record<AccountType, NormalBalance> = {
  asset: "debit",
  liability: "credit",
  equity: "credit",
  revenue: "credit",
  expense: "debit",
};

export interface JournalLineInput {
  accountId: number;
  debit: number;
  credit: number;
  description?: string | null;
  branchId?: number;
  vehicleId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  driverId?: number | null;
  clientId?: number | null;
}

/**
 * Validates that lines in a journal entry form a valid, balanced double-entry transaction.
 * Rules:
 * 1. At least two lines.
 * 2. Each line must specify a valid accountId.
 * 3. Each line must have non-negative debit and credit.
 * 4. A line cannot have both debit > 0 and credit > 0.
 * 5. A line cannot have both debit === 0 and credit === 0.
 * 6. Total Debits MUST equal Total Credits down to the halala.
 */
export function validateJournalLines(lines: JournalLineInput[]): {
  valid: boolean;
  error?: string;
  totalDebit: number;
  totalCredit: number;
} {
  if (!Array.isArray(lines) || lines.length < 2) {
    return {
      valid: false,
      error: "يجب أن يحتوي القيد على سطرين على الأقل (طرف مدين وطرف دائن)",
      totalDebit: 0,
      totalCredit: 0,
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.accountId || !Number.isInteger(line.accountId) || line.accountId <= 0) {
      return {
        valid: false,
        error: `السطر رقم ${i + 1}: يجب تحديد حساب صحيح`,
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    const debit = roundMoney(line.debit || 0);
    const credit = roundMoney(line.credit || 0);

    if (debit < 0 || credit < 0) {
      return {
        valid: false,
        error: `السطر رقم ${i + 1}: المبالغ يجب ألا تكون سالبة`,
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    if (debit > 0 && credit > 0) {
      return {
        valid: false,
        error: `السطر رقم ${i + 1}: لا يمكن أن يكون السطر مديناً ودائناً في نفس الوقت`,
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    if (debit === 0 && credit === 0) {
      return {
        valid: false,
        error: `السطر رقم ${i + 1}: يجب إدخال قيمة للمدين أو الدائن أكبر من صفر`,
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    totalDebit = sumMoney([totalDebit, debit]);
    totalCredit = sumMoney([totalCredit, credit]);
  }

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);

  if (Math.abs(totalDebit - totalCredit) >= 0.005) {
    return {
      valid: false,
      error: `القيد غير متوازن: مجموع المدين (${totalDebit.toFixed(2)}) لا يساوي مجموع الدائن (${totalCredit.toFixed(2)}) بفارق (${Math.abs(totalDebit - totalCredit).toFixed(2)})`,
      totalDebit,
      totalCredit,
    };
  }

  return {
    valid: true,
    totalDebit,
    totalCredit,
  };
}

/**
 * Computes running balance for account ledger lines according to the account's normal balance.
 * For debit-normal accounts (Assets, Expenses):
 *   newBalance = prevBalance + debit - credit
 * For credit-normal accounts (Liabilities, Equity, Revenues):
 *   newBalance = prevBalance + credit - debit
 */
export function calculateRunningBalance(
  previousBalance: number,
  debit: number,
  credit: number,
  normalBalance: NormalBalance
): number {
  const d = roundMoney(debit || 0);
  const c = roundMoney(credit || 0);
  const net = normalBalance === "debit" ? d - c : c - d;
  return roundMoney(previousBalance + net);
}

/**
 * Standard Fleet & Operations Chart of Accounts template for Saudi businesses.
 */
export interface StandardAccountSeed {
  code: string;
  name: string;
  type: AccountType;
  level: number;
  parentCode?: string;
  description?: string;
}

export const STANDARD_CHART_OF_ACCOUNTS: StandardAccountSeed[] = [
  // 1: الأصول
  { code: "1", name: "الأصول", type: "asset", level: 1, description: "كافة أصول وممتلكات المنشأة" },
  { code: "11", name: "الأصول المتداولة", type: "asset", level: 2, parentCode: "1", description: "النقدية والعملاء والمخزون" },
  { code: "1101", name: "الصندوق والعهد النقدية", type: "asset", level: 3, parentCode: "11", description: "الخزينة والعهد النقدية التشغيلية" },
  { code: "1102", name: "الحسابات البنكية الجارية", type: "asset", level: 3, parentCode: "11", description: "أرصدة البنوك المحلية" },
  { code: "1103", name: "العملاء والمدينون التجاريون", type: "asset", level: 3, parentCode: "11", description: "مستحقات عقود التأجير والتشغيل" },
  { code: "1104", name: "مخزون قطع الغيار والزيوت", type: "asset", level: 3, parentCode: "11", description: "مستودع الصيانة وقطع الغيار" },
  { code: "1105", name: "سلف ومستحقات الموظفين", type: "asset", level: 3, parentCode: "11", description: "سلف تشغيلية وسلف رواتب" },
  { code: "1106", name: "ضريبة القيمة المضافة المدخلة (مستردة)", type: "asset", level: 3, parentCode: "11", description: "الضريبة المدفوعة على المشتريات والمصروفات" },

  { code: "12", name: "الأصول غير المتداولة (الثابتة)", type: "asset", level: 2, parentCode: "1", description: "الأسطول والمعدات الثابتة" },
  { code: "1201", name: "أسطول المركبات (تكلفة تاريخية)", type: "asset", level: 3, parentCode: "12", description: "قيمة اقتناء مركبات الأسطول" },
  { code: "1202", name: "مجمع إهلاك أسطول المركبات", type: "asset", level: 3, parentCode: "12", description: "إهلاك الأسطول المتراكم (طبيعة دائنة مقابلة)" },
  { code: "1203", name: "معدات وأجهزة الورشة", type: "asset", level: 3, parentCode: "12", description: "رافعات وعدد ورشة الصيانة" },
  { code: "1204", name: "أثاث وأجهزة مكتبية", type: "asset", level: 3, parentCode: "12", description: "أجهزة الحاسب والمكاتب" },

  // 2: الالتزامات
  { code: "2", name: "الالتزامات", type: "liability", level: 1, description: "التزامات المنشأة تجاه الغير" },
  { code: "21", name: "الالتزامات المتداولة", type: "liability", level: 2, parentCode: "2", description: "الموردون والمستحقات قصيرة الأجل" },
  { code: "2101", name: "الموردون والدائنون التجاريون", type: "liability", level: 3, parentCode: "21", description: "فواتير موردي الورشة والوقود وقطع الغيار" },
  { code: "2102", name: "رواتب وأجور مستحقة", type: "liability", level: 3, parentCode: "21", description: "رواتب مستحقة لم تصرف بعد" },
  { code: "2103", name: "التأمينات الاجتماعية المستحقة (GOSI)", type: "liability", level: 3, parentCode: "21", description: "مستحقات التأمينات الشهرية" },
  { code: "2104", name: "ضريبة القيمة المضافة المحصلة (المخرجات)", type: "liability", level: 3, parentCode: "21", description: "الضريبة المحصلة من العملاء على العقود" },
  { code: "2105", name: "دفعات مقدمة من العملاء", type: "liability", level: 3, parentCode: "21", description: "إيرادات غير مكتسبة / دفعات مقدمة" },
  { code: "2106", name: "مصروفات مستحقة الدفع", type: "liability", level: 3, parentCode: "21", description: "إيجارات وفواتير خدمات مستحقة" },

  { code: "22", name: "الالتزامات غير المتداولة", type: "liability", level: 2, parentCode: "2", description: "الالتزامات طويلة الأجل" },
  { code: "2201", name: "مخصص مكافأة نهاية الخدمة", type: "liability", level: 3, parentCode: "22", description: "التزام منافع الموظفين النظامية" },
  { code: "2202", name: "تمويلات وقروض المركبات طويلة الأجل", type: "liability", level: 3, parentCode: "22", description: "أقساط تمويل تأجيري للأسطول" },

  // 3: حقوق الملكية
  { code: "3", name: "حقوق الملكية", type: "equity", level: 1, description: "حقوق الشركاء ورأس المال" },
  { code: "3101", name: "رأس المال المدفوع", type: "equity", level: 2, parentCode: "3", description: "رأس مال الشركة الرسمي" },
  { code: "3102", name: "الأرباح (الخسائر) المبقاة", type: "equity", level: 2, parentCode: "3", description: "أرباح السنوات السابقة المتراكمة" },
  { code: "3103", name: "جاري الشركاء / المالك", type: "equity", level: 2, parentCode: "3", description: "المسحوبات والإيداعات الشخصية للشركاء" },

  // 4: الإيرادات
  { code: "4", name: "الإيرادات", type: "revenue", level: 1, description: "عوائد وأنشطة الشركة التشغيلية" },
  { code: "4101", name: "إيرادات عقود التأجير والتشغيل", type: "revenue", level: 2, parentCode: "4", description: "إيرادات عقود تشغيل الأسطول للشركات والأفراد" },
  { code: "4102", name: "إيرادات مطالبات وتعويضات الحوادث", type: "revenue", level: 2, parentCode: "4", description: "تعويضات نجم وشركات التأمين" },
  { code: "4103", name: "إيرادات خدمات ونقل إضافية", type: "revenue", level: 2, parentCode: "4", description: "رسوم نقل وسائقين إضافية" },
  { code: "4104", name: "إيرادات أخرى متنوعة", type: "revenue", level: 2, parentCode: "4", description: "أرباح بيع أصول وإيرادات عرضية" },

  // 5: المصروفات
  { code: "5", name: "المصروفات", type: "expense", level: 1, description: "كافة تكاليف ومصروفات المنشأة" },
  { code: "51", name: "مصروفات تشغيل الأسطول المباشرة", type: "expense", level: 2, parentCode: "5", description: "تكلفة تشغيل وصيانة المركبات المباشرة" },
  { code: "5101", name: "صيانة وإصلاح المركبات", type: "expense", level: 3, parentCode: "51", description: "أجور الورش الخارجية والصيانة الدورية" },
  { code: "5102", name: "محروقات ووقود الأسطول", type: "expense", level: 3, parentCode: "51", description: "فواتير بطاقات محطات الوقود" },
  { code: "5103", name: "تأمين المركبات", type: "expense", level: 3, parentCode: "51", description: "أقساط وثائق التأمين الشامل وضد الغير" },
  { code: "5104", name: "قطع غيار ومستهلكات الورشة", type: "expense", level: 3, parentCode: "51", description: "قطع الغيار والزيوت والإطارات المصروفة" },
  { code: "5105", name: "غسيل ونظافة المركبات", type: "expense", level: 3, parentCode: "51", description: "خدمات غسيل وتلميع الأسطول" },
  { code: "5106", name: "رسوم رخص وفحص دوري ولوحات", type: "expense", level: 3, parentCode: "51", description: "تجديد الاستمارات وتكاليف الفحص الفني" },
  { code: "5107", name: "إهلاك أسطول المركبات", type: "expense", level: 3, parentCode: "51", description: "قسط الإهلاك الدوري لمركبات الأسطول" },

  { code: "52", name: "مصروفات الرواتب والأجور", type: "expense", level: 2, parentCode: "5", description: "مستحقات ومزايا الموظفين والسائقين" },
  { code: "5201", name: "رواتب السائقين المباشرة", type: "expense", level: 3, parentCode: "52", description: "الرواتب والبدلات لسائقي الأسطول" },
  { code: "5202", name: "رواتب الفنيين والإداريين", type: "expense", level: 3, parentCode: "52", description: "رواتب مشرفي التشغيل والمحاسبة والإدارة" },
  { code: "5203", name: "بدلات سكن وانتقال وعمل إضافي", type: "expense", level: 3, parentCode: "52", description: "البدلات النقدية المعتمدة" },
  { code: "5204", name: "اشتراك التأمينات الاجتماعية (حصة الشركة)", type: "expense", level: 3, parentCode: "52", description: "مساهمة المنشأة في التأمينات" },
  { code: "5205", name: "مصروف مكافأة نهاية الخدمة", type: "expense", level: 3, parentCode: "52", description: "مخصص نهاية الخدمة الشهري أو السنوي" },

  { code: "53", name: "المصروفات العمومية والإدارية", type: "expense", level: 2, parentCode: "5", description: "تكاليف تشغيل المكاتب والإدارة" },
  { code: "5301", name: "إيجار مقرات ومواقف ومستودعات", type: "expense", level: 3, parentCode: "53", description: "إيجار المقر الرئيسي والفروع" },
  { code: "5302", name: "كهرباء ومياه واتصالات وإنترنت", type: "expense", level: 3, parentCode: "53", description: "فواتير الخدمات والمرافق" },
  { code: "5303", name: "رسوم حكومية واشتراكات برمجية", type: "expense", level: 3, parentCode: "53", description: "منصات قوى ومقيم ورخص البلدية والاشتراكات" },
  { code: "5304", name: "ضيافة وأدوات مكتبية ومطبوعات", type: "expense", level: 3, parentCode: "53", description: "مستلزمات المكاتب والمطبوعات" },
  { code: "5305", name: "عمولات ورسوم بنكية", type: "expense", level: 3, parentCode: "53", description: "رسوم نقاط البيع والتحويلات المصرفية" },
];
