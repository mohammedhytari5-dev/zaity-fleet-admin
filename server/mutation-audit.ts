export type MutationAuditEvent = {
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  details: string;
};

const RECORD_ID_KEYS = ["id", "vehicleId", "projectId", "contractId", "claimId", "paymentId", "payableId", "maintenanceRequestId", "documentId", "employeeId", "driverId", "clientId"] as const;
const fieldLabels: Record<string, string> = {
  name: "الاسم", status: "الحالة", role: "الدور", permissions: "الصلاحيات", isActive: "حالة الحساب",
  plate: "رقم اللوحة", driverId: "السائق", employeeId: "الموظف", projectId: "المشروع", clientId: "العميل", contractId: "العقد",
  amount: "المبلغ", total: "القيمة", paid: "المدفوع", reference: "المرجع", dueDate: "الاستحقاق", issueDate: "تاريخ الإصدار", expiry: "تاريخ الانتهاء",
  workflowStage: "مرحلة العمل", approvalStatus: "الاعتماد", vehicleId: "المركبة", department: "القسم", jobTitle: "المسمى الوظيفي",
  assigneeUserId: "المسؤول", dueAt: "موعد الإنجاز", entityType: "نوع الارتباط", entityId: "السجل المرتبط",
};

function mutationDetails(procedure: string, input: Record<string, unknown>) {
  if (["archive", "delete"].includes(procedure)) return "تمت أرشفة السجل أو حذفه";
  if (procedure === "create") return "تم إنشاء سجل جديد";
  if (["updateStatus", "status", "updateRole"].includes(procedure)) return "تم تغيير الحالة أو الدور";
  const payload = input.data && typeof input.data === "object" && !Array.isArray(input.data)
    ? input.data as Record<string, unknown>
    : input;
  const changedFields = Object.keys(payload).filter(key => !RECORD_ID_KEYS.includes(key as typeof RECORD_ID_KEYS[number]) && !["password", "passwordHash", "receiptUrl", "fileUrl", "quoteUrl"].includes(key));
  if (changedFields.length) return `الحقول المعدلة: ${changedFields.map(key => fieldLabels[key] || key).join("، ")}`.slice(0, 4000);
  return "تم تنفيذ الإجراء بنجاح";
}

export function createMutationAuditEvent(input: {
  path: string;
  userId?: number | null;
  procedureInput?: unknown;
}): MutationAuditEvent | null {
  if (!input.userId || input.path === "audit.record" || input.path === "notifications.markRead") return null;
  const pathParts = input.path.split(".");
  const entityType = pathParts[0] || "unknown";
  // These ledgers are audited inside their financial database transactions.
  if (entityType === "payables" || entityType === "payments" || entityType === "maintenance") return null;
  const procedure = pathParts[1] || "mutation";
  const data = input.procedureInput && typeof input.procedureInput === "object"
    ? input.procedureInput as Record<string, unknown>
    : {};
  const candidateId = RECORD_ID_KEYS.map(key => data[key]).find(value => typeof value === "number" && Number.isInteger(value) && value > 0);
  return {
    userId: input.userId,
    action: `${entityType}.${procedure}`.slice(0, 80),
    entityType: entityType.slice(0, 80),
    ...(typeof candidateId === "number" ? { entityId: candidateId } : {}),
    details: mutationDetails(procedure, data),
  };
}
