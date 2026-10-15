/**
 * Attendance & Biometric Integration Domain Layer
 * Object-Oriented domain logic for attendance calculation, shift tracking,
 * and biometric device punch logs processing.
 */

export type AttendanceStatus = "حاضر" | "تأخير" | "غياب" | "إجازة" | "استئذان" | "عطلة";
export type AttendanceSource = "جهاز بصمة" | "يدوي" | "تطبيق" | "ملف";
export type DeviceStatus = "متصل" | "غير متصل" | "جاري المزامنة";

export interface PunchRecord {
  employeeCode: string;
  time: string; // HH:mm:ss or ISO
  type: "in" | "out" | "auto";
  deviceId?: string;
  deviceIp?: string;
}

export class AttendanceCalculator {
  private readonly defaultShiftStart: string;
  private readonly defaultShiftEnd: string;
  private readonly gracePeriodMinutes: number;

  constructor(
    shiftStart = "08:00:00",
    shiftEnd = "17:00:00",
    gracePeriodMinutes = 15
  ) {
    this.defaultShiftStart = AttendanceCalculator.normalizeTime(shiftStart, "08:00:00");
    this.defaultShiftEnd = AttendanceCalculator.normalizeTime(shiftEnd, "17:00:00");
    this.gracePeriodMinutes = Math.max(0, gracePeriodMinutes);
  }

  public static normalizeTime(timeStr?: string | null, fallback = "08:00:00"): string {
    if (!timeStr || timeStr === "—") return fallback;
    const parts = timeStr.trim().split(":");
    const h = (parts[0] || "00").padStart(2, "0");
    const m = (parts[1] || "00").padStart(2, "0");
    const s = (parts[2] || "00").padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  /**
   * Calculates delay in minutes past shift start + grace period.
   */
  public calculateDelay(checkInTime?: string | null): number {
    if (!checkInTime || checkInTime === "—") return 0;
    const parts = checkInTime.split(":");
    if (parts.length < 2) return 0;
    const checkInMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

    const shiftParts = this.defaultShiftStart.split(":");
    const shiftMinutes = parseInt(shiftParts[0], 10) * 60 + parseInt(shiftParts[1], 10);

    const diff = checkInMinutes - shiftMinutes;
    return diff > this.gracePeriodMinutes ? diff : 0;
  }

  /**
   * Calculates early departure in minutes if employee leaves before shift end.
   */
  public calculateEarlyDeparture(checkOutTime?: string | null): number {
    if (!checkOutTime || checkOutTime === "—") return 0;
    const parts = checkOutTime.split(":");
    if (parts.length < 2) return 0;
    const checkOutMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

    const shiftEndParts = this.defaultShiftEnd.split(":");
    let shiftEndMinutes = parseInt(shiftEndParts[0], 10) * 60 + parseInt(shiftEndParts[1], 10);

    const shiftStartParts = this.defaultShiftStart.split(":");
    const shiftStartMinutes = parseInt(shiftStartParts[0], 10) * 60 + parseInt(shiftStartParts[1], 10);

    // If overnight shift (shiftEnd < shiftStart)
    if (shiftEndMinutes < shiftStartMinutes) {
      shiftEndMinutes += 24 * 60;
      let checkOutTotal = checkOutMinutes;
      if (checkOutTotal < shiftStartMinutes) {
        checkOutTotal += 24 * 60;
      }
      const diff = shiftEndMinutes - checkOutTotal;
      return diff > 0 ? diff : 0;
    }

    const diff = shiftEndMinutes - checkOutMinutes;
    return diff > 0 ? diff : 0;
  }

  /**
   * Calculates worked hours between check-in and check-out.
   */
  public calculateWorkHours(checkInTime?: string | null, checkOutTime?: string | null): number {
    if (!checkInTime || !checkOutTime || checkInTime === "—" || checkOutTime === "—") return 0;
    const [inH, inM] = checkInTime.split(":").map(Number);
    const [outH, outM] = checkOutTime.split(":").map(Number);
    if (isNaN(inH) || isNaN(outH)) return 0;

    let inTotalMin = inH * 60 + (inM || 0);
    let outTotalMin = outH * 60 + (outM || 0);
    if (outTotalMin < inTotalMin) {
      outTotalMin += 24 * 60; // overnight shift
    }
    const totalHours = (outTotalMin - inTotalMin) / 60;
    return Math.max(0, Math.round(totalHours * 100) / 100);
  }

  /**
   * Calculates overtime hours past standard 8-hour workday.
   */
  public calculateOvertime(workHours: number, standardHours = 8): number {
    if (workHours <= standardHours) return 0;
    return Math.round((workHours - standardHours) * 100) / 100;
  }

  /**
   * Determines status according to check-in time and presence.
   */
  public determineStatus(checkInTime?: string | null, delayMinutes = 0): AttendanceStatus {
    if (!checkInTime || checkInTime === "—") return "غياب";
    if (delayMinutes > 0) return "تأخير";
    return "حاضر";
  }
}

/**
 * Biometric Log Parser for common fingerprint machine formats:
 * Format 1 (ZKTeco DAT): "USERID\tCHECKTIME\tCHECKTYPE"
 * Format 2 (CSV): "EmployeeCode,Date,Time,Type" or "EmployeeCode,CheckIn,CheckOut"
 */
export class BiometricLogParser {
  public static parseCsvOrDat(content: string): Array<{
    employeeCode: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
  }> {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const map = new Map<string, { employeeCode: string; date: string; punches: string[] }>();

    for (const line of lines) {
      // Split by tab or comma
      const parts = line.split(/[,\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 2) continue;

      // Skip header if line contains non-digit employee code like "EmployeeID"
      if (/^(code|emp|user|id|employee)/i.test(parts[0])) continue;

      const code = parts[0];
      let date = "";
      let time = "";

      if (parts[1].includes(" ")) {
        // e.g. "2026-10-11 08:14:22"
        const [d, t] = parts[1].split(" ");
        date = d;
        time = t?.slice(0, 8) || "08:00:00";
      } else if (parts.length >= 3 && /^\d{1,2}:\d{2}/.test(parts[2])) {
        // e.g. "101, 2026-10-11, 08:14:22"
        date = parts[1];
        time = parts[2].slice(0, 8);
      } else {
        date = new Date().toISOString().slice(0, 10);
        time = parts[1].slice(0, 8);
      }

      if (!date || !code) continue;
      const key = `${code}_${date}`;
      const entry = map.get(key) || { employeeCode: code, date, punches: [] };
      entry.punches.push(time);
      map.set(key, entry);
    }

    const results: Array<{ employeeCode: string; date: string; checkIn?: string; checkOut?: string }> = [];
    for (const entry of Array.from(map.values())) {
      entry.punches.sort();
      const checkIn = entry.punches[0];
      const checkOut = entry.punches.length > 1 ? entry.punches[entry.punches.length - 1] : undefined;
      results.push({
        employeeCode: entry.employeeCode,
        date: entry.date,
        checkIn,
        checkOut,
      });
    }

    return results;
  }
}
