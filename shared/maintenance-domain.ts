export const maintenanceStages = ["بلاغ", "فحص", "تشخيص", "تقدير تكلفة", "اعتماد", "تنفيذ", "فحص بعد الإصلاح", "مغلق", "مرفوض"] as const;
export type MaintenanceStage = typeof maintenanceStages[number];
export type MaintenanceApprovalStatus = "غير مطلوب" | "بانتظار الاعتماد" | "معتمد" | "مرفوض";

const transitions: Record<MaintenanceStage, MaintenanceStage[]> = {
  // Legacy requests may still be in an intake/assessment stage. Let the
  // purchaser send them straight to finance once the quote is complete.
  "بلاغ": ["اعتماد"], "فحص": ["اعتماد"], "تشخيص": ["اعتماد"], "تقدير تكلفة": ["اعتماد"], "اعتماد": [],
  // The finance approval starts execution. Inspection is optional so the
  // everyday purchase/invoice flow can close directly, while operations can
  // still record a post-repair inspection when the vehicle requires it.
  "تنفيذ": ["فحص بعد الإصلاح", "مغلق"], "فحص بعد الإصلاح": ["مغلق"], "مغلق": [], "مرفوض": [],
};

export function nextMaintenanceStages(stage: MaintenanceStage): MaintenanceStage[] { return transitions[stage]; }

export function hasMaintenanceQuote(input: { quoteName?: string | null; quoteUrl?: string | null; estimatedCost?: number | null; quotedPartsCost?: number | null }): boolean {
  return Boolean(input.quoteName?.trim() && input.quoteUrl?.trim() && (Number(input.estimatedCost || 0) + Number(input.quotedPartsCost || 0) > 0));
}

export function canEditMaintenanceQuote(input: { workflowStage: MaintenanceStage; approvalStatus: MaintenanceApprovalStatus }): boolean {
  return ["بلاغ", "فحص", "تشخيص", "تقدير تكلفة", "اعتماد"].includes(input.workflowStage) &&
    ["غير مطلوب", "بانتظار الاعتماد"].includes(input.approvalStatus);
}

export function canCloseMaintenance(input: {
  approvalStatus: MaintenanceApprovalStatus;
  actualCost: number;
  linkedInvoices: Array<{ status: string }>;
  isInspectionComplete?: boolean;
}): boolean {
  if (input.approvalStatus === "معتمد") {
    if (input.actualCost <= 0 || input.linkedInvoices.length === 0) return false;
    if (input.linkedInvoices.some(invoice => invoice.status !== "معتمدة" && invoice.status !== "مدفوعة جزئيًا" && invoice.status !== "مدفوعة")) return false;
  }
  return input.isInspectionComplete !== false;
}

export function canAdvanceMaintenance(input: { from: MaintenanceStage; to: MaintenanceStage; approvalStatus: MaintenanceApprovalStatus }): boolean {
  if (!transitions[input.from].includes(input.to)) return false;
  if (input.to === "اعتماد") return canEditMaintenanceQuote({ workflowStage: input.from, approvalStatus: input.approvalStatus });
  if (input.to === "مغلق") return input.approvalStatus === "معتمد" || input.approvalStatus === "غير مطلوب";
  return true;
}

export function statusForMaintenanceStage(stage: MaintenanceStage): "جديد" | "جاري العمل" | "بانتظار الفحص" | "مكتمل" | "متوقف" {
  if (stage === "تنفيذ") return "جاري العمل";
  if (stage === "فحص بعد الإصلاح") return "بانتظار الفحص";
  if (stage === "مغلق") return "مكتمل";
  if (stage === "مرفوض") return "متوقف";
  return "جديد";
}
