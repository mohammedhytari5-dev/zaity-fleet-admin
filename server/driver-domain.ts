type AssignedDriver = { name: string; vehicleId: number | null };

export function linkedVehicleDriverNameUpdate(driver: AssignedDriver, nextName: string | undefined) {
  if (!nextName || nextName === driver.name || driver.vehicleId === null) return null;
  return { vehicleId: driver.vehicleId, name: nextName };
}
