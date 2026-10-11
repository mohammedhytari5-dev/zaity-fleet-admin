import React from "react";
import { Modal, Badge, formatSAR, DocumentFileActions, LinkedDocumentsSection } from "../common";
import { Truck, Pencil } from "lucide-react";
import { resolveRenewalStatus } from "@shared/date-utils";
import { isLinkedDocument } from "@/lib/documentRelations";
import type {
  EmployeeRow,
  Vehicle,
  Driver,
  ProjectRow,
  Document,
  ModuleKey,
} from "../types";

interface EmployeeProfileModalProps {
  profile: EmployeeRow | null;
  onClose: () => void;
  onEdit: (employee: EmployeeRow) => void;
  canAccess: (key: ModuleKey) => boolean;
  canManageAccounts: boolean;
  driversById: Map<number, Driver>;
  driversList: Driver[];
  vehiclesByDriverId: Map<number, Vehicle>;
  employeeVehicles: Vehicle[];
  employeeProjects: ProjectRow[];
  employeeDocuments: Document[];
  userAccounts: Array<{
    id: number;
    name: string | null;
    username: string | null;
    role: string;
    isActive: number;
  }>;
  onAssignVehicle: (vehicleId: number, driverId: number) => void;
  onUnassignVehicle: (vehicleId: number) => void;
  onLinkUser: (employeeId: number, userId: number | null) => void;
  isLinkingUser: boolean;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  profile,
  onClose,
  onEdit,
  canAccess,
  canManageAccounts,
  driversById,
  driversList,
  vehiclesByDriverId,
  employeeVehicles,
  employeeProjects,
  employeeDocuments,
  userAccounts,
  onAssignVehicle,
  onUnassignVehicle,
  onLinkUser,
  isLinkingUser,
}) => {
  if (!profile) return null;

  const isProfileDriver = Boolean(
    profile.driverId || profile.jobTitle?.includes("سائق")
  );

  const matchedDriver = profile.driverId
    ? driversById.get(profile.driverId)
    : driversList.find((d) => d.name.trim() === profile.name.trim());

  const matchedVehicle = profile.driverId
    ? vehiclesByDriverId.get(profile.driverId)
    : employeeVehicles.find((v) => v.driver === profile.name);

  const totalSalary =
    Number(profile.basicSalary || 0) +
    Number(profile.housingAllowance || 0) +
    Number(profile.transportAllowance || 0) +
    Number(profile.otherAllowance || 0);

  return (
    <Modal
      title={`ملف الموظف · ${profile.name}`}
      onClose={onClose}
      wide
    >
      <div className="driver-summary">
        <span className="avatar">{profile.name.slice(0, 1)}</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <strong>{profile.name}</strong>
            {isProfileDriver && (
              <span
                style={{
                  background: "#dbeafe",
                  color: "#1e40af",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Truck size={13} /> سائق أسطول
              </span>
            )}
          </div>
          <span>
            {profile.employeeNo} · {profile.jobTitle} · {profile.department}
          </span>
          <Badge>{profile.status}</Badge>
        </div>
      </div>

      <div className="quick-metrics">
        <div>
          <span>الهاتف</span>
          <strong>{profile.phone}</strong>
        </div>
        <div>
          <span>الهوية / الإقامة</span>
          <strong>{profile.nationalId}</strong>
        </div>
        <div>
          <span>نوع العقد</span>
          <strong>{profile.contractType || "دوام كامل"}</strong>
        </div>
        <div>
          <span>تاريخ المباشرة</span>
          <strong>{profile.hireDate}</strong>
        </div>
      </div>

      {/* Salary Breakdown Section */}
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h3>البيانات المالية والراتب</h3>
            <span>تفاصيل الأجر الشهري والبدلات المعتمدة</span>
          </div>
        </div>
        <div className="quick-metrics">
          <div>
            <span>الراتب الأساسي</span>
            <strong>{formatSAR(Number(profile.basicSalary || 0))}</strong>
          </div>
          <div>
            <span>بدل السكن</span>
            <strong>{formatSAR(Number(profile.housingAllowance || 0))}</strong>
          </div>
          <div>
            <span>بدل النقل</span>
            <strong>{formatSAR(Number(profile.transportAllowance || 0))}</strong>
          </div>
          <div>
            <span>بدلات أخرى</span>
            <strong>{formatSAR(Number(profile.otherAllowance || 0))}</strong>
          </div>
        </div>
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            background: "var(--brand-surface, #f8f9fa)",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>إجمالي الراتب الشهري المستحق:</span>
          <strong className="teal-text" style={{ fontSize: "1.2rem" }}>
            {formatSAR(totalSalary)}
          </strong>
        </div>
      </section>

      {/* Residency and Insurance */}
      <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="section-head">
          <div>
            <h3>صلاحية الوثائق والإقامة</h3>
            <span>متابعة انتهاء الإقامة والتأمين الطبي</span>
          </div>
        </div>
        <div className="quick-metrics">
          <div>
            <span>تاريخ انتهاء الإقامة</span>
            <strong>{profile.residencyExpiry || "—"}</strong>
          </div>
          <div>
            <span>تاريخ انتهاء التأمين</span>
            <strong>{profile.insuranceExpiry || "—"}</strong>
          </div>
        </div>
      </section>

      {/* Driver & Vehicle Operations Section */}
      {isProfileDriver && (
        <section
          className="surface"
          style={{
            padding: "1.25rem",
            marginTop: "1rem",
            borderRadius: "10px",
            border: "1px solid #3b82f644",
            background: "linear-gradient(180deg, #f0f7ff 0%, #ffffff 100%)",
          }}
        >
          <div className="section-head" style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Truck size={20} style={{ color: "#2563eb" }} />
              <div>
                <h3 style={{ margin: 0, color: "#1e40af" }}>بيانات القيادة والأسطول</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  المركبة المسندة، حالة القيادة وصلاحية الرخصة
                </span>
              </div>
            </div>
            <Badge>{matchedDriver?.status || "متاح"}</Badge>
          </div>

          <div className="quick-metrics">
            <div>
              <span>المركبة المسندة حالياً</span>
              <strong
                style={{
                  color:
                    matchedVehicle ||
                    (matchedDriver?.vehicle && matchedDriver.vehicle !== "—")
                      ? "#15803d"
                      : "#94a3b8",
                }}
              >
                {matchedVehicle?.plate || matchedDriver?.vehicle || "لا توجد مركبة"}
              </strong>
            </div>
            <div>
              <span>نوع رخصة القيادة</span>
              <strong>{matchedDriver?.license || "خصوصي"}</strong>
            </div>
            <div>
              <span>تاريخ تجديد الرخصة</span>
              <strong>{matchedDriver?.renewal || "—"}</strong>
            </div>
            <div>
              <span>حالة سريان الرخصة</span>
              <Badge>
                {matchedDriver ? resolveRenewalStatus(matchedDriver.renewal) : "سارية"}
              </Badge>
            </div>
          </div>

          {canAccess("vehicles") && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>إسناد مركبة:</span>
                <select
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                  value={matchedVehicle?.id ?? ""}
                  onChange={(e) => {
                    const vId = e.target.value ? Number(e.target.value) : null;
                    const dId = profile.driverId ?? matchedDriver?.id;
                    if (vId && dId) {
                      onAssignVehicle(vId, dId);
                    }
                  }}
                >
                  <option value="">-- اختر مركبة للإسناد --</option>
                  {employeeVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.brand} {v.model}{" "}
                      {v.driver && v.driver !== "—" ? `(مع: ${v.driver})` : "(متاحة)"}
                    </option>
                  ))}
                </select>
              </div>

              {(matchedVehicle ||
                (matchedDriver?.vehicle && matchedDriver.vehicle !== "—")) && (
                <button
                  className="btn outline danger"
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                  onClick={() => {
                    const targetVehId =
                      matchedVehicle?.id ??
                      employeeVehicles.find((v) => v.plate === matchedDriver?.vehicle)?.id;
                    if (targetVehId) {
                      onUnassignVehicle(targetVehId);
                    }
                  }}
                >
                  فك إسناد المركبة
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Linked User Account */}
      {canManageAccounts && (
        <section className="surface employee-account-link" style={{ marginTop: "1rem" }}>
          <div>
            <h3>حساب النظام</h3>
            <span>
              اربط ملف الموظف بحساب الدخول والمهام الخاص به. الحساب الواحد
              يرتبط بملف موظف واحد.
            </span>
          </div>
          <label className="field">
            <span>حساب المستخدم</span>
            <select
              value={profile.userId ?? ""}
              onChange={(e) => {
                const userId = e.target.value ? Number(e.target.value) : null;
                onLinkUser(profile.id, userId);
              }}
              disabled={isLinkingUser}
            >
              <option value="">بدون حساب مرتبط</option>
              {userAccounts
                .filter((account) => account.isActive === 1 || account.id === profile.userId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name || account.username} · {account.username} ·{" "}
                    {account.isActive === 1 ? "نشط" : "موقوف"}
                  </option>
                ))}
            </select>
          </label>
          {profile.userId && (() => {
            const account = userAccounts.find((item) => item.id === profile.userId);
            return (
              <div className="employee-account-status">
                {account ? (
                  <>
                    <Badge>{account.isActive === 1 ? "نشط" : "موقوف"}</Badge>
                    <span>
                      {account.username} ·{" "}
                      {account.role === "admin" ? "مدير النظام" : "مستخدم"}
                    </span>
                  </>
                ) : (
                  <span>الحساب المرتبط #{profile.userId}</span>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* Operational Assignments */}
      {(canAccess("vehicles") || canAccess("projects")) && (
        <section className="surface" style={{ padding: "1rem", marginTop: "1rem" }}>
          <div className="section-head">
            <div>
              <h3>الإسنادات التشغيلية</h3>
              <span>المركبات والمشاريع المرتبطة حاليًا بهذا الموظف</span>
            </div>
          </div>
          <div className="quick-metrics">
            {canAccess("vehicles") && (
              <div>
                <span>المركبات المسؤول عنها</span>
                <strong>
                  {
                    employeeVehicles.filter(
                      (vehicle) => vehicle.employeeId === profile.id
                    ).length
                  }
                </strong>
              </div>
            )}
            {canAccess("projects") && (
              <div>
                <span>المشاريع التي يديرها</span>
                <strong>
                  {
                    employeeProjects.filter(
                      (project) => project.managerEmployeeId === profile.id
                    ).length
                  }
                </strong>
              </div>
            )}
          </div>
          <div className="compact-list">
            {canAccess("vehicles") &&
              employeeVehicles
                .filter((vehicle) => vehicle.employeeId === profile.id)
                .map((vehicle) => (
                  <div className="compact-row" key={`vehicle-${vehicle.id}`}>
                    <div className="compact-main">
                      <strong>مركبة · {vehicle.plate}</strong>
                      <small>
                        {vehicle.brand} {vehicle.model} · السائق{" "}
                        {canAccess("drivers") ? vehicle.driver : "—"}
                      </small>
                    </div>
                    <Badge>{vehicle.status}</Badge>
                  </div>
                ))}
            {canAccess("projects") &&
              employeeProjects
                .filter((project) => project.managerEmployeeId === profile.id)
                .map((project) => (
                  <div className="compact-row" key={`project-${project.id}`}>
                    <div className="compact-main">
                      <strong>مشروع · {project.name}</strong>
                      <small>
                        {project.ref} · العميل{" "}
                        {canAccess("clients") ? project.client : "—"}
                      </small>
                    </div>
                    <Badge>{project.status}</Badge>
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Linked Documents with Direct Upload and In-System Preview */}
      <LinkedDocumentsSection
        entityType="موظف"
        entityId={profile.id}
        entityName={`موظف · ${profile.name} (${profile.jobTitle || profile.employeeNo})`}
        canViewDocuments={canAccess("documents")}
        canUpload={true}
      />

      {profile.driverId && (
        <LinkedDocumentsSection
          entityType="سائق"
          entityId={profile.driverId}
          entityName={`سائق · ${profile.name} (رخصة قيادة ووثائق تشغيل)`}
          canViewDocuments={canAccess("documents")}
          canUpload={true}
        />
      )}

      <div className="form-actions" style={{ marginTop: "1.5rem" }}>
        <button className="btn ghost" onClick={onClose}>
          إغلاق
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const emp = profile;
            onClose();
            onEdit(emp);
          }}
        >
          <Pencil size={15} /> تعديل البيانات
        </button>
      </div>
    </Modal>
  );
};
