type ContractableVehicleStatus = "متاحة" | "مؤجرة" | "مشغولة" | "في الصيانة" | "قيد التجهيز" | "متوقفة";

export function canAssignVehicleToContract(input: {
  status: ContractableVehicleStatus;
  currentContractId: number | null | undefined;
  targetContractId?: number;
}): boolean {
  if (input.targetContractId !== undefined && input.currentContractId === input.targetContractId) return true;
  const hasCurrentContract = typeof input.currentContractId === "number" && input.currentContractId > 0;
  return !hasCurrentContract && input.status === "متاحة";
}

export function vehicleStatusAfterContractAssignment(
  coverage: "مركبة وسائق" | "سائق فقط" | "مركبة فقط",
  currentStatus: ContractableVehicleStatus,
): ContractableVehicleStatus {
  if (currentStatus !== "متاحة" && currentStatus !== "مؤجرة") return currentStatus;
  return coverage === "سائق فقط" ? "متاحة" : "مؤجرة";
}

export function vehicleStatusAfterContractRemoval(status: ContractableVehicleStatus): ContractableVehicleStatus {
  return status === "مؤجرة" ? "متاحة" : status;
}
