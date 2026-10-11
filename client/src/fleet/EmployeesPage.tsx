import React, { useLayoutEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCompanyDate } from "@shared/date-utils";
import {
  isOptionalFixedLengthIdentity,
  normalizeIdentityNumber,
} from "@shared/identity-number";
import {
  Users,
  DollarSign,
  Calendar,
  Clock,
  Truck,
  Fingerprint,
} from "lucide-react";
import type {
  ModuleKey,
  Row,
  Vehicle,
  Document,
  ProjectRow,
  EmployeeRow,
  PayrollRow,
  LeaveRow,
  Driver,
} from "./types";
import { PageHeader, ImportModal } from "./common";
import {
  WorkforceFactory,
  WorkforceMember,
  DriverWorkforceMember,
  WorkforceComplianceInspector,
} from "@shared/workforce-domain";

// Modular Clean Workforce Subcomponents
import { WorkforceStatsCards } from "./workforce/WorkforceStatsCards";
import { WorkforceTable } from "./workforce/WorkforceTable";
import { PayrollSection } from "./workforce/PayrollSection";
import { PayrollModal } from "./workforce/PayrollModal";
import { LeavesSection } from "./workforce/LeavesSection";
import { LeaveModal } from "./workforce/LeaveModal";
import { ResidenciesComplianceSection } from "./workforce/ResidenciesComplianceSection";
import { FleetLicensesSection } from "./workforce/FleetLicensesSection";
import { AttendanceSection } from "./workforce/AttendanceSection";
import { EmployeeProfileModal } from "./workforce/EmployeeProfileModal";
import { EmployeeFormModal } from "./workforce/EmployeeFormModal";

