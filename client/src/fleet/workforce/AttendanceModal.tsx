import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal, toInputDate } from "../common";
import type { AttendanceRow, EmployeeRow, Driver } from "../types";

export function AttendanceModal({
  attendance,
  employees,
  drivers,
  onClose,
  onSaved,
}: {
  attendance?: AttendanceRow | null;
  employees: EmployeeRow[];
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const createMutation = trpc.attendance.create.useMutation();
  const updateMutation = trpc.attendance.update.useMutation();

  const [selectedPerson, setSelectedPerson] = useState(() => {
    if (attendance?.employeeId) return `emp_${attendance.employeeId}`;
    if (attendance?.employeeCode) return `drv_${attendance.employeeCode}`;
    return "";
  });
  const [date, setDate] = useState(() => toInputDate(attendance?.date) || new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState(attendance?.checkIn || "08:00:00");
  const [checkOut, setCheckOut] = useState(attendance?.checkOut || "17:00:00");
  const [status, setStatus] = useState<any>(attendance?.status || "حاضر");
  const [notes, setNotes] = useState(attendance?.notes || "");

  useEffect(() => {
    if (attendance) {
      setSelectedPerson(
        attendance.employeeId
          ? `emp_${attendance.employeeId}`
          : attendance.employeeCode
          ? `drv_${attendance.employeeCode}`
          : ""
      );
      setDate(toInputDate(attendance.date) || new Date().toISOString().slice(0, 10));
      setCheckIn(attendance.checkIn || "08:00:00");
      setCheckOut(attendance.checkOut || "17:00:00");
      setStatus(attendance.status || "حاضر");
      setNotes(attendance.notes || "");
    }
  }, [attendance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendance && !selectedPerson) {
      toast.error("يرجى اختيار الموظف أو السائق");
      return;
    }

    try {
      if (attendance) {
        await updateMutation.mutateAsync({
          id: attendance.id,
          data: {
            checkIn: checkIn || null,
            checkOut: checkOut || null,
            status,
            notes: notes.trim() || undefined,
          },
        });
        toast.success("تم تحديث سجل الحضور بنجاح");
      } else {
        let employeeId: number | null = null;
        let employeeName = "";
        let employeeCode = "—";

        const emp = selectedPerson.startsWith("emp_")
          ? employees.find((e) => e.id === Number(selectedPerson.slice(4)))
          : null;

        if (selectedPerson.startsWith("emp_")) {
          const empId = Number(selectedPerson.slice(4));
          employeeId = empId;
          employeeName = emp?.name || "موظف";
          employeeCode = emp?.employeeNo || `EMP-${empId}`;
        } else if (selectedPerson.startsWith("drv_")) {
          const drvId = Number(selectedPerson.slice(4));
          const drv = drivers.find((d) => d.id === drvId);
          employeeId = null;
          employeeName = `${drv?.name || "سائق"} (سائق)`;
          employeeCode = `DRV-${drvId}`;
        }

        await createMutation.mutateAsync({
          employeeId,
          employeeName,
          employeeCode,
          date,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          shiftName: emp?.shiftName || "الدوام الافتراضي (08:00 - 17:00)",
          shiftStart: emp?.shiftStart || "08:00",
          shiftEnd: emp?.shiftEnd || "17:00",
          status,
          source: "يدوي",
          notes: notes.trim() || undefined,
        });
        toast.success("تم تسجيل حركة الحضور بنجاح");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(`تعذر حفظ سجل الحضور: ${err.message}`);
    }
  };

  const selectedEmp = selectedPerson.startsWith("emp_")
    ? employees.find((e) => e.id === Number(selectedPerson.slice(4)))
    : null;

  return (
    <Modal title={attendance ? "تعديل سجل حضور وانصراف" : "تسجيل حركة حضور وانصراف يدوي"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {!attendance && (
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>الموظف أو السائق *</span>
              <select
                value={selectedPerson}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPerson(val);
                  if (val.startsWith("emp_")) {
                    const found = employees.find((x) => x.id === Number(val.slice(4)));
                    if (found) {
                      setCheckIn(found.shiftStart ? `${found.shiftStart}:00` : "08:00:00");
                      setCheckOut(found.shiftEnd ? `${found.shiftEnd}:00` : "17:00:00");
                    }
                  }
                }}
                required
              >
                <option value="">-- اختر الموظف أو السائق --</option>
                <optgroup label="الموظفون">
                  {employees.map((emp) => (
                    <option key={`emp_${emp.id}`} value={`emp_${emp.id}`}>
                      {emp.name} ({emp.department} - {emp.employeeNo || emp.id})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="السائقون">
                  {drivers.map((drv) => (
                    <option key={`drv_${drv.id}`} value={`drv_${drv.id}`}>
                      {drv.name} (سائق - {drv.phone || "—"})
                    </option>
                  ))}
                </optgroup>
              </select>
              {selectedEmp && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--brand-primary, #25364c)", background: "#f0fdf4", padding: "4px 8px", borderRadius: 4, display: "inline-block" }}>
                  ⏰ <strong>الوردية المعتمدة:</strong> {selectedEmp.shiftName || "الدوام الافتراضي"} ({selectedEmp.shiftStart || "08:00"} إلى {selectedEmp.shiftEnd || "17:00"}) · فترة سماح {selectedEmp.gracePeriodMinutes ?? 15} دقيقة
                </div>
              )}
            </label>
          )}

          <label className="field">
            <span>التاريخ *</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={Boolean(attendance)}
              required
            />
          </label>

          <label className="field">
            <span>الحالة *</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="حاضر">حاضر</option>
              <option value="تأخير">تأخير</option>
              <option value="غياب">غياب</option>
              <option value="إجازة">إجازة</option>
              <option value="استئذان">استئذان</option>
              <option value="عطلة">عطلة</option>
            </select>
          </label>

          <label className="field">
            <span>وقت الحضور (Check-In)</span>
            <input
              type="time"
              step="1"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </label>

          <label className="field">
            <span>وقت الانصراف (Check-Out)</span>
            <input
              type="time"
              step="1"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </label>

          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>ملاحظات إضافية</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: استئذان مسبق، عطل فني في جهاز البصمة، إلخ..."
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1.25rem" }}>
          <button type="button" className="btn outline" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : "حفظ السجل"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
