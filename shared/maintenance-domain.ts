export const maintenanceStages = ["بلاغ", "فحص", "تشخيص", "تقدير تكلفة", "اعتماد", "تنفيذ", "فحص بعد الإصلاح", "مغلق", "مرفوض"] as const;
export type MaintenanceStage = typeof maintenanceStages[number];
export type MaintenanceApprovalStatus = "غير مطلوب" | "بانتظار الاعتماد" | "معتمد" | "مرفوض";

const transitions: Record<MaintenanceStage, MaintenanceStage[]> = {
  "بلاغ": ["فحص"], "فحص": ["تشخيص"], "تشخيص": ["تقدير تكلفة"], "تقدير تكلفة": ["اعتماد"], "اعتماد": [],
  "تنفيذ": ["فحص بعد الإصلاح"], "فحص بعد الإصلاح": ["تنفيذ", "مغلق"], "مغلق": [], "مرفوض": [],
};

export function nextMaintenanceStages(stage: MaintenanceStage): MaintenanceStage[] { return transitions[stage]; }

export function canAdvanceMaintenance(input: { from: MaintenanceStage; to: MaintenanceStage; approvalStatus: MaintenanceApprovalStatus }): boolean {
  if (!transitions[input.from].includes(input.to)) return false;
  if (input.from === "اعتماد") return false;
  if (input.to === "اعتماد") return input.from === "تقدير تكلفة";
  if (input.to === "تنفيذ" && input.from === "فحص بعد الإصلاح") return input.approvalStatus === "معتمد";
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
