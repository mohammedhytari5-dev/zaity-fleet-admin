import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal } from "../common";
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
  const [date, setDate] = useState(attendance?.date || new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState(attendance?.checkIn || "08:00:00");
  const [checkOut, setCheckOut] = useState(attendance?.checkOut || "17:00:00");
  const [status, setStatus] = useState<any>(attendance?.status || "حاضر");
  const [notes, setNotes] = useState(attendance?.notes || "");

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

        if (selectedPerson.startsWith("emp_")) {
          const empId = Number(selectedPerson.slice(4));
          const emp = employees.find((e) => e.id === empId);
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

  return (
    <Modal title={attendance ? "تعديل سجل حضور وانصراف" : "تسجيل حركة حضور وانصراف يدوي"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {!attendance && (
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>الموظف أو السائق *</span>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
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
