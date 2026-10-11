import React from "react";
import { Modal, FormActions } from "../common";
import { formatCompanyDate } from "@shared/date-utils";
import type { EmployeeRow } from "../types";

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  employeesList: EmployeeRow[];
}

export const LeaveModal: React.FC<LeaveModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  employeesList,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      title="تقديم طلب إجازة جديد"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="form-shell">
        <div className="form-grid">
          <label className="field">
            <span>الموظف</span>
            <select name="employeeId" required>
              <option value="">اختر الموظف...</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeNo})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>نوع الإجازة</span>
            <select name="type" defaultValue="سنوية">
              <option value="سنوية">سنوية</option>
              <option value="مرضية">مرضية</option>
              <option value="طارئة">طارئة</option>
              <option value="بدون راتب">بدون راتب</option>
            </select>
          </label>

          <label className="field">
            <span>تاريخ البدء</span>
            <input
              name="startDate"
              type="date"
              defaultValue={formatCompanyDate()}
              required
            />
          </label>

          <label className="field">
            <span>تاريخ الانتهاء</span>
            <input
              name="endDate"
              type="date"
              defaultValue={formatCompanyDate()}
              required
            />
          </label>

          <label className="field">
            <span>عدد الأيام</span>
            <input
              name="days"
              type="number"
              defaultValue={1}
              required
            />
          </label>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label className="field">
            <span>سبب الإجازة والملاحظات</span>
            <input
              name="reason"
              type="text"
              placeholder="أدخل سبب طلب الإجازة..."
            />
          </label>
        </div>
        <FormActions
          onCancel={onClose}
          label="إرسال طلب الإجازة"
        />
      </form>
    </Modal>
  );
};
