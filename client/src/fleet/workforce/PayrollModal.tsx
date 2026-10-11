import React from "react";
import { Modal, FormActions } from "../common";
import { Trash } from "lucide-react";
import type { PayrollRow, EmployeeRow } from "../types";

interface PayrollModalProps {
  payrollModal: PayrollRow | "new" | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  employeesList: EmployeeRow[];
  onDelete: (item: PayrollRow) => void;
}

export const PayrollModal: React.FC<PayrollModalProps> = ({
  payrollModal,
  onClose,
  onSubmit,
  employeesList,
  onDelete,
}) => {
  if (!payrollModal) return null;

  return (
    <Modal
      title={
        payrollModal === "new"
          ? "إضافة بند مسير راتب يدوي"
          : `تعديل مسير راتب · ${payrollModal.employeeName}`
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="form-shell">
        <div className="form-grid">
          {payrollModal === "new" ? (
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
          ) : (
            <div className="field">
              <span>الموظف</span>
              <strong>{payrollModal.employeeName}</strong>
            </div>
          )}

          <label className="field">
            <span>الحالة</span>
            <select
              name="status"
              defaultValue={
                payrollModal === "new" ? "مسودة" : payrollModal.status
              }
            >
              <option value="مسودة">مسودة</option>
              <option value="معتمد">معتمد</option>
              <option value="تم الصرف">تم الصرف</option>
            </select>
          </label>

          <label className="field">
            <span>الراتب الأساسي</span>
            <input
              name="basicSalary"
              type="number"
              defaultValue={
                payrollModal === "new" ? 0 : payrollModal.basicSalary
              }
            />
          </label>

          <label className="field">
            <span>إجمالي البدلات</span>
            <input
              name="allowances"
              type="number"
              defaultValue={
                payrollModal === "new" ? 0 : payrollModal.allowances
              }
            />
          </label>

          <label className="field">
            <span>الخصومات والاستقطاعات</span>
            <input
              name="deductions"
              type="number"
              defaultValue={
                payrollModal === "new" ? 0 : payrollModal.deductions
              }
            />
          </label>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <label className="field">
            <span>ملاحظات</span>
            <input
              name="notes"
              type="text"
              defaultValue={
                payrollModal === "new" ? "" : payrollModal.notes || ""
              }
            />
          </label>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.25rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border-color, #e5e7eb)",
          }}
        >
          {payrollModal !== "new" ? (
            <button
              type="button"
              className="btn outline danger"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              onClick={() => {
                const itemToDelete = payrollModal;
                onClose();
                onDelete(itemToDelete);
              }}
            >
              <Trash size={15} /> حذف هذا المسير
            </button>
          ) : (
            <div />
          )}
          <FormActions
            onCancel={onClose}
            label="حفظ المسير"
          />
        </div>
      </form>
    </Modal>
  );
};
