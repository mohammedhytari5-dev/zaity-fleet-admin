export function employeeAccountLinkError(input: {
  userExists: boolean;
  userActive: boolean;
  employeeId: number;
  linkedEmployeeId: number | null;
}): string | null {
  if (!input.userExists || !input.userActive) return "اختر حساب مستخدم نشطًا لربطه بملف الموظف";
  if (input.linkedEmployeeId !== null && input.linkedEmployeeId !== input.employeeId) return "حساب المستخدم مرتبط بملف موظف آخر؛ افصل الربط السابق أولًا";
  return null;
}
