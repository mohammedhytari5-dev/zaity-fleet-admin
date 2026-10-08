import { describe, expect, it } from "vitest";
import { summarizeDriverLicenseAlerts } from "../client/src/lib/driver-alerts";

describe("driver license dashboard alerts", () => {
  const today = new Date(2026, 9, 7, 12);

  it("aggregates expired and upcoming renewals into one urgent alert", () => {
    expect(summarizeDriverLicenseAlerts([
      { id: 1, renewal: "2026-10-06" },
      { id: 2, renewal: "2026-11-20" },
      { id: 3, renewal: "2027-02-01" },
    ], today)).toMatchObject({
      title: "1 رخص قيادة منتهية",
      message: "1 منتهية · 1 تنتهي خلال 60 يومًا · افتح قائمة السائقين للمتابعة",
      severity: "حرج",
      target: "drivers",
    });
  });

  it("warns about only upcoming renewals and omits healthy or unknown dates", () => {
    expect(summarizeDriverLicenseAlerts([
      { id: 1, renewal: "2026-12-06" },
      { id: 2, renewal: "2027-02-01" },
      { id: 3, renewal: "—" },
    ], today)).toMatchObject({ severity: "تنبيه", target: "drivers" });
    expect(summarizeDriverLicenseAlerts([{ id: 4, renewal: "2027-02-01" }], today)).toBeNull();
  });
});
