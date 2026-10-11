const validationLabels: Record<string, string> = {
  sku: "رمز الصنف",
  name: "الاسم",
  category: "الفئة",
  unit: "وحدة القياس",
  ref: "الرقم المرجعي",
  vehicle: "المركبة",
  vehicleId: "المركبة",
  type: "النوع",
  start: "تاريخ البداية",
  due: "تاريخ الاستحقاق",
  client: "العميل",
  amount: "المبلغ",
  quantity: "الكمية",
  description: "الوصف",
  title: "العنوان",
  location: "الموقع",
  employeeNo: "رقم الموظف",
  phone: "رقم الهاتف",
  occurredAt: "تاريخ الحادث",
  itemId: "الصنف",
  purpose: "سبب الطلب",
};

type ValidationIssue = {
  path?: Array<string | number>;
  code?: string;
  minimum?: number;
};

export function userFacingMutationError(error: { message: string }): string {
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (Array.isArray(parsed)) {
      return (parsed as ValidationIssue[])
        .slice(0, 4)
        .map(issue => {
          const key =
            issue.path
              ?.filter(part => typeof part !== "number")
              .map(String)
              .at(-1) ?? "البيانات";
          const label = validationLabels[key] ?? key;
          return issue.code === "too_small"
            ? `${label}: أدخل ${issue.minimum ?? 1} أحرف على الأقل`
            : `${label}: تحقق من القيمة المدخلة`;
        })
        .join(" · ");
    }
  } catch {
    // Most API errors are already written as user-facing messages.
  }

  return error.message;
}