export function EmployeesPage({
  canAccess,
  canManageAccounts,
  initialTab,
}: {
  canAccess: (key: ModuleKey) => boolean;
  canManageAccounts: boolean;
  initialTab?: "employees" | "drivers" | "attendance" | "payroll" | "leaves" | "residencies";
}) {
  const utils = trpc.useUtils();

  // Navigation Subtabs
  const [mainTab, setMainTab] = useState<
    "employees" | "drivers" | "attendance" | "payroll" | "leaves" | "residencies"
  >(initialTab || "employees");

  // Filter tabs for each view
  const [employeeTab, setEmployeeTab] = useState("الكل");
  const [payrollTab, setPayrollTab] = useState("الكل");
  const [leaveTab, setLeaveTab] = useState("الكل");
  const [residencyTab, setResidencyTab] = useState("الكل");
  const [driverTab, setDriverTab] = useState("الكل");

  // Queries
  const { data: employees = [] } = trpc.employees.list.useQuery(undefined, {
    staleTime: 20000,
  });

  const [payrollMonth, setPayrollMonth] = useState(() => {
    const now = new Date();
    return `${now.getMonth() + 1}-${now.getFullYear()}`;
  });

  const { data: payrollList = [] } = trpc.payroll.list.useQuery(
    { month: payrollMonth },
    { staleTime: 20000 }
  );

  const { data: leavesList = [] } = trpc.leaves.list.useQuery(undefined, {
    staleTime: 20000,
  });

  const { data: driversList = [] } = trpc.drivers.list.useQuery(undefined, {
    enabled: canAccess("drivers"),
    staleTime: 20000,
  });

  const { data: userAccounts = [] } = trpc.users.list.useQuery(undefined, {
    enabled: canManageAccounts,
    staleTime: 20000,
  });

  const { data: employeeDocuments = [] } = trpc.documents.list.useQuery(
    undefined,
    { enabled: canAccess("documents") }
  );

  const { data: employeeVehicles = [] } = trpc.vehicles.list.useQuery(
    undefined,
    { enabled: canAccess("vehicles") }
  );

  const { data: employeeProjects = [] } = trpc.projects.list.useQuery(
    undefined,
    { enabled: canAccess("projects") }
  );

  // Mutations
  const createEmployee = trpc.employees.create.useMutation();
  const updateEmployee = trpc.employees.update.useMutation();
  const archiveEmployee = trpc.employees.archive.useMutation();
  const linkEmployeeUser = trpc.employees.linkUser.useMutation();

  const createDriver = trpc.drivers.create.useMutation();
  const updateDriver = trpc.drivers.update.useMutation();
  const archiveDriver = trpc.drivers.archive.useMutation();
  const assignDriverVehicle = trpc.vehicles.assignDriver.useMutation();

  const createPayroll = trpc.payroll.create.useMutation();
  const updatePayroll = trpc.payroll.update.useMutation();
  const deletePayroll = trpc.payroll.delete.useMutation();
  const generateMonthPayroll = trpc.payroll.generateMonth.useMutation();

  const createLeave = trpc.leaves.create.useMutation();
  const updateLeave = trpc.leaves.update.useMutation();
  const archiveLeave = trpc.leaves.archive.useMutation();

  // Local state
  const [form, setForm] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<EmployeeRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [payrollModal, setPayrollModal] = useState<PayrollRow | "new" | null>(null);
  const [leaveModal, setLeaveModal] = useState<LeaveRow | "new" | null>(null);

  useLayoutEffect(() => {
    setForm(null);
    setProfile(null);
  }, [
    canAccess("documents"),
    canAccess("vehicles"),
    canAccess("projects"),
    canAccess("drivers"),
    canAccess("clients"),
    canAccess("finance"),
  ]);

  const list = employees as EmployeeRow[];

  const driversById = useMemo(() => {
    const map = new Map<number, Driver>();
    (driversList as Driver[]).forEach((d) => map.set(d.id, d));
    return map;
  }, [driversList]);

  const vehiclesByDriverId = useMemo(() => {
    const map = new Map<number, Vehicle>();
    (employeeVehicles as Vehicle[]).forEach((v) => {
      if (v.driverId) map.set(v.driverId, v);
    });
    return map;
  }, [employeeVehicles]);

  // Unified OOP Domain Models instantiation
  const mergedWorkforceDomain = useMemo<(WorkforceMember | DriverWorkforceMember)[]>(() => {
    const empList = list.map((emp) => {
      const matchedDrv = emp.driverId ? driversById.get(emp.driverId) : null;
      const matchedVeh = emp.driverId ? vehiclesByDriverId.get(emp.driverId) : null;
      return WorkforceFactory.create(emp, matchedDrv, matchedVeh);
    });

    const linkedDriverIds = new Set(list.map((e) => e.driverId).filter(Boolean));
    const unlinkedDrivers = (driversList as Driver[]).filter(
      (d) => !linkedDriverIds.has(d.id)
    );

    const syntheticDrivers = unlinkedDrivers.map((d) => {
      const matchedVeh = vehiclesByDriverId.get(d.id);
      return WorkforceFactory.createSyntheticDriver(d, matchedVeh);
    });

    return [...empList, ...syntheticDrivers];
  }, [list, driversList, driversById, vehiclesByDriverId]);

  // Inspection service for compliance
  const complianceInspection = useMemo(() => {
    return WorkforceComplianceInspector.inspect(mergedWorkforceDomain);
  }, [mergedWorkforceDomain]);

  const totalMonthlyPayroll = useMemo(() => {
    return list.reduce((sum, e) => {
      return (
        sum +
        Number(e.basicSalary || 0) +
        Number(e.housingAllowance || 0) +
        Number(e.transportAllowance || 0) +
        Number(e.otherAllowance || 0)
      );
    }, 0);
  }, [list]);

  const blank = (): Row => ({
    id: Date.now(),
    employeeNo: `EMP-${formatCompanyDate().slice(0, 4)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`,
    name: "",
    nationalId: "—",
    phone: "—",
    email: "—",
    department: "الإدارة",
    jobTitle: "موظف",
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    otherAllowance: 0,
    contractType: "دوام كامل",
    residencyExpiry: "—",
    insuranceExpiry: "—",
    hireDate: formatCompanyDate(),
    status: "نشط",
    notes: "",
    isDriver: false,
    driverLicense: "خصوصي",
    driverRenewal: "—",
    driverVehicleId: null,
  });

  const openEditForm = (employee: any) => {
    const rawEmp =
      list.find((e) => Number(e.id) === Number(employee.id)) ||
      (employee.driverId
        ? list.find((e) => Number(e.driverId) === Number(employee.driverId))
        : null) ||
      employee;

    const effectiveDriverId =
      rawEmp.driverId && Number(rawEmp.driverId) > 0
        ? Number(rawEmp.driverId)
        : employee.driverId && Number(employee.driverId) > 0
          ? Number(employee.driverId)
          : null;

    // Driver status is strictly bound to having a real driver link
    const isDrv = Boolean(effectiveDriverId);
    const matchedDrv = effectiveDriverId ? driversById.get(effectiveDriverId) : null;
    const matchedVeh = effectiveDriverId ? vehiclesByDriverId.get(effectiveDriverId) : null;

    setForm({
      ...rawEmp,
      id: rawEmp.id ?? employee.id,
      name: rawEmp.name || employee.name || "",
      employeeNo: rawEmp.employeeNo || employee.employeeNo || "",
      department: rawEmp.department || employee.department || "الإدارة",
      jobTitle: rawEmp.jobTitle || employee.jobTitle || "موظف",
      basicSalary: rawEmp.basicSalary ?? employee.compensation?.basicSalary ?? 0,
      housingAllowance: rawEmp.housingAllowance ?? employee.compensation?.housingAllowance ?? 0,
      transportAllowance: rawEmp.transportAllowance ?? employee.compensation?.transportAllowance ?? 0,
      otherAllowance: rawEmp.otherAllowance ?? employee.compensation?.otherAllowance ?? 0,
      driverId: effectiveDriverId,
      isDriver: isDrv,
      driverLicense: matchedDrv?.license || employee.licenseType || "خصوصي",
      driverRenewal: matchedDrv?.renewal || employee.licenseRenewal || "—",
      driverVehicleId: matchedVeh?.id ?? matchedDrv?.vehicleId ?? employee.assignedVehicleId ?? null,
      isSyntheticDriver: Boolean(employee.isSyntheticDriver && !rawEmp.id),
      rawDriverId: employee.isSyntheticDriver ? employee.driverId : null,
    });
  };

  const openAddForm = () => {
    setForm({
      ...blank(),
      isDriver: false,
      driverLicense: "خصوصي",
      driverRenewal: "—",
      driverVehicleId: null,
    });
  };

  const saveEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form?.name || !form?.employeeNo || !form?.department || !form?.jobTitle) {
      toast.error("أكمل الاسم والرقم والقسم والمسمى الوظيفي");
      return;
    }

    // Determine if modifying an existing employee in the database
    const existingEmployee = list.find(
      (item) => Number(item.id) === Number(form.id) && Number(form.id) > 0
    );
    const isExisting = Boolean(existingEmployee);

    if (
      (!isExisting || form.nationalId !== existingEmployee?.nationalId) &&
      !isOptionalFixedLengthIdentity(form.nationalId, 10)
    ) {
      toast.error("رقم هوية الموظف أو إقامته يجب أن يتكون من 10 أرقام");
      return;
    }
    const {
      id,
      isDriver,
      driverLicense,
      driverRenewal,
      driverVehicleId,
      isSyntheticDriver,
      rawDriver,
      rawDriverId,
      compensation,
      ...data
    } = form;

    const normalizedNationalId = (!isExisting || form.nationalId !== existingEmployee?.nationalId)
      ? normalizeIdentityNumber(form.nationalId)
      : form.nationalId;

    try {
      let linkedDriverId: number | null = (data.driverId && Number(data.driverId) > 0)
        ? Number(data.driverId)
        : null;

      if (isDriver) {
        if (linkedDriverId) {
          await updateDriver.mutateAsync({
            id: linkedDriverId,
            data: {
              name: data.name,
              phone: data.phone || "—",
              idNo: normalizedNationalId || "—",
              license: driverLicense || "خصوصي",
              renewal: driverRenewal || "—",
            },
          });
        } else {
          const createdDriver = await createDriver.mutateAsync({
            name: data.name,
            phone: data.phone || "—",
            idNo: normalizedNationalId || "—",
            license: driverLicense || "خصوصي",
            renewal: driverRenewal || "—",
            vehicleId: driverVehicleId ?? null,
            status: driverVehicleId ? "مشغول" : "متاح",
          });
          linkedDriverId = createdDriver.id;
        }

        if (driverVehicleId && linkedDriverId) {
          await assignDriverVehicle.mutateAsync({
            vehicleId: driverVehicleId,
            driverId: linkedDriverId,
          });
        }
      } else {
        // If turning off driver status, archive the old driver record in the fleet
        const oldDriverId = linkedDriverId || (rawDriverId ? Number(rawDriverId) : null);
        if (oldDriverId) {
          try {
            await archiveDriver.mutateAsync({ id: oldDriverId });
          } catch {
            // ignore if already archived
          }
        }
        linkedDriverId = null;
      }

      const cleanPayload = {
        employeeNo: data.employeeNo,
        name: data.name,
        nationalId: normalizedNationalId,
        phone: data.phone || "—",
        email: data.email || "—",
        department: data.department,
        jobTitle: data.jobTitle,
        basicSalary: Number(data.basicSalary || 0),
        housingAllowance: Number(data.housingAllowance || 0),
        transportAllowance: Number(data.transportAllowance || 0),
        otherAllowance: Number(data.otherAllowance || 0),
        contractType: data.contractType || "دوام كامل",
        residencyExpiry: data.residencyExpiry || "—",
        insuranceExpiry: data.insuranceExpiry || "—",
        hireDate: data.hireDate || "—",
        status: (data.status || "نشط") as "نشط" | "إجازة" | "موقوف" | "منتهي الخدمة",
        notes: data.notes || "",
        driverId: linkedDriverId,
      };

      if (isExisting) {
        // Update in-place without adding duplicate employees
        await updateEmployee.mutateAsync({ id: Number(form.id), data: cleanPayload });
      } else {
        // Create new employee
        await createEmployee.mutateAsync(cleanPayload as any);
      }

      setForm(null);
      await Promise.all([
        utils.employees.list.invalidate(),
        utils.drivers.list.invalidate(),
        utils.vehicles.list.invalidate(),
      ]);
      toast.success(
        isExisting
          ? "تم حفظ التعديلات على ملف الموظف بنجاح"
          : "تم حفظ ملف الموظف بنجاح"
      );
    } catch (err: any) {
      toast.error(`تعذر الحفظ: ${err.message}`);
    }
  };

  const archive = (employee: any) =>
    toast(
      `إنهاء ملف ${employee.name}؟ سيُزال إسناده للمشاريع والمركبات، وسيُعطّل حساب دخوله المرتبط إن وجد، مع إبقاء السجلات التاريخية.`,
      {
        action: {
          label: "تأكيد الإنهاء",
          onClick: () => {
            if (employee.isSyntheticDriver) {
              archiveDriver.mutate(
                { id: employee.driverId },
                {
                  onSuccess: () => {
                    utils.drivers.list.invalidate();
                    utils.vehicles.list.invalidate();
                    toast.success("تم إنهاء وأرشفة ملف السائق");
                  },
                  onError: (error) => toast.error(error.message),
                }
              );
            } else {
              archiveEmployee.mutate(
                { id: employee.id },
                {
                  onSuccess: () => {
                    utils.employees.list.invalidate();
                    utils.vehicles.list.invalidate();
                    utils.projects.list.invalidate();
                    if (employee.driverId) utils.drivers.list.invalidate();
                    if (canManageAccounts) utils.users.list.invalidate();
                    toast.success(
                      "تم إنهاء ملف الموظف وفك إسناداته وتعطيل حسابه المرتبط"
                    );
                  },
                  onError: (error) => toast.error(error.message),
                }
              );
            }
          },
        },
        cancel: { label: "إلغاء", onClick: () => {} },
      }
    );

  const handleGeneratePayroll = () => {
    if (!payrollMonth) return;
    toast(`توليد مسير الرواتب لشهر ${payrollMonth} لجميع الموظفين النشطين؟`, {
      action: {
        label: "توليد الآن",
        onClick: () => {
          generateMonthPayroll.mutate(
            { month: payrollMonth },
            {
              onSuccess: () => {
                utils.payroll.list.invalidate();
                toast.success(`تم توليد مسير الرواتب لشهر ${payrollMonth} بنجاح`);
              },
              onError: (error) => toast.error(error.message),
            }
          );
        },
      },
      cancel: { label: "إلغاء", onClick: () => {} },
    });
  };

  const handleDeletePayroll = (item: PayrollRow) => {
    toast(`تأكيد حذف مسير راتب ${item.employeeName} لشهر ${item.month}؟`, {
      action: {
        label: "تأكيد الحذف",
        onClick: () => {
          deletePayroll.mutate(
            { id: item.id },
            {
              onSuccess: () => {
                utils.payroll.list.invalidate();
                toast.success("تم حذف مسير الراتب بنجاح");
              },
              onError: (err) => toast.error(`تعذر حذف المسير: ${err.message}`),
            }
          );
        },
      },
      cancel: { label: "إلغاء", onClick: () => {} },
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="الهتاري بلس / الموارد البشرية"
        title="إدارة الموارد البشرية (Human Resources)"
        description="إدارة متكاملة للقوى العاملة: موظفو الإدارة، سائقو الأسطول، كشف الحضور والانصراف والبصمة، مسيرات الرواتب الشهرية، الإجازات، ومتابعة الامتثال والتراخيص."
        action={
          mainTab === "employees"
            ? "إضافة كادر جديد"
            : mainTab === "payroll"
            ? "توليد مسير الشهر"
            : mainTab === "leaves"
            ? "طلب إجازة جديدة"
            : undefined
        }
        onAction={
          mainTab === "employees"
            ? openAddForm
            : mainTab === "payroll"
            ? handleGeneratePayroll
            : mainTab === "leaves"
            ? () => setLeaveModal("new")
            : undefined
        }
      />

      {/* Main Subtabs Navigation */}
      <div
        className="table-tabs"
        style={{
          marginBottom: "1.25rem",
          background: "white",
          padding: "0.35rem 0.75rem",
          borderRadius: "10px",
          border: "1px solid var(--border-color, #e5e7eb)",
          display: "flex",
          gap: "0.75rem",
        }}
      >
        <button
          className={mainTab === "employees" ? "active" : ""}
          onClick={() => setMainTab("employees")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          <Users size={16} /> سجل الموظفين والسائقين ({mergedWorkforceDomain.length})
        </button>
        {canAccess("drivers") && (
          <button
            className={mainTab === "drivers" ? "active" : ""}
            onClick={() => setMainTab("drivers")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 0.75rem",
            }}
          >
            <Truck size={16} /> السائقون ({driversList.length})
          </button>
        )}
        <button
          className={mainTab === "attendance" ? "active" : ""}
          onClick={() => setMainTab("attendance")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          <Fingerprint size={16} /> الحضور والانصراف (البصمة)
        </button>
        <button
          className={mainTab === "payroll" ? "active" : ""}
          onClick={() => setMainTab("payroll")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          <DollarSign size={16} /> مسيرات الرواتب ({payrollList.length})
        </button>
        <button
          className={mainTab === "leaves" ? "active" : ""}
          onClick={() => setMainTab("leaves")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          <Calendar size={16} /> الإجازات ({leavesList.length})
        </button>
        <button
          className={mainTab === "residencies" ? "active" : ""}
          onClick={() => setMainTab("residencies")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          <Clock size={16} /> الإقامات والرخص والتأمين{" "}
          {complianceInspection.totalIssuesCount > 0
            ? `(${complianceInspection.totalIssuesCount} ⚠️)`
            : `(0)`}
        </button>
      </div>

      {/* TAB 1: EMPLOYEES & DRIVERS WORKFORCE */}
      {mainTab === "employees" && (
        <>
          <WorkforceStatsCards
            members={mergedWorkforceDomain}
            totalMonthlyPayroll={totalMonthlyPayroll}
            expiringDocsCount={complianceInspection.totalIssuesCount}
          />
          <WorkforceTable
            members={mergedWorkforceDomain}
            search={search}
            setSearch={setSearch}
            activeTab={employeeTab}
            setActiveTab={setEmployeeTab}
            canManageAccounts={canManageAccounts}
            onViewProfile={(m) => {
              const fullEmp = list.find((e) => e.id === m.id) || m;
              setProfile(fullEmp as EmployeeRow);
            }}
            onEdit={openEditForm}
            onArchive={archive}
            onAdd={openAddForm}
          />
        </>
      )}

      {/* TAB 2: PAYROLL */}
      {mainTab === "payroll" && (
        <PayrollSection
          payrollList={payrollList as PayrollRow[]}
          payrollMonth={payrollMonth}
          setPayrollMonth={setPayrollMonth}
          search={search}
          setSearch={setSearch}
          payrollTab={payrollTab}
          setPayrollTab={setPayrollTab}
          onRefresh={() => utils.payroll.list.invalidate()}
          onGenerate={handleGeneratePayroll}
          isGenerating={generateMonthPayroll.isPending}
          onOpenNewModal={() => setPayrollModal("new")}
          onOpenEditModal={(item) => setPayrollModal(item)}
          onDelete={handleDeletePayroll}
          onApprove={(id) =>
            updatePayroll.mutate(
              { id, data: { status: "معتمد" } },
              {
                onSuccess: () => {
                  utils.payroll.list.invalidate();
                  toast.success("تم اعتماد المسير");
                },
              }
            )
          }
          onDisburse={(id) =>
            updatePayroll.mutate(
              {
                id,
                data: {
                  status: "تم الصرف",
                  paidAt: formatCompanyDate(),
                },
              },
              {
                onSuccess: () => {
                  utils.payroll.list.invalidate();
                  toast.success("تم تأكيد صرف الراتب");
                },
              }
            )
          }
        />
      )}

      {/* TAB: ATTENDANCE & BIOMETRIC SYSTEM */}
      {mainTab === "attendance" && (
        <AttendanceSection
          employees={employees as EmployeeRow[]}
          drivers={driversList as Driver[]}
        />
      )}

      {/* TAB 3: LEAVES */}
      {mainTab === "leaves" && (
        <LeavesSection
          leavesList={leavesList as LeaveRow[]}
          employeesList={list}
          search={search}
          setSearch={setSearch}
          leaveTab={leaveTab}
          setLeaveTab={setLeaveTab}
          onOpenNewLeave={() => setLeaveModal("new")}
          onApproveLeave={(id) =>
            updateLeave.mutate(
              {
                id,
                data: {
                  status: "معتمدة",
                  approvedBy: "مدير الموارد البشرية",
                },
              },
              {
                onSuccess: () => {
                  utils.leaves.list.invalidate();
                  toast.success("تمت الموافقة على الإجازة");
                },
              }
            )
          }
          onRejectLeave={(id) =>
            updateLeave.mutate(
              {
                id,
                data: {
                  status: "مرفوضة",
                  approvedBy: "مدير الموارد البشرية",
                },
              },
              {
                onSuccess: () => {
                  utils.leaves.list.invalidate();
                  toast.success("تم رفض طلب الإجازة");
                },
              }
            )
          }
          onDeleteLeave={(id) =>
            archiveLeave.mutate(
              { id },
              {
                onSuccess: () => {
                  utils.leaves.list.invalidate();
                  toast.success("تم حذف الطلب");
                },
              }
            )
          }
        />
      )}

      {/* TAB 4: RESIDENCIES */}
      {mainTab === "residencies" && (
        <ResidenciesComplianceSection
          employees={list}
          search={search}
          setSearch={setSearch}
          residencyTab={residencyTab}
          setResidencyTab={setResidencyTab}
          onRefresh={() => utils.employees.list.invalidate()}
          onEdit={(emp) => setForm({ ...emp })}
          onViewProfile={(emp) => setProfile(emp)}
        />
      )}

      {/* TAB 5: DRIVERS */}
      {mainTab === "drivers" && canAccess("drivers") && (
        <FleetLicensesSection
          driversList={driversList as Driver[]}
          search={search}
          setSearch={setSearch}
          driverTab={driverTab}
          setDriverTab={setDriverTab}
          onRefresh={() => utils.drivers.list.invalidate()}
        />
      )}

      {/* MODAL: Employee Profile */}
      <EmployeeProfileModal
        profile={profile}
        onClose={() => setProfile(null)}
        onEdit={openEditForm}
        canAccess={canAccess}
        canManageAccounts={canManageAccounts}
        driversById={driversById}
        driversList={driversList as Driver[]}
        vehiclesByDriverId={vehiclesByDriverId}
        employeeVehicles={employeeVehicles as Vehicle[]}
        employeeProjects={employeeProjects as ProjectRow[]}
        employeeDocuments={employeeDocuments as Document[]}
        userAccounts={userAccounts as any}
        onAssignVehicle={(vehicleId, driverId) => {
          assignDriverVehicle.mutate(
            { vehicleId, driverId },
            {
              onSuccess: () => {
                utils.vehicles.list.invalidate();
                utils.drivers.list.invalidate();
                toast.success("تم إسناد المركبة بنجاح");
              },
              onError: (err) => toast.error(err.message),
            }
          );
        }}
        onUnassignVehicle={(vehicleId) => {
          assignDriverVehicle.mutate(
            { vehicleId, driverId: null },
            {
              onSuccess: () => {
                utils.vehicles.list.invalidate();
                utils.drivers.list.invalidate();
                toast.success("تم فك إسناد المركبة بنجاح");
              },
              onError: (err) => toast.error(err.message),
            }
          );
        }}
        onLinkUser={(employeeId, userId) => {
          linkEmployeeUser.mutate(
            { employeeId, userId },
            {
              onSuccess: (saved) => {
                setProfile((current) =>
                  current
                    ? { ...current, userId: saved.userId ?? null }
                    : current
                );
                utils.employees.list.invalidate();
                toast.success(
                  userId
                    ? "تم ربط حساب الدخول بملف الموظف"
                    : "تم فصل حساب الدخول عن ملف الموظف"
                );
              },
              onError: (error) =>
                toast.error(`تعذر ربط الحساب: ${error.message}`),
            }
          );
        }}
        isLinkingUser={linkEmployeeUser.isPending}
      />

      {/* MODAL: Add/Edit Employee Form */}
      <EmployeeFormModal
        form={form}
        setForm={setForm}
        onSave={saveEmployee}
        onClose={() => setForm(null)}
        isExisting={Boolean(list.some((item) => item.id === form?.id))}
        employeeVehicles={employeeVehicles as Vehicle[]}
      />

      {/* MODAL: Payroll Edit / Add */}
      <PayrollModal
        payrollModal={payrollModal}
        onClose={() => setPayrollModal(null)}
        employeesList={list}
        onDelete={handleDeletePayroll}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const basicSalary = Number(fd.get("basicSalary") || 0);
          const allowances = Number(fd.get("allowances") || 0);
          const deductions = Number(fd.get("deductions") || 0);
          const netSalary = basicSalary + allowances - deductions;
          const status = fd.get("status") as "مسودة" | "معتمد" | "تم الصرف";
          const notes = (fd.get("notes") as string) || "";

          if (payrollModal === "new") {
            const empId = Number(fd.get("employeeId"));
            const emp = list.find((item) => item.id === empId);
            if (!emp) {
              toast.error("اختر الموظف");
              return;
            }
            createPayroll.mutate(
              {
                employeeId: emp.id,
                employeeName: emp.name,
                month: payrollMonth,
                basicSalary,
                allowances,
                deductions,
                netSalary,
                status,
                notes,
              },
              {
                onSuccess: () => {
                  utils.payroll.list.invalidate();
                  setPayrollModal(null);
                  toast.success("تمت إضافة مسير الراتب");
                },
                onError: (err) => toast.error(err.message),
              }
            );
          } else if (payrollModal) {
            updatePayroll.mutate(
              {
                id: payrollModal.id,
                data: {
                  basicSalary,
                  allowances,
                  deductions,
                  netSalary,
                  status,
                  notes,
                },
              },
              {
                onSuccess: () => {
                  utils.payroll.list.invalidate();
                  setPayrollModal(null);
                  toast.success("تم تحديث مسير الراتب");
                },
                onError: (err) => toast.error(err.message),
              }
            );
          }
        }}
      />

      {/* MODAL: Leave Request */}
      <LeaveModal
        isOpen={Boolean(leaveModal)}
        onClose={() => setLeaveModal(null)}
        employeesList={list}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const employeeId = Number(fd.get("employeeId"));
          const emp = list.find((item) => item.id === employeeId);
          if (!emp) {
            toast.error("اختر الموظف");
            return;
          }
          const type = fd.get("type") as
            | "سنوية"
            | "مرضية"
            | "طارئة"
            | "بدون راتب";
          const startDate = fd.get("startDate") as string;
          const endDate = fd.get("endDate") as string;
          const days = Number(fd.get("days") || 1);
          const reason = (fd.get("reason") as string) || "—";

          createLeave.mutate(
            {
              employeeId: emp.id,
              employeeName: emp.name,
              type,
              startDate,
              endDate,
              days,
              reason,
              status: "قيد المراجعة",
            },
            {
              onSuccess: () => {
                utils.leaves.list.invalidate();
                setLeaveModal(null);
                toast.success("تم تقديم طلب الإجازة بنجاح");
              },
              onError: (err) => toast.error(err.message),
            }
          );
        }}
      />

      {/* MODAL: Import Employees */}
      {importOpen && (
        <ImportModal
          config={{
            label: "الموظفين",
            sampleFilename: "نموذج_استيراد_الموظفين.csv",
            columns: [
              {
                key: "name",
                header: "الاسم الكامل",
                required: true,
                hint: "محمد علي السالم",
              },
              {
                key: "employeeNo",
                header: "رقم الموظف",
                required: false,
                hint: "EMP-2024-1001",
              },
              {
                key: "nationalId",
                header: "رقم الهوية / الإقامة",
                required: false,
                hint: "1234567890",
              },
              {
                key: "phone",
                header: "رقم الهاتف",
                required: false,
                hint: "0501234567",
              },
              {
                key: "department",
                header: "القسم",
                required: false,
                hint: "الإدارة",
              },
              {
                key: "jobTitle",
                header: "المسمى الوظيفي",
                required: false,
                hint: "محاسب",
              },
              {
                key: "hireDate",
                header: "تاريخ المباشرة",
                required: false,
                hint: "2024-01-01",
              },
              {
                key: "status",
                header: "الحالة",
                required: false,
                hint: "نشط",
              },
            ],
            mapRow: (raw) => ({
              name: raw["الاسم الكامل"]?.trim() || "",
              employeeNo:
                raw["رقم الموظف"]?.trim() ||
                `EMP-${new Date().getFullYear()}-${Math.floor(
                  1000 + Math.random() * 9000
                )}`,
              nationalId: raw["رقم الهوية / الإقامة"]?.trim() || "—",
              phone: raw["رقم الهاتف"]?.trim() || "—",
              email: "—",
              department: raw["القسم"]?.trim() || "الإدارة",
              jobTitle: raw["المسمى الوظيفي"]?.trim() || "موظف",
              hireDate: raw["تاريخ المباشرة"]?.trim() || formatCompanyDate(),
              status: raw["الحالة"]?.trim() || "نشط",
            }),
          }}
          onClose={() => setImportOpen(false)}
          onImport={async (rows) => {
            for (const row of rows) {
              await createEmployee.mutateAsync(row as any);
            }
            void utils.employees.list.invalidate();
          }}
        />
      )}
    </>
  );
}

export default EmployeesPage;
