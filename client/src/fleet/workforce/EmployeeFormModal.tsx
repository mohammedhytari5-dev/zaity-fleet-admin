import React from "react";
import { Modal, Field, FormActions, Badge } from "../common";
import { normalizeNumericInput } from "@shared/identity-number";
import type { Row, Vehicle } from "../types";

interface EmployeeFormModalProps {
  form: Row | null;
  setForm: React.Dispatch<React.SetStateAction<Row | null>>;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
  isExisting: boolean;
  employeeVehicles: Vehicle[];
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  form,
  setForm,
  onSave,
  onClose,
  isExisting,
  employeeVehicles,
}) => {
  if (!form) return null;

  return (
    <Modal
      title={
        isExisting
          ? `تعديل ملف الموظف · ${form.name}`
          : "إضافة موظف جديد"
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={onSave} className="form-shell">
        <h4 style={{ margin: "0.5rem 0", color: "var(--brand-primary, #25364c)" }}>
          البيانات الشخصية والوظيفية
        </h4>
        <div className="form-grid">
          <Field
            label="الرقم الوظيفي"
            value={form.employeeNo}
            onChange={(value) =>
              setForm((prev) => (prev ? { ...prev, employeeNo: value } : prev))
            }
          />
          <Field
            label="الاسم الكامل"
            value={form.name}
            onChange={(value) =>
              setForm((prev) => (prev ? { ...prev, name: value } : prev))
            }
          />
          <Field
            label="رقم الهوية الوطنية / الإقامة"
            value={form.nationalId === "—" ? "" : form.nationalId}
            onChange={(value) =>
              setForm((prev) =>
                prev
                  ? {
                      ...prev,
                      nationalId: normalizeNumericInput(value, 10),
                    }
                  : prev
              )
            }
          />
          <Field
            label="رقم الهاتف"
            value={form.phone}
            onChange={(value) =>
              setForm((prev) => (prev ? { ...prev, phone: value } : prev))
            }
          />
          <Field
            label="البريد الإلكتروني"
            value={form.email === "—" ? "" : form.email}
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, email: value || "—" } : prev
              )
            }
          />
          <Field
            label="القسم"
            value={form.department}
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, department: value } : prev
              )
            }
          />
          <Field
            label="المسمى الوظيفي"
            value={form.jobTitle}
            onChange={(value) =>
              setForm((prev) => (prev ? { ...prev, jobTitle: value } : prev))
            }
          />
          <label className="field">
            <span>نوع العقد</span>
            <select
              value={form.contractType || "دوام كامل"}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, contractType: event.target.value } : prev
                )
              }
            >
              <option>دوام كامل</option>
              <option>دوام جزئي</option>
              <option>عقد مؤقت</option>
              <option>استشاري</option>
            </select>
          </label>
          <Field
            label="تاريخ المباشرة"
            type="date"
            value={form.hireDate === "—" ? "" : form.hireDate}
            onChange={(value) =>
              setForm((prev) => (prev ? { ...prev, hireDate: value } : prev))
            }
          />
          <label className="field">
            <span>الحالة</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, status: event.target.value } : prev
                )
              }
            >
              <option>نشط</option>
              <option>إجازة</option>
              <option>موقوف</option>
              <option>منتهي الخدمة</option>
            </select>
          </label>
        </div>

        {/* Driver Fleet Assignment Section */}
        <div
          style={{
            margin: "1.25rem 0",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: form.isDriver
              ? "1px solid #93c5fd"
              : "1px solid var(--border-color, #e5e7eb)",
            background: form.isDriver
              ? "#f0f7ff"
              : "var(--brand-surface, #f8f9fa)",
            transition: "all 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: form.isDriver ? "1rem" : 0,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: form.isDriver ? "#1d4ed8" : "inherit",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(form.isDriver)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          isDriver: checked,
                          jobTitle:
                            checked &&
                            (!prev.jobTitle || prev.jobTitle === "موظف")
                              ? "سائق أسطول"
                              : prev.jobTitle,
                          department:
                            checked &&
                            (!prev.department || prev.department === "الإدارة")
                              ? "الحركة والأسطول"
                              : prev.department,
                        }
                      : prev
                  );
                }}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span>🚗 تعيين كسائق أسطول (ربط مباشر بالمركبات، الرخص، والحوادث)</span>
            </label>
            {form.isDriver && <Badge>سائق أسطول</Badge>}
          </div>

          {form.isDriver && (
            <div className="form-grid" style={{ marginTop: "0.75rem" }}>
              <label className="field">
                <span>نوع رخصة القيادة</span>
                <select
                  value={form.driverLicense || "خصوصي"}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, driverLicense: e.target.value } : prev
                    )
                  }
                >
                  <option>خصوصي</option>
                  <option>عمومي خفيف</option>
                  <option>عمومي ثقيل</option>
                  <option>نقل ثقيل</option>
                  <option>دراجة آلية</option>
                  <option>معدات ثقيلة</option>
                </select>
              </label>
              <Field
                label="تاريخ انتهاء / تجديد الرخصة"
                type="date"
                value={form.driverRenewal === "—" ? "" : form.driverRenewal || ""}
                onChange={(val) =>
                  setForm((prev) =>
                    prev ? { ...prev, driverRenewal: val || "—" } : prev
                  )
                }
              />
              <label className="field">
                <span>إسناد مركبة من الأسطول</span>
                <select
                  value={form.driverVehicleId ?? ""}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            driverVehicleId: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : prev
                    )
                  }
                >
                  <option value="">بدون مركبة مسندة حالياً</option>
                  {employeeVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.brand} {v.model}{" "}
                      {v.driver && v.driver !== "—"
                        ? `(مع: ${v.driver})`
                        : "(متاحة)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <h4
          style={{
            margin: "1.25rem 0 0.5rem 0",
            color: "var(--brand-primary, #25364c)",
          }}
        >
          الراتب الشهري والبدلات (ر.س)
        </h4>
        <div className="form-grid">
          <Field
            label="الراتب الأساسي"
            type="number"
            value={String(form.basicSalary || 0)}
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, basicSalary: Number(value) } : prev
              )
            }
          />
          <Field
            label="بدل السكن"
            type="number"
            value={String(form.housingAllowance || 0)}
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, housingAllowance: Number(value) } : prev
              )
            }
          />
          <Field
            label="بدل النقل"
            type="number"
            value={String(form.transportAllowance || 0)}
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, transportAllowance: Number(value) } : prev
              )
            }
          />
          <Field
            label="بدلات أخرى"
            type="number"
            value={String(form.otherAllowance || 0)}
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, otherAllowance: Number(value) } : prev
              )
            }
          />
        </div>

        <h4
          style={{
            margin: "1.25rem 0 0.5rem 0",
            color: "var(--brand-primary, #25364c)",
          }}
        >
          تواريخ انتهاء الوثائق
        </h4>
        <div className="form-grid">
          <Field
            label="تاريخ انتهاء الإقامة"
            type="date"
            value={
              form.residencyExpiry === "—" ? "" : form.residencyExpiry || ""
            }
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, residencyExpiry: value || "—" } : prev
              )
            }
          />
          <Field
            label="تاريخ انتهاء التأمين"
            type="date"
            value={
              form.insuranceExpiry === "—" ? "" : form.insuranceExpiry || ""
            }
            onChange={(value) =>
              setForm((prev) =>
                prev ? { ...prev, insuranceExpiry: value || "—" } : prev
              )
            }
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <Field
            label="ملاحظات"
            value={form.notes || ""}
            onChange={(value) =>
              setForm((prev) => (prev ? { ...prev, notes: value } : prev))
            }
          />
        </div>

        <FormActions
          onCancel={onClose}
          label="حفظ ملف الموظف"
        />
      </form>
    </Modal>
  );
};
