import { describe, expect, it } from "vitest";
import { AttendanceCalculator, BiometricLogParser } from "./attendance-domain";

describe("AttendanceCalculator (Domain Engine)", () => {
  it("calculates working hours, delay, and status accurately", () => {
    const calc = new AttendanceCalculator("08:00:00", "17:00:00", 15);

    // 08:30 is 30 mins late (grace period 15 mins exceeded)
    const delay = calc.calculateDelay("08:30:00");
    expect(delay).toBe(30);

    // 08:10 is within grace period
    const noDelay = calc.calculateDelay("08:10:00");
    expect(noDelay).toBe(0);

    // Work hours between 08:30 and 16:30 = 8.0 hours
    const workHours = calc.calculateWorkHours("08:30:00", "16:30:00");
    expect(workHours).toBe(8);

    // Overtime
    const overtime = calc.calculateOvertime(workHours, 8);
    expect(overtime).toBe(0);

    // Status
    const statusLate = calc.determineStatus("08:30:00", delay);
    expect(statusLate).toBe("تأخير");

    const statusPresent = calc.determineStatus("08:00:00", 0);
    expect(statusPresent).toBe("حاضر");

    const statusAbsent = calc.determineStatus(null, 0);
    expect(statusAbsent).toBe("غياب");
  });

  it("calculates overtime when worked beyond standard 8-hour shift", () => {
    const calc = new AttendanceCalculator("08:00:00", "17:00:00", 15);
    const workHours = calc.calculateWorkHours("08:00:00", "19:00:00");
    expect(workHours).toBe(11);

    const overtime = calc.calculateOvertime(workHours, 8);
    expect(overtime).toBe(3);
  });

  it("supports flexible shifts and calculates delay and early departure accurately", () => {
    // Early morning shift: 06:00 to 14:00 with 10 min grace period
    const morningCalc = new AttendanceCalculator("06:00", "14:00", 10);

    // Arrives at 06:08 -> within 10 min grace period
    expect(morningCalc.calculateDelay("06:08:00")).toBe(0);

    // Arrives at 06:25 -> 25 minutes late
    expect(morningCalc.calculateDelay("06:25:00")).toBe(25);

    // Leaves at 13:40 -> 20 minutes early departure
    expect(morningCalc.calculateEarlyDeparture("13:40:00")).toBe(20);

    // Leaves at 14:05 -> on time / no early departure
    expect(morningCalc.calculateEarlyDeparture("14:05:00")).toBe(0);

    // Evening / Night shift: 16:00 to 01:00 with 15 min grace
    const eveningCalc = new AttendanceCalculator("16:00", "01:00", 15);

    // Arrives at 16:20 -> 20 minutes late
    expect(eveningCalc.calculateDelay("16:20:00")).toBe(20);

    // Leaves at 00:30 (overnight) -> 30 minutes early exit
    expect(eveningCalc.calculateEarlyDeparture("00:30:00")).toBe(30);

    // Leaves at 01:10 -> 0 early departure
    expect(eveningCalc.calculateEarlyDeparture("01:10:00")).toBe(0);
  });
});

describe("BiometricLogParser (Hardware Parser)", () => {
  it("parses standard tab-separated or space-separated ZKTeco text logs", () => {
    const rawContent = `101\t2026-10-11 07:58:20\t0
102\t2026-10-11 08:22:15\t0
101\t2026-10-11 17:05:00\t1`;

    const parsed = BiometricLogParser.parseCsvOrDat(rawContent);

    expect(parsed.length).toBeGreaterThanOrEqual(2);
    const user101 = parsed.find(p => p.employeeCode === "101");
    expect(user101).toBeDefined();
    expect(user101?.date).toBe("2026-10-11");
    expect(user101?.checkIn).toBe("07:58:20");
    expect(user101?.checkOut).toBe("17:05:00");

    const user102 = parsed.find(p => p.employeeCode === "102");
    expect(user102).toBeDefined();
    expect(user102?.checkIn).toBe("08:22:15");
  });

  it("parses CSV formatted attendance logs", () => {
    const csvContent = `User,Date,Time,Type
999,2026-10-11,08:00:00,IN
999,2026-10-11,16:30:00,OUT`;

    const parsed = BiometricLogParser.parseCsvOrDat(csvContent);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].employeeCode).toBe("999");
    expect(parsed[0].date).toBe("2026-10-11");
    expect(parsed[0].checkIn).toBe("08:00:00");
    expect(parsed[0].checkOut).toBe("16:30:00");
  });
});
