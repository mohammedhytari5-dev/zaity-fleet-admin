import React from "react";
import { TableShell, Badge, exportCsv, formatSAR } from "../common";
import { FileText, Pencil, Archive, Truck, User } from "lucide-react";
import { resolveRenewalStatus } from "@shared/date-utils";
import {
  WorkforceMember,
  DriverWorkforceMember,
} from "@shared/workforce-domain";

interface WorkforceTableProps {
  members: (WorkforceMember | DriverWorkforceMember)[];
  search: string;
  setSearch: (s: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  canManageAccounts: boolean;
  onViewProfile: (member: any) => void;
  onEdit: (member: any) => void;
  onArchive: (member: any) => void;
  onAdd: () => void;
}

export const WorkforceTable: React.FC<WorkforceTableProps> = ({
  members,
  search,
  setSearch,
  activeTab,
  setActiveTab,
  canManageAccounts,
  onViewProfile,
  onEdit,
  onArchive,
  onAdd,
}) => {
  // Filtering based on OOP methods and activeTab
  const filtered = members.filter((person) => {
    if (!person.matchesSearch(search)) return false;

    const isDrv = person.isDriver();
    const isDriverObj = person instanceof DriverWorkforceMember;
    const renewalStatus = isDriverObj
      ? resolveRenewalStatus(person.licenseRenewal)
      : "غير محددة";

    if (activeTab === "الكل") return true;
    if (activeTab === "سائقو الأسطول") return isDrv;
    if (activeTab === "موظفو الإدارة والتشغيل") return !isDrv;
    if (activeTab === "نشط") return person.isActive();
    if (activeTab === "إجازة")
      return person.status === "إجازة" || person.status === "في إجازة";
    if (activeTab === "رخص تنتهي قريباً")
      return isDrv && ["منتهية", "قريبة"].includes(renewalStatus);

    return person.status === activeTab;
  });

  const handleExport = () => {
    exportCsv(
      filtered.map((m) => {
        const isDrv = m.isDriver();
        const drvMember = m instanceof DriverWorkforceMember ? m : null;
        return {
          id: m.id,
          employeeNo: m.employeeNo,
          name: m.name,
          category: isDrv ? "سائق أسطول" : "إداري/تشغيلي",
          department: m.department,
          jobTitle: m.jobTitle,
          assignedVehicle: drvMember?.assignedVehiclePlate || "—",
          drivingLicense: drvMember?.licenseType || "—",
          licenseRenewal: drvMember?.licenseRenewal || "—",
          phone: m.phone,
          nationalId: m.nationalId,
          basicSalary: m.compensation.basicSalary,
          status: m.status,
          hireDate: m.hireDate,
        };
      }),
      [
        "employeeNo",
        "name",
        "category",
        "department",
        "jobTitle",
        "assignedVehicle",
        "drivingLicense",
        "licenseRenewal",
        "phone",
        "nationalId",
        "basicSalary",
        "status",
        "hireDate",
      ],
      "workforce_employees_drivers"
    );
  };

  return (
    <TableShell
      columns={[
        "الرقم الوظيفي",
        "الاسم الكامل",
        "الكادر والوظيفة",
        "المركبة المسندة",
        "رخصة القيادة",
        "إجمالي الراتب",
        "رقم الهاتف",
        "الهوية / الإقامة",
        "الحالة",
        ...(canManageAccounts ? ["حساب النظام"] : []),
        "تاريخ المباشرة",
        "الإجراءات",
      ]}
      onExport={handleExport}
      search={search}
      setSearch={setSearch}
      tabs={[
        "الكل",
        "سائقو الأسطول",
        "موظفو الإدارة والتشغيل",
        "نشط",
        "إجازة",
        "رخص تنتهي قريباً",
      ]}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      addLabel="إضافة كادر جديد"
      onAdd={onAdd}
    >
      {filtered.map((member) => {
        const isDrv = member.isDriver();
        const drvMember = member instanceof DriverWorkforceMember ? member : null;
        const totalSalary = member.compensation.grossSalary;

        return (
          <tr key={member.id}>
            <td>
              <strong className="table-primary">{member.employeeNo}</strong>
            </td>
            <td>
              <button
                className="driver-name-button"
                onClick={() => onViewProfile(member)}
              >
                <span
                  className="avatar"
                  style={{
                    background: isDrv ? "#dbeafe" : "#dcfce7",
                    color: isDrv ? "#1e40af" : "#15803d",
                    fontWeight: 700,
                  }}
                >
                  {member.name.trim().slice(0, 1)}
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <strong>{member.name}</strong>
                    {isDrv ? (
                      <span
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          padding: "0.15rem 0.55rem",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <Truck size={12} /> سائق أسطول
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#15803d",
                          padding: "0.15rem 0.55rem",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <User size={12} /> كادر إداري / تشغيلي
                      </span>
                    )}
                  </span>
                  <small>
                    {member.email && member.email !== "—"
                      ? member.email
                      : isDrv
                      ? `سائق أسطول · اضغط لعرض الملف`
                      : "كادر إداري وتشغيلي · اضغط لعرض الملف"}
                  </small>
                </span>
              </button>
            </td>
            <td>
              <div>
                <strong>{member.jobTitle}</strong>
                <small
                  style={{
                    display: "block",
                    color: "var(--muted, #64748b)",
                  }}
                >
                  {member.department}
                </small>
              </div>
            </td>
            <td>
              {isDrv ? (
                drvMember?.hasVehicle() ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      color: "#065f46",
                      padding: "0.25rem 0.55rem",
                      borderRadius: "6px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    <Truck size={14} style={{ color: "#059669" }} />
                    <span>{drvMember.assignedVehiclePlate}</span>
                  </div>
                ) : (
                  <span
                    style={{
                      color: "var(--muted, #94a3b8)",
                      fontSize: "0.85rem",
                    }}
                  >
                    غير مسند
                  </span>
                )
              ) : (
                <span style={{ color: "var(--muted, #cbd5e1)" }}>—</span>
              )}
            </td>
            <td>
              {isDrv && drvMember ? (
                <div>
                  <span style={{ fontWeight: 600 }}>{drvMember.licenseType}</span>
                  {drvMember.licenseRenewal && drvMember.licenseRenewal !== "—" && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        marginTop: "0.2rem",
                      }}
                    >
                      <Badge>{resolveRenewalStatus(drvMember.licenseRenewal)}</Badge>
                      <small style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {drvMember.licenseRenewal}
                      </small>
                    </div>
                  )}
                </div>
              ) : (
                <span style={{ color: "var(--muted, #cbd5e1)" }}>—</span>
              )}
            </td>
            <td>
              <strong>{formatSAR(totalSalary)}</strong>
            </td>
            <td>{member.phone}</td>
            <td>{member.nationalId}</td>
            <td>
              <Badge>{member.status}</Badge>
            </td>
            {canManageAccounts && (
              <td>
                <Badge>{member.userId ? "مرتبط" : "غير مرتبط"}</Badge>
              </td>
            )}
            <td>{member.hireDate}</td>
            <td className="actions-cell">
              <button
                className="row-menu-btn"
                title="عرض الملف"
                onClick={() => onViewProfile(member)}
              >
                <FileText size={15} />
              </button>
              <button
                className="row-menu-btn"
                title="تعديل"
                onClick={() => onEdit(member)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="row-menu-btn danger"
                title="إنهاء/أرشفة"
                onClick={() => onArchive(member)}
              >
                <Archive size={15} />
              </button>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
};
