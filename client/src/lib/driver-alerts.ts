import { resolveRenewalStatus } from "@shared/date-utils";

export type DriverLicenseAlert = {
  id: number;
  title: string;
  message: string;
  severity: "حرج" | "تنبيه";
  target: "drivers";
};

export function summarizeDriverLicenseAlerts(
  drivers: Array<{ id: number; renewal: string }>,
  now = new Date(),
): DriverLicenseAlert | null {
  const expired = drivers.filter(driver => resolveRenewalStatus(driver.renewal, now) === "منتهية").length;
  const upcoming = drivers.filter(driver => resolveRenewalStatus(driver.renewal, now) === "قريبة").length;
  if (!expired && !upcoming) return null;
  return {
    id: 3500000,
    title: expired ? `${expired} رخص قيادة منتهية` : "رخص قيادة قاربت على الانتهاء",
    message: `${expired} منتهية · ${upcoming} تنتهي خلال 60 يومًا · افتح قائمة السائقين للمتابعة`,
    severity: expired ? "حرج" : "تنبيه",
    target: "drivers",
  };
}
