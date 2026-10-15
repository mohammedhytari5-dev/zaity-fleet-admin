import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Menu,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Headphones,
  LogOut,
  CarFront,
  Wrench,
  FileText,
  LayoutDashboard,
  Truck,
  ShieldAlert,
  Package,
  ShoppingCart,
  FileCheck2,
  UserRound,
  UserCheck,
  UsersRound,
  CircleDollarSign,
  Scale,
  Receipt,
  ArrowUpLeft,
  Wallet,
  Activity,
  Settings2,
} from "lucide-react";
import { formatCompanyDate } from "@shared/date-utils";
import { filterQuickSearch, searchableRecordText } from "@/lib/quick-search";
import { notificationRecord, notificationTarget } from "@/lib/notification-target";
import { serializeCsv } from "@/lib/csv";
import type { MaintenanceStage } from "@shared/maintenance-domain";
import type { TaskRelatedEntityType } from "@shared/task-relations";
import type { WorkTask } from "@/lib/task-queue";

import type {
  ModuleKey,
  Row,
  Vehicle,
  Driver,
  Maintenance,
  Document,
  Client,
  Contract,
  Claim,
  PaymentRow,
  PayableRow,
  ProjectRow,
} from "@/fleet/types";
import { Logo, Badge, Modal } from "@/fleet/common";
import {
  DetailModal,
  RecordForm,
  AssignDriverModal,
  AssignVehicleModal,
  QuickActionModal,
  VehicleProfileModal,
} from "@/fleet/modals";

import { DashboardHome } from "@/fleet/DashboardHome";
import { VehiclesPage } from "@/fleet/VehiclesPage";
import { DriversPage } from "@/fleet/DriversPage";
import { ClientsPage } from "@/fleet/ClientsPage";
import { ProjectsPage } from "@/fleet/ProjectsPage";
import { EmployeesPage } from "@/fleet/EmployeesPage";
import { DocumentsPage } from "@/fleet/DocumentsPage";
import { FinancePage } from "@/fleet/FinancePage";
import { PayablesPage } from "@/fleet/PayablesPage";
import {
  MaintenancePage,
  MaintenanceDetailModal,
  DriverVehiclesModal,
} from "@/fleet/MaintenancePage";
import { AccidentsPage } from "@/fleet/AccidentsPage";
import { InventoryPage } from "@/fleet/InventoryPage";
import { ProcurementPage } from "@/fleet/ProcurementPage";
import AccountingPage from "@/pages/AccountingPage";
import InvoicesPage from "@/pages/InvoicesPage";
import { ReportsPage } from "@/fleet/ReportsPage";
import { SettingsPage } from "@/fleet/SettingsPage";
import { SelfServicePortalPage } from "@/fleet/SelfServicePortalPage";
import { CustodyPage } from "@/fleet/CustodyPage";

export { AccidentsPage, InventoryPage };

function moduleForLocation(location: string): ModuleKey {
  const path = location.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/dashboard") return "dashboard";
  if (path.startsWith("/dashboard/financial/")) return "finance";
  if (path.startsWith("/dashboard/accounting")) return "accounting";
  if (path.startsWith("/dashboard/invoices")) return "invoices";
  if (path.startsWith("/dashboard/custody")) return "custody";
  if (path.startsWith("/dashboard/self-service")) return "self_service";
  const segment = path.slice("/dashboard/".length).split("/")[0];
  return (
    [
      "vehicles",
      "projects",
      "maintenance",
      "accidents",
      "inventory",
      "procurement",
      "accounting",
      "invoices",
      "documents",
      "drivers",
      "employees",
      "clients",
      "finance",
      "payables",
      "reports",
      "settings",
      "self_service",
    ] as const
  ).includes(segment as any)
    ? (segment as ModuleKey)
    : "dashboard";
}

const navGroups: {
  label: string;
  items: { key: ModuleKey; label: string; icon: any; count?: string }[];
}[] = [
  {
    label: "نظرة عامة",
    items: [{ key: "dashboard", label: "الإحصائيات", icon: LayoutDashboard }],
  },
  {
    label: "التشغيل",
    items: [
      { key: "vehicles", label: "المركبات", icon: CarFront },
      { key: "projects", label: "المشاريع", icon: Truck },
      { key: "maintenance", label: "الصيانة", icon: Wrench },
      { key: "accidents", label: "الحوادث", icon: ShieldAlert },
      { key: "inventory", label: "المخزون وقطع الغيار", icon: Package },
      {
        key: "procurement",
        label: "المشتريات وعروض الأسعار",
        icon: ShoppingCart,
      },
      { key: "documents", label: "المستندات", icon: FileCheck2 },
      { key: "employees", label: "الموارد البشرية (HR)", icon: UsersRound },
      { key: "clients", label: "العملاء", icon: UsersRound },
    ],
  },
  {
    label: "المالية",
    items: [
      { key: "finance", label: "المالية", icon: CircleDollarSign },
      { key: "accounting", label: "المحاسبة ودفتر الأستاذ", icon: Scale },
      { key: "invoices", label: "الفوترة والضريبة (ZATCA)", icon: Receipt },
      { key: "payables", label: "المستحقات علينا", icon: ArrowUpLeft },
      { key: "custody", label: "إدارة العهد والبطاقات", icon: Wallet },
    ],
  },
  {
    label: "الإدارة",
    items: [{ key: "reports", label: "التقارير", icon: Activity }],
  },
  {
    label: "النظام",
    items: [{ key: "settings", label: "الإعدادات", icon: Settings2 }],
  },
  {
    label: "الخدمة الذاتية",
    items: [
      {
        key: "self_service",
        label: "بوابة الخدمة الذاتية",
        icon: UserCheck,
      },
    ],
  },
];

export default function FleetDashboard() {
  const { user, loading: authLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const userPermissions = new Set(
    user?.role === "admin"
      ? [
          "dashboard",
          "vehicles",
          "projects",
          "maintenance",
          "accidents",
          "inventory",
          "procurement",
          "accounting",
          "invoices",
          "documents",
          "drivers",
          "employees",
          "clients",
          "finance",
          "payables",
          "reports",
          "settings",
        ]
      : (() => {
          try {
            return JSON.parse(user?.permissions || "[]") as string[];
          } catch {
            return [];
          }
        })()
  );

  const canAccess = (key: ModuleKey) => {
    if (user?.role === "admin") return true;
    if (key === "accounting" || key === "invoices" || key === "custody") {
      return userPermissions.has("finance") || userPermissions.has(key);
    }
    if (key === "procurement") {
      return userPermissions.has("finance") || userPermissions.has("procurement");
    }
    if (key === "self_service") {
      return (
        userPermissions.has("self_service_hr") ||
        userPermissions.has("self_service_driver") ||
        userPermissions.has("self_service")
      );
    }
    return userPermissions.has(key);
  };

  const vehicleQuery = trpc.vehicles.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("vehicles"),
  });
  const driverQuery = trpc.drivers.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("drivers"),
  });
  const maintenanceQuery = trpc.maintenance.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("maintenance"),
  });
  const documentQuery = trpc.documents.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("documents"),
  });
  const clientQuery = trpc.clients.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("clients"),
  });
  const claimQuery = trpc.claims.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("finance"),
  });
  const contractsQuery = trpc.contracts.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("finance"),
  });
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("projects"),
  });
  const employeesSearchQuery = trpc.employees.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user) && canAccess("employees"),
  });
  const payablesQuery = trpc.payables.list.useQuery(undefined, {
    staleTime: 15000,
    enabled: Boolean(user) && canAccess("payables"),
  });
  const paymentsQuery = trpc.payments.list.useQuery(undefined, {
    staleTime: 15000,
    enabled: Boolean(user) && canAccess("finance"),
  });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, {
    staleTime: 15000,
    enabled: Boolean(user) && canAccess("dashboard"),
  });
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, {
    staleTime: 15000,
    enabled: Boolean(user) && canAccess("dashboard"),
  });
  const taskAssigneesQuery = trpc.tasks.assignees.useQuery(undefined, {
    enabled: user?.role === "admin",
    staleTime: 30000,
  });
  const visibleNotifications = canAccess("dashboard")
    ? notificationsQuery.data ?? []
    : [];
  const notificationRead = trpc.notifications.markRead.useMutation();
  const settingsQuery = trpc.settingsCatalog.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: Boolean(user),
  });
  const auditQuery = trpc.audit.list.useQuery(undefined, {
    staleTime: 30000,
    enabled: user?.role === "admin",
  });

  const failedWorkspaceSources = [
    { label: "المركبات", query: vehicleQuery, enabled: canAccess("vehicles") },
    { label: "السائقون", query: driverQuery, enabled: canAccess("drivers") },
    { label: "الصيانة", query: maintenanceQuery, enabled: canAccess("maintenance") },
    { label: "المستندات", query: documentQuery, enabled: canAccess("documents") },
    { label: "العملاء", query: clientQuery, enabled: canAccess("clients") },
    { label: "المطالبات", query: claimQuery, enabled: canAccess("finance") },
    { label: "العقود", query: contractsQuery, enabled: canAccess("finance") },
    { label: "الدفعات", query: paymentsQuery, enabled: canAccess("finance") },
    { label: "المشاريع", query: projectsQuery, enabled: canAccess("projects") },
    { label: "الموظفون", query: employeesSearchQuery, enabled: canAccess("employees") },
    { label: "المستحقات علينا", query: payablesQuery, enabled: canAccess("payables") },
    { label: "المهام", query: tasksQuery, enabled: canAccess("dashboard") },
    { label: "الإشعارات", query: notificationsQuery, enabled: canAccess("dashboard") },
    { label: "القوائم المرجعية", query: settingsQuery, enabled: canAccess("settings") },
    { label: "سجل النشاط", query: auditQuery, enabled: user?.role === "admin" },
    { label: "مكلفو المهام", query: taskAssigneesQuery, enabled: user?.role === "admin" },
  ].filter((source) => source.enabled && source.query.isError);

  const hasWorkspaceQueryError = failedWorkspaceSources.length > 0;
  const retryFailedWorkspaceSources = () =>
    Promise.all(failedWorkspaceSources.map((source) => source.query.refetch()));

  const isWorkspaceQueryLoading = [
    canAccess("vehicles") && vehicleQuery.isLoading,
    canAccess("drivers") && driverQuery.isLoading,
    canAccess("maintenance") && maintenanceQuery.isLoading,
    canAccess("documents") && documentQuery.isLoading,
    canAccess("clients") && clientQuery.isLoading,
    canAccess("finance") &&
      (claimQuery.isLoading || contractsQuery.isLoading || paymentsQuery.isLoading),
    canAccess("projects") && projectsQuery.isLoading,
    canAccess("employees") && employeesSearchQuery.isLoading,
    canAccess("payables") && payablesQuery.isLoading,
    canAccess("dashboard") && (tasksQuery.isLoading || notificationsQuery.isLoading),
    canAccess("settings") && settingsQuery.isLoading,
    user?.role === "admin" && auditQuery.isLoading,
  ].some(Boolean);

  const workspaceStatus = authLoading
    ? "جارٍ التحقق من الحساب"
    : !user
    ? "غير متصل"
    : hasWorkspaceQueryError
    ? "تعذر تحميل بعض البيانات"
    : isWorkspaceQueryLoading
    ? "جارٍ تحميل البيانات"
    : "تم تحميل بيانات النظام";
  const workspaceStatusTone =
    (!user && !authLoading) || hasWorkspaceQueryError
      ? "offline"
      : isWorkspaceQueryLoading || authLoading
      ? "syncing"
      : "";

  const vehicleCreate = trpc.vehicles.create.useMutation();
  const vehicleUpdate = trpc.vehicles.update.useMutation();
  const vehicleAssign = trpc.vehicles.assignDriver.useMutation();
  const vehicleArchive = trpc.vehicles.archive.useMutation();
  const driverCreate = trpc.drivers.create.useMutation();
  const driverUpdate = trpc.drivers.update.useMutation();
  const driverArchive = trpc.drivers.archive.useMutation();
  const maintenanceCreate = trpc.maintenance.create.useMutation();
  const maintenanceUpdate = trpc.maintenance.update.useMutation();
  const maintenanceAdvance = trpc.maintenance.advance.useMutation();
  const maintenanceDecideApproval = trpc.maintenance.decideApproval.useMutation();
  const maintenanceSettleAdvance = trpc.maintenance.settleAdvance.useMutation();
  const maintenanceArchive = trpc.maintenance.archive.useMutation();
  const documentCreate = trpc.documents.create.useMutation();
  const documentUpdate = trpc.documents.update.useMutation();
  const documentArchive = trpc.documents.archive.useMutation();
  const clientCreate = trpc.clients.create.useMutation();
  const clientUpdate = trpc.clients.update.useMutation();
  const clientArchive = trpc.clients.archive.useMutation();
  const representativeCreate = trpc.representatives.create.useMutation();
  const claimCreate = trpc.claims.create.useMutation();
  const claimUpdate = trpc.claims.update.useMutation();
  const claimArchive = trpc.claims.archive.useMutation();
  const contractCreate = trpc.contracts.create.useMutation();
  const taskUpdate = trpc.tasks.update.useMutation();
  const taskCreate = trpc.tasks.create.useMutation();
  const paymentCreate = trpc.payments.create.useMutation();
  const paymentUpdate = trpc.payments.update.useMutation();
  const paymentArchive = trpc.payments.archive.useMutation();
  const contractUpdate = trpc.contracts.update.useMutation();
  const contractStatusUpdate = trpc.contracts.updateStatus.useMutation();
  const contractArchive = trpc.contracts.archive.useMutation();

  const [active, setActive] = useState<ModuleKey>(() =>
    moduleForLocation(window.location.pathname)
  );
  useEffect(() => setActive(moduleForLocation(location)), [location]);
  useEffect(() => {
    if (!user || canAccess(active)) return;
    const fallback =
      navGroups
        .flatMap((group) => group.items)
        .find((item) => canAccess(item.key))?.key ?? "dashboard";
    setActive(fallback);
    navigate(
      fallback === "dashboard"
        ? "/dashboard"
        : fallback === "self_service"
        ? "/dashboard/self-service"
        : `/dashboard/${fallback === "finance" ? "financial/contracts" : fallback}`
    );
  }, [active, user?.id, user?.role, user?.permissions]);

  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandActiveIndex, setCommandActiveIndex] = useState(0);
  const [modal, setModal] = useState<{ module: ModuleKey; row?: Row } | null>(null);
  const [detail, setDetail] = useState<{ module: ModuleKey; row: Row } | null>(null);
  const [maintenanceDetail, setMaintenanceDetail] = useState<Maintenance | null>(
    null
  );
  const [vehicleProfile, setVehicleProfile] = useState<Vehicle | null>(null);
  const [driverDetail, setDriverDetail] = useState<Driver | null>(null);
  const [assignmentVehicle, setAssignmentVehicle] = useState<Vehicle | null>(null);
  const [assignmentDriver, setAssignmentDriver] = useState<Driver | null>(null);
  const [quickAction, setQuickAction] = useState<{
    action: string;
    row: Row;
  } | null>(null);
  const [prefillMaintenanceRequest, setPrefillMaintenanceRequest] =
    useState<Maintenance | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    setVehicles(canAccess("vehicles") ? (vehicleQuery.data as Vehicle[]) ?? [] : []);
  }, [vehicleQuery.data, user?.permissions, user?.role]);
  useEffect(() => {
    setDrivers(canAccess("drivers") ? (driverQuery.data as Driver[]) ?? [] : []);
  }, [driverQuery.data, user?.permissions, user?.role]);
  useEffect(() => {
    setMaintenance(
      canAccess("maintenance")
        ? (maintenanceQuery.data as unknown as Maintenance[]) ?? []
        : []
    );
  }, [maintenanceQuery.data, user?.permissions, user?.role]);
  useEffect(() => {
    setDocuments(
      canAccess("documents") ? (documentQuery.data as Document[]) ?? [] : []
    );
  }, [documentQuery.data, user?.permissions, user?.role]);
  useEffect(() => {
    setClients(canAccess("clients") ? (clientQuery.data as Client[]) ?? [] : []);
  }, [clientQuery.data, user?.permissions, user?.role]);
  useEffect(() => {
    setClaims(canAccess("finance") ? (claimQuery.data as Claim[]) ?? [] : []);
  }, [claimQuery.data, user?.permissions, user?.role]);
  useEffect(() => {
    setContracts(
      canAccess("finance") ? (contractsQuery.data as Contract[]) ?? [] : []
    );
  }, [contractsQuery.data, user?.permissions, user?.role]);

  const accessFingerprint = `${user?.id ?? ""}:${user?.role ?? ""}:${
    user?.permissions ?? ""
  }`;
  const previousAccessFingerprint = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (previousAccessFingerprint.current === null) {
      previousAccessFingerprint.current = accessFingerprint;
      return;
    }
    if (previousAccessFingerprint.current === accessFingerprint) return;
    previousAccessFingerprint.current = accessFingerprint;
    setModal(null);
    setDetail(null);
    setMaintenanceDetail(null);
    setVehicleProfile(null);
    setDriverDetail(null);
    setAssignmentVehicle(null);
    setAssignmentDriver(null);
    setQuickAction(null);
    setCommandOpen(false);
    setCommandQuery("");
    setVehicles([]);
    setDrivers([]);
    setMaintenance([]);
    setDocuments([]);
    setClients([]);
    setClaims([]);
    setContracts([]);
    void utils.vehicles.list.reset();
    void utils.vehicles.financeProfile.reset();
    void utils.drivers.list.reset();
    void utils.maintenance.list.reset();
    void utils.documents.list.reset();
    void utils.clients.list.reset();
    void utils.claims.list.reset();
    void utils.contracts.list.reset();
    void utils.payments.list.reset();
    void utils.projects.list.reset();
    void utils.employees.list.reset();
    void utils.payables.list.reset();
    void utils.tasks.list.reset();
    void utils.notifications.list.reset();
    void utils.reports.summary.reset();
  }, [accessFingerprint]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        setCommandQuery("");
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onNavigate = (key: ModuleKey) => {
    if (!canAccess(key)) {
      toast.error("ليس لديك صلاحية الوصول إلى هذا القسم");
      return;
    }
    setActive(key);
    setMobileOpen(false);
    navigate(
      key === "dashboard"
        ? "/dashboard"
        : key === "self_service"
        ? "/dashboard/self-service"
        : `/dashboard/${key === "finance" ? "financial/contracts" : key}`
    );
  };

  const openNotificationRecord = (notification: {
    id: number;
    entityType?: string | null;
    entityId?: number | null;
  }) => {
    const { target, record } = notificationRecord(notification, {
      vehicles: canAccess("vehicles") ? vehicles : [],
      drivers: canAccess("drivers") ? drivers : [],
      employees: canAccess("employees")
        ? ((employeesSearchQuery.data ?? []) as Row[])
        : [],
      clients: canAccess("clients") ? clients : [],
      projects: canAccess("projects")
        ? ((projectsQuery.data ?? []) as Row[])
        : [],
      maintenance: canAccess("maintenance") ? maintenance : [],
      documents: canAccess("documents") ? documents : [],
      finance: canAccess("finance") ? [...contracts, ...claims] : [],
      payables: canAccess("payables")
        ? ((payablesQuery.data ?? []) as Row[])
        : [],
    });
    setNotificationCenterOpen(false);
    onNavigate(target);
    notificationRead.mutate(
      { id: notification.id },
      { onSuccess: () => utils.notifications.list.invalidate() }
    );
    if (!record) {
      if (notification.entityId)
        toast.info("فتح القسم؛ تعذر العثور على السجل المرتبط ضمن البيانات المحمّلة");
      return;
    }
    if (target === "vehicles") setVehicleProfile(record as Vehicle);
    else if (target === "drivers") setDriverDetail(record as Driver);
    else if (target === "maintenance") setMaintenanceDetail(record as Maintenance);
    else setDetail({ module: target, row: record });
  };

  const quickSearchSources = useMemo(
    () => [
      ...(canAccess("vehicles")
        ? (vehicleQuery.data ?? []).map((row: any) => ({
            module: "vehicles" as ModuleKey,
            label: row.plate,
            description: `${row.brand} ${row.model} · ${row.status}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("drivers")
        ? (driverQuery.data ?? []).map((row: any) => ({
            module: "drivers" as ModuleKey,
            label: row.name,
            description: `سائق · ${row.phone} · ${row.status}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("clients")
        ? (clientQuery.data ?? []).map((row: any) => ({
            module: "clients" as ModuleKey,
            label: row.name,
            description: `عميل · ${row.phone}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("maintenance")
        ? (maintenanceQuery.data ?? []).map((row: any) => ({
            module: "maintenance" as ModuleKey,
            label: row.ref,
            description: `صيانة · ${row.vehicle} · ${row.type} · ${
              row.workflowStage || row.status
            }`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("documents")
        ? (documentQuery.data ?? []).map((row: any) => ({
            module: "documents" as ModuleKey,
            label: row.name,
            description: `مستند ${row.entityType || row.type} · ${
              row.entity || row.owner
            }`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("finance")
        ? (contractsQuery.data ?? []).map((row: any) => ({
            module: "finance" as ModuleKey,
            label: row.ref,
            description: `عقد · ${row.client} · ${row.status}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("finance")
        ? (claimQuery.data ?? []).map((row: any) => ({
            module: "finance" as ModuleKey,
            label: row.ref,
            description: `مطالبة · ${row.client} · ${row.status}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("finance")
        ? (paymentsQuery.data ?? []).map((row: any) => ({
            module: "finance" as ModuleKey,
            label: `دفعة ${row.reference || row.id}`,
            description: `تحصيل · ${row.amount} SAR · ${row.paidAt} · ${
              row.method
            } · ${
              row.contractId
                ? `عقد #${row.contractId}`
                : row.claimId
                ? `مطالبة #${row.claimId}`
                : "غير مرتبطة"
            }`,
            row: { ...row, recordType: "payment" } as Row,
          }))
        : []),
      ...(canAccess("projects")
        ? (projectsQuery.data ?? []).map((row: any) => ({
            module: "projects" as ModuleKey,
            label: row.name,
            description: `مشروع ${row.ref} · ${row.client} · ${row.status}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("employees")
        ? (employeesSearchQuery.data ?? []).map((row: any) => ({
            module: "employees" as ModuleKey,
            label: row.name,
            description: `موظف ${row.employeeNo} · ${row.department}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("payables")
        ? (payablesQuery.data ?? []).map((row: any) => ({
            module: "payables" as ModuleKey,
            label: row.ref,
            description: `فاتورة مورد · ${row.supplier} · ${row.status}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("dashboard")
        ? (tasksQuery.data ?? []).map((row: any) => ({
            module: "dashboard" as ModuleKey,
            label: row.title,
            description: `مهمة · ${row.assignee} · ${row.status} · ${row.dueAt}`,
            row: row as Row,
          }))
        : []),
      ...(canAccess("dashboard")
        ? (notificationsQuery.data ?? []).map((row: any) => ({
            module: "dashboard" as ModuleKey,
            label: row.title,
            description: `تنبيه · ${row.severity} · ${row.message}`,
            row: row as Row,
          }))
        : []),
    ],
    [
      vehicleQuery.data,
      driverQuery.data,
      clientQuery.data,
      maintenanceQuery.data,
      documentQuery.data,
      contractsQuery.data,
      claimQuery.data,
      paymentsQuery.data,
      projectsQuery.data,
      employeesSearchQuery.data,
      payablesQuery.data,
      tasksQuery.data,
      notificationsQuery.data,
      user?.id,
      user?.permissions,
      user?.role,
    ]
  );

  const quickSearchResults = useMemo(
    () =>
      filterQuickSearch(
        quickSearchSources,
        commandQuery,
        (item) => `${item.label} ${item.description} ${searchableRecordText(item.row)}`,
        40
      ),
    [quickSearchSources, commandQuery]
  );

  const quickSearchLoading = [
    canAccess("vehicles") && vehicleQuery.isLoading,
    canAccess("drivers") && driverQuery.isLoading,
    canAccess("clients") && clientQuery.isLoading,
    canAccess("maintenance") && maintenanceQuery.isLoading,
    canAccess("documents") && documentQuery.isLoading,
    canAccess("finance") && (contractsQuery.isLoading || claimQuery.isLoading),
    canAccess("projects") && projectsQuery.isLoading,
    canAccess("employees") && employeesSearchQuery.isLoading,
    canAccess("payables") && payablesQuery.isLoading,
    canAccess("dashboard") && (tasksQuery.isLoading || notificationsQuery.isLoading),
  ].some(Boolean);

  const quickSearchHasError = [
    canAccess("vehicles") && vehicleQuery.isError,
    canAccess("drivers") && driverQuery.isError,
    canAccess("clients") && clientQuery.isError,
    canAccess("maintenance") && maintenanceQuery.isError,
    canAccess("documents") && documentQuery.isError,
    canAccess("finance") &&
      (contractsQuery.isError || claimQuery.isError || paymentsQuery.isError),
    canAccess("projects") && projectsQuery.isError,
    canAccess("employees") && employeesSearchQuery.isError,
    canAccess("payables") && payablesQuery.isError,
    canAccess("dashboard") && (tasksQuery.isError || notificationsQuery.isError),
  ].some(Boolean);

  const openQuickSearchResult = (result: (typeof quickSearchSources)[number]) => {
    setCommandOpen(false);
    setCommandQuery("");
    if (result.module === "payables") {
      setActive("payables");
      setMobileOpen(false);
      navigate(
        `/dashboard/payables?payable=${encodeURIComponent(String(result.row.id))}`
      );
      return;
    }
    if (result.module === "finance" && result.row.recordType === "payment") {
      setActive("finance");
      setMobileOpen(false);
      navigate(
        `/dashboard/financial/payments?payment=${encodeURIComponent(
          String(result.row.reference || result.row.id)
        )}`
      );
      return;
    }
    onNavigate(result.module);
    if (result.module === "vehicles") setVehicleProfile(result.row as Vehicle);
    else if (result.module === "drivers") setDriverDetail(result.row as Driver);
    else if (result.module === "maintenance")
      setMaintenanceDetail(result.row as Maintenance);
    else setDetail({ module: result.module, row: result.row });
  };

  const quickSearchResultItems = quickSearchResults.map((result, index) => {
    const ItemIcon =
      navGroups.flatMap((group) => group.items).find((item) => item.key === result.module)
        ?.icon ?? Search;
    return (
      <button
        key={`${result.module}-${result.row.id}-${index}`}
        id={`quick-search-result-${index}`}
        role="option"
        aria-selected={index === commandActiveIndex}
        onMouseEnter={() => setCommandActiveIndex(index)}
        onClick={() => openQuickSearchResult(result)}
      >
        <ItemIcon size={16} />
        <span>
          <strong>{result.label}</strong>
          <small>{result.description}</small>
        </span>
        <kbd>فتح</kbd>
      </button>
    );
  });

  const quickSearchEmptyState = quickSearchLoading ? (
    <div className="empty-state" role="status" style={{ padding: "1rem" }}>
      جارٍ تحميل السجلات المسموح بها…
    </div>
  ) : quickSearchHasError ? (
    <div className="empty-state" role="status" style={{ padding: "1rem" }}>
      تعذر تحميل بعض الأقسام. تحقق من الاتصال أو أعد فتح البحث.
    </div>
  ) : (
    <div className="empty-state" role="status" style={{ padding: "1rem" }}>
      لا توجد سجلات تطابق البحث ضمن صلاحياتك.
    </div>
  );

  const quickSearchResultsContent = (
    <>
      {quickSearchLoading && (
        <div className="field-note" role="status">
          جارٍ تحميل نتائج بقية الأقسام…
        </div>
      )}
      {quickSearchHasError && !quickSearchLoading && (
        <div className="field-note" role="status">
          بعض الأقسام لم تُحمّل؛ النتائج المعروضة قد تكون غير مكتملة.
        </div>
      )}
      {quickSearchResultItems}
    </>
  );

  useEffect(() => {
    setCommandActiveIndex((index) =>
      Math.min(index, Math.max(0, quickSearchResults.length - 1))
    );
  }, [quickSearchResults.length]);

  useEffect(() => {
    if (!commandOpen || !commandQuery.trim() || !quickSearchResults.length) return;
    document
      .getElementById(`quick-search-result-${commandActiveIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [commandOpen, commandQuery, commandActiveIndex, quickSearchResults.length]);

  const onAction = (action: string, row: Row) => {
    if (action === "view" && active === "vehicles") setVehicleProfile(row as Vehicle);
    else if (action === "view" && active === "maintenance")
      setMaintenanceDetail(row as Maintenance);
    else if (action === "view") setDetail({ module: active, row });
    else if (action === "edit") setModal({ module: active, row });
    else if (action === "assign" && active === "vehicles")
      setAssignmentVehicle(row as Vehicle);
    else if (action === "assign" && active === "drivers")
      setAssignmentDriver(row as Driver);
    else if (action === "archive") {
      toast("هل تريد أرشفة هذا السجل؟", {
        action: {
          label: "تأكيد",
          onClick: () => {
            if (active === "vehicles")
              vehicleArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setVehicles((prev) => prev.filter((v) => v.id !== row.id));
                    utils.vehicles.list.invalidate();
                    toast.success("تمت الأرشفة بنجاح");
                  },
                }
              );
            else if (active === "drivers")
              driverArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setDrivers((prev) => prev.filter((item) => item.id !== row.id));
                    utils.drivers.list.invalidate();
                    toast.success("تمت الأرشفة بنجاح");
                  },
                  onError: (error) =>
                    toast.error(`تعذر أرشفة السائق: ${error.message}`),
                }
              );
            else if (active === "maintenance")
              maintenanceArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setMaintenance((prev) =>
                      prev.filter((item) => item.id !== row.id)
                    );
                    utils.maintenance.list.invalidate();
                    toast.success("تمت الأرشفة بنجاح");
                  },
                  onError: (error) =>
                    toast.error(`تعذر أرشفة طلب الصيانة: ${error.message}`),
                }
              );
            else if (active === "documents")
              documentArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setDocuments((prev) =>
                      prev.filter((item) => item.id !== row.id)
                    );
                    utils.documents.list.invalidate();
                    toast.success("تمت الأرشفة بنجاح");
                  },
                  onError: (error) =>
                    toast.error(`تعذر أرشفة المستند: ${error.message}`),
                }
              );
            else if (active === "clients")
              clientArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setClients((prev) => prev.filter((item) => item.id !== row.id));
                    utils.clients.list.invalidate();
                    toast.success("تمت الأرشفة بنجاح");
                  },
                  onError: (error) =>
                    toast.error(`تعذر أرشفة العميل: ${error.message}`),
                }
              );
            else if (active === "finance" && String(row.ref || "").startsWith("CL-"))
              claimArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setClaims((prev) => prev.filter((item) => item.id !== row.id));
                    utils.claims.list.invalidate();
                    toast.success("تمت أرشفة المطالبة بنجاح");
                  },
                  onError: (error) =>
                    toast.error(`تعذر أرشفة المطالبة: ${error.message}`),
                }
              );
            else if (active === "finance")
              contractArchive.mutate(
                { id: row.id },
                {
                  onSuccess: () => {
                    setContracts((prev) =>
                      prev.filter((item) => item.id !== row.id)
                    );
                    utils.contracts.list.invalidate();
                    toast.success("تمت أرشفة العقد بنجاح");
                  },
                  onError: (error) =>
                    toast.error(`تعذر أرشفة العقد: ${error.message}`),
                }
              );
          },
        },
        cancel: { label: "إلغاء", onClick: () => {} },
      });
    } else if (action === "maintenance") {
      setActive("maintenance");
      setModal({
        module: "maintenance",
        row: {
          id: Date.now(),
          ref: `MT-${Date.now()}`,
          vehicle: row.plate,
          vehicleId: row.id,
          type: "صيانة دورية",
          manager: "—",
          start: formatCompanyDate(),
          due: "",
          status: "جديد",
          cost: "0 SAR",
        },
      });
      navigate("/dashboard/maintenance");
    } else if (
      ["item", "cost", "status", "extend", "stage", "approval"].includes(action)
    )
      setQuickAction({ action, row });
    else if (action === "download") {
      if (active === "documents" && (row.hasFile || row.fileUrl)) {
        void (async () => {
          try {
            const attachment = row.fileUrl
              ? { name: row.fileName || row.name, url: row.fileUrl }
              : await utils.documents.file.fetch({ id: row.id });
            if (!attachment?.url) throw new Error("لم يتم العثور على ملف المستند");
            const link = document.createElement("a");
            link.href = attachment.url;
            link.download = attachment.name || String(row.name || "document");
            link.click();
          } catch (error: any) {
            toast.error(error.message || "تعذر تنزيل المستند");
          }
        })();
      } else {
        const entries = Object.entries(row).filter(([key]) => key !== "id");
        const csv = serializeCsv(
          ["الحقل", "القيمة"],
          entries.map(([key, value]) => [key, value])
        );
        const blob = new Blob(["\ufeffsep=,\r\n" + csv], {
          type: "text/csv;charset=utf-8",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${row.name || row.ref || row.plate || "record"}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success("تم تنزيل السجل");
      }
    } else if (["contracts", "claims", "new-contract"].includes(action)) {
      onNavigate("finance");
      if (action === "new-contract") setModal({ module: "finance" });
    } else toast.info("هذا الإجراء يحتاج تحديد السجل أولًا");
  };

  const refreshAssignments = () => {
    utils.vehicles.list.invalidate();
    utils.drivers.list.invalidate();
  };

  const saveAssignment = (driver: Driver | null) => {
    if (!assignmentVehicle) return;
    const vehicleId = assignmentVehicle.id;
    vehicleAssign.mutate(
      { vehicleId, driverId: driver?.id ?? null },
      {
        onSuccess: (saved) => {
          setVehicles((prev) =>
            prev.map((item) =>
              item.id === saved.id ? ({ ...item, ...saved } as Vehicle) : item
            )
          );
          refreshAssignments();
          setAssignmentVehicle(null);
          toast.success(
            driver
              ? `تم إسناد ${driver.name} إلى ${assignmentVehicle.plate}`
              : "تم إلغاء إسناد السائق"
          );
        },
        onError: (error) => toast.error(`تعذر حفظ الإسناد: ${error.message}`),
      }
    );
  };

  const saveVehicleAssignment = (vehicle: Vehicle | null) => {
    if (!assignmentDriver) return;
    const previousVehicle = vehicles.find(
      (item) => item.plate === assignmentDriver.vehicle
    );
    const vehicleId = vehicle?.id ?? previousVehicle?.id;
    if (!vehicleId) {
      toast.error("لا توجد مركبة مرتبطة لإلغاء الإسناد");
      return;
    }
    vehicleAssign.mutate(
      { vehicleId, driverId: vehicle ? assignmentDriver.id : null },
      {
        onSuccess: () => {
          refreshAssignments();
          setAssignmentDriver(null);
          toast.success(
            vehicle
              ? `تم إسناد ${vehicle.plate} إلى ${assignmentDriver.name}`
              : "تم إلغاء إسناد المركبة"
          );
        },
        onError: (error) => toast.error(`تعذر حفظ الإسناد: ${error.message}`),
      }
    );
  };

  const saveRecord = (data: Row) => {
    if (modal?.module === "drivers") {
      const { id: _id, ...payload } = data;
      if (!canAccess("vehicles")) {
        delete payload.vehicleId;
        delete payload.vehicle;
      }
      const onSuccess = (saved: Row) => {
        setDrivers((prev) =>
          prev.some((item) => item.id === saved.id)
            ? prev.map((item) => (item.id === saved.id ? (saved as Driver) : item))
            : [saved as Driver, ...prev]
        );
        utils.drivers.list.invalidate();
        setModal(null);
        toast.success("تم حفظ السائق");
      };
      if (drivers.some((item) => item.id === data.id))
        driverUpdate.mutate(
          { id: data.id, data: payload as any },
          {
            onSuccess,
            onError: (error) => toast.error(`تعذر تعديل السائق: ${error.message}`),
          }
        );
      else
        driverCreate.mutate(payload as any, {
          onSuccess,
          onError: (error) => toast.error(`تعذر إضافة السائق: ${error.message}`),
        });
      return;
    }
    if (modal?.module === "vehicles" && !canAccess("finance")) {
      delete data.purchasePrice;
      delete data.purchaseDate;
      delete data.inServiceDate;
    }
    if (modal?.module === "clients") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => {
        setClients((prev) =>
          prev.some((item) => item.id === saved.id)
            ? prev.map((item) => (item.id === saved.id ? (saved as Client) : item))
            : [saved as Client, ...prev]
        );
        if (payload.contact && payload.phone && saved.id)
          representativeCreate.mutate({
            clientId: saved.id,
            name: String(payload.contact),
            phone: String(payload.phone),
          });
        utils.clients.list.invalidate();
        setModal(null);
        toast.success("تم حفظ العميل");
      };
      if (clients.some((item) => item.id === data.id))
        clientUpdate.mutate(
          { id: data.id, data: payload as any },
          {
            onSuccess,
            onError: (error) => toast.error(`تعذر تعديل العميل: ${error.message}`),
          }
        );
      else
        clientCreate.mutate(payload as any, {
          onSuccess,
          onError: (error) => toast.error(`تعذر إضافة العميل: ${error.message}`),
        });
      return;
    }
    if (modal?.module === "maintenance") {
      const { id: _id, ...payload } = data;
      const currentMaintenance = maintenance.find((item) => item.id === data.id);
      delete payload.status;
      delete payload.workflowStage;
      delete payload.approvalStatus;
      delete payload.cost;
      delete payload.laborCost;
      delete payload.partsCost;
      delete payload.receiptName;
      delete payload.receiptUrl;
      if (
        currentMaintenance &&
        currentMaintenance.approvalStatus !== "بانتظار الاعتماد"
      ) {
        delete payload.estimatedCost;
        delete payload.quotedPartsCost;
        delete payload.quoteName;
        delete payload.quoteUrl;
      }
      payload.ref = String(payload.ref || `MT-${Date.now()}`);
      const onSuccess = (saved: Row) => {
        setMaintenance((prev) =>
          prev.some((item) => item.id === saved.id)
            ? prev.map((item) =>
                item.id === saved.id ? (saved as Maintenance) : item
              )
            : [saved as Maintenance, ...prev]
        );
        utils.maintenance.list.invalidate();
        setModal(null);
        toast.success("تم حفظ طلب الصيانة");
      };
      if (maintenance.some((item) => item.id === data.id))
        maintenanceUpdate.mutate(
          { id: data.id, data: payload as any },
          {
            onSuccess,
            onError: (error) =>
              toast.error(`تعذر تعديل طلب الصيانة: ${error.message}`),
          }
        );
      else
        maintenanceCreate.mutate(payload as any, {
          onSuccess,
          onError: (error) =>
            toast.error(`تعذر إنشاء طلب الصيانة: ${error.message}`),
        });
      return;
    }
    if (modal?.module === "documents") {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => {
        setDocuments((prev) =>
          prev.some((item) => item.id === saved.id)
            ? prev.map((item) =>
                item.id === saved.id ? (saved as Document) : item
              )
            : [saved as Document, ...prev]
        );
        utils.documents.list.invalidate();
        setModal(null);
        toast.success("تم حفظ المستند");
      };
      if (documents.some((item) => item.id === data.id))
        documentUpdate.mutate(
          { id: data.id, data: payload as any },
          {
            onSuccess,
            onError: (error) =>
              toast.error(`تعذر تعديل المستند: ${error.message}`),
          }
        );
      else
        documentCreate.mutate(payload as any, {
          onSuccess,
          onError: (error) => toast.error(`تعذر حفظ المستند: ${error.message}`),
        });
      return;
    }
    if (modal?.module === "finance" && modal.row?.ref?.startsWith("CL-")) {
      const { id: _id, ...payload } = data;
      const onSuccess = (saved: Row) => {
        setClaims((prev) =>
          prev.some((item) => item.id === saved.id)
            ? prev.map((item) => (item.id === saved.id ? (saved as Claim) : item))
            : [saved as Claim, ...prev]
        );
        utils.claims.list.invalidate();
        setModal(null);
        toast.success("تم حفظ المطالبة");
      };
      const claimPayload = {
        ...payload,
        clientId:
          clients.find((item) => item.name === String(payload.client))?.id ?? null,
        contractId:
          contracts.find((item) => item.ref === String(payload.contract))?.id ?? null,
      } as any;
      if (claims.some((item) => item.id === data.id))
        claimUpdate.mutate(
          { id: data.id, data: claimPayload },
          {
            onSuccess,
            onError: (error) =>
              toast.error(`تعذر تعديل المطالبة: ${error.message}`),
          }
        );
      else
        claimCreate.mutate(claimPayload, {
          onSuccess,
          onError: (error) =>
            toast.error(`تعذر إنشاء المطالبة: ${error.message}`),
        });
      return;
    }
    if (modal?.module === "finance" && data.recordType === "payment") {
      const { id: _id, recordType: _recordType, ...payment } = data;
      const paymentPayload = {
        ...payment,
        amount: Number(payment.amount || 0),
        contractId: payment.contractId || null,
        claimId: payment.claimId || null,
        clientId: payment.clientId || null,
        paidAt: String(payment.paidAt),
        method: String(payment.method || "تحويل بنكي"),
        reference: String(payment.reference || "—"),
      } as any;
      const onPaymentSuccess = () => {
        utils.payments.list.invalidate();
        utils.contracts.list.invalidate();
        utils.claims.list.invalidate();
        setModal(null);
        toast.success(
          modal.row?.id ? "تم تعديل الدفعة المالية" : "تم تسجيل الدفعة المالية"
        );
      };
      if (
        modal.row?.id &&
        (paymentsQuery.data ?? []).some((item) => item.id === data.id)
      )
        paymentUpdate.mutate(
          { id: data.id, data: paymentPayload },
          {
            onSuccess: onPaymentSuccess,
            onError: (error) => toast.error(`تعذر تعديل الدفعة: ${error.message}`),
          }
        );
      else
        paymentCreate.mutate(paymentPayload, {
          onSuccess: onPaymentSuccess,
          onError: (error) => toast.error(`تعذر تسجيل الدفعة: ${error.message}`),
        });
      return;
    }
    if (modal?.module === "finance") {
      const { id: _id, ...contract } = data;
      if (modal.row) {
        const updatePayload: Record<string, unknown> = { ...contract };
        if (!canAccess("clients")) {
          delete updatePayload.client;
          delete updatePayload.clientId;
        }
        if (!canAccess("vehicles") || !canAccess("drivers"))
          delete updatePayload.items;
        else
          updatePayload.items = (contract.items as any[])?.length
            ? contract.items
            : undefined;
        contractUpdate.mutate(
          { id: data.id, data: updatePayload as any },
          {
            onSuccess: (saved) => {
              setContracts((prev) =>
                prev.map((item) =>
                  item.id === data.id ? ({ ...item, ...saved } as Contract) : item
                )
              );
              utils.contracts.list.invalidate();
              setModal(null);
              toast.success("تم حفظ تعديل العقد في قاعدة البيانات");
            },
            onError: (error) => toast.error(`تعذر تعديل العقد: ${error.message}`),
          }
        );
        return;
      }
      contractCreate.mutate(
        {
          ref: String(contract.ref),
          client: String(contract.client),
          clientId:
            clients.find((item) => item.name === String(contract.client))?.id ?? null,
          type: String(contract.type),
          startDate: String(contract.startDate || formatCompanyDate()),
          expiry: String(contract.expiry),
          total: Number(contract.total || 0),
          collected: Number(contract.collected || 0),
          status: (contract.status || "قائم") as
            | "قائم"
            | "مكتمل"
            | "عرض سعر"
            | "ملغي",
          items:
            canAccess("vehicles") &&
            canAccess("drivers") &&
            (contract.items as any[])?.length
              ? (contract.items as any[])
              : [
                  {
                    vehicleId: null,
                    vehiclePlate: "—",
                    quantity: 1,
                    driver: "—",
                    coverage: "مركبة وسائق",
                    description: "خدمة تشغيل",
                  },
                ],
        },
        {
          onSuccess: (saved) => {
            setContracts((prev) => [
              { ...saved, items: undefined } as Contract,
              ...prev,
            ]);
            utils.contracts.list.invalidate();
            setModal(null);
            toast.success("تم حفظ العقد في قاعدة البيانات");
          },
          onError: (error) => toast.error(`تعذر حفظ العقد: ${error.message}`),
        }
      );
      return;
    }
    if (modal?.module !== "vehicles") return;
    const payload = {
      plate: String(data.plate || "").trim(),
      brand: String(data.brand || "—"),
      model: String(data.model || "").trim(),
      year: String(data.year || ""),
      color: String(data.color || "—"),
      mileage: String(data.mileage || "0 كم"),
      ...(canAccess("finance")
        ? {
            purchasePrice: Math.max(
              0,
              Math.trunc(Number(data.purchasePrice ?? 0))
            ),
            purchaseDate: String(data.purchaseDate || "—"),
            inServiceDate: String(data.inServiceDate || "—"),
          }
        : {}),
      ...(canAccess("projects")
        ? {
            projectId: data.projectId ? Number(data.projectId) : null,
            project: String(data.project || "—"),
          }
        : {}),
      ...(canAccess("drivers")
        ? {
            driver: String(data.driver || "—"),
            driverId: data.driverId ? Number(data.driverId) : null,
          }
        : {}),
      ...(canAccess("employees")
        ? {
            employee: String(data.employee || "—"),
            employeeId: data.employeeId ? Number(data.employeeId) : null,
          }
        : {}),
      status: data.status as any,
      ...(canAccess("clients")
        ? {
            client: String(data.client || "—"),
            clientId: data.clientId ? Number(data.clientId) : null,
          }
        : {}),
      ...(canAccess("finance")
        ? {
            contract: String(data.contract || "—"),
            contractId: data.contractId ? Number(data.contractId) : null,
          }
        : {}),
      notes: data.notes ? String(data.notes) : undefined,
    };
    const onSuccess = (saved: Row) => {
      setVehicles((prev) =>
        prev.some((v) => v.id === saved.id)
          ? prev.map((v) => (v.id === saved.id ? (saved as Vehicle) : v))
          : [saved as Vehicle, ...prev]
      );
      utils.vehicles.list.invalidate();
      setModal(null);
      toast.success("تم حفظ المركبة");
    };
    const onError = (error: { message: string }) =>
      toast.error(`تعذر حفظ المركبة: ${error.message}`);
    if (vehicles.some((v) => v.id === data.id))
      vehicleUpdate.mutate({ id: data.id, data: payload as any }, { onSuccess, onError });
    else vehicleCreate.mutate(payload as any, { onSuccess, onError });
  };

  const saveQuickAction = (
    value: string,
    details?: { reference?: string; amount?: number; recipient?: string }
  ) => {
    if (!quickAction) return;
    const id = quickAction.row.id;
    const finish = (message: string, invalidate: () => void) => {
      invalidate();
      setQuickAction(null);
      toast.success(message);
    };
    if (active === "maintenance" && quickAction.action === "stage") {
      maintenanceAdvance.mutate(
        { id, toStage: value as MaintenanceStage },
        {
          onSuccess: () =>
            finish("تم نقل الطلب إلى المرحلة التالية", () => {
              utils.maintenance.list.invalidate();
              utils.vehicles.list.invalidate();
            }),
          onError: (e) => toast.error(`تعذر نقل طلب الصيانة: ${e.message}`),
        }
      );
    } else if (active === "maintenance" && quickAction.action === "approval") {
      const approved = value !== "رفض";
      maintenanceDecideApproval.mutate(
        {
          id,
          approved,
          ...(approved
            ? {
                fundingType: value as "عهدة" | "تحويل مباشر",
                fundingReference: details?.reference,
                fundingAmount: details?.amount,
                fundingRecipient: details?.recipient,
              }
            : {}),
        },
        {
          onSuccess: () =>
            finish(
              approved ? `تم اعتماد الطلب وتسجيل ${value}` : "تم رفض الطلب",
              () => {
                utils.maintenance.list.invalidate();
                utils.vehicles.list.invalidate();
              }
            ),
          onError: (e) => toast.error(`تعذر حفظ قرار الاعتماد: ${e.message}`),
        }
      );
    } else if (
      active === "maintenance" &&
      quickAction.action === "settle-advance"
    ) {
      maintenanceSettleAdvance.mutate(
        { id, reference: value },
        {
          onSuccess: () =>
            finish("تم تسجيل تسوية العهدة", () =>
              utils.maintenance.list.invalidate()
            ),
          onError: (e) => toast.error(`تعذر تسوية العهدة: ${e.message}`),
        }
      );
    } else if (active === "maintenance") {
      const data =
        quickAction.action === "cost"
          ? { cost: value }
          : { type: `${quickAction.row.type} · ${value}` };
      maintenanceUpdate.mutate(
        { id, data } as any,
        {
          onSuccess: () =>
            finish("تم حفظ إجراء الصيانة", () =>
              utils.maintenance.list.invalidate()
            ),
          onError: (e) => toast.error(`تعذر حفظ الإجراء: ${e.message}`),
        }
      );
    } else if (active === "documents" && quickAction.action === "extend") {
      documentUpdate.mutate(
        { id, data: { expiry: value, status: "ساري" } } as any,
        {
          onSuccess: () =>
            finish("تم تمديد المستند", () => utils.documents.list.invalidate()),
          onError: (e) => toast.error(`تعذر تمديد المستند: ${e.message}`),
        }
      );
    } else if (active === "drivers" && quickAction.action === "status") {
      driverUpdate.mutate(
        { id, data: { status: value } } as any,
        {
          onSuccess: () =>
            finish("تم تحديث حالة السائق", () =>
              utils.drivers.list.invalidate()
            ),
          onError: (e) => toast.error(`تعذر تحديث السائق: ${e.message}`),
        }
      );
    } else if (active === "finance" && quickAction.action === "status") {
      contractStatusUpdate.mutate(
        { id, status: value as "قائم" | "مكتمل" | "عرض سعر" | "ملغي" },
        {
          onSuccess: () =>
            finish("تم تحديث حالة العقد", () =>
              utils.contracts.list.invalidate()
            ),
          onError: (e) => toast.error(`تعذر تحديث العقد: ${e.message}`),
        }
      );
    }
  };

  const sidebarCounts: Partial<Record<ModuleKey, number>> = {
    vehicles: vehicles.length,
    projects: projectsQuery.data?.length ?? 0,
    maintenance: maintenance.length,
    documents: documents.length,
    drivers: drivers.length,
    clients: clients.length,
    finance: contracts.length + claims.length,
    payables: payablesQuery.data?.length ?? 0,
  };

  const registerMaintenanceInvoice = (request: Maintenance) => {
    setPrefillMaintenanceRequest(request);
    onNavigate("payables");
  };

  const handlePaymentArchive = (payment: PaymentRow) =>
    toast("سيتم إلغاء الدفعة وعكس أثرها المالي؟", {
      action: {
        label: "تأكيد",
        onClick: () =>
          paymentArchive.mutate(
            { id: payment.id },
            {
              onSuccess: () => {
                utils.payments.list.invalidate();
                utils.contracts.list.invalidate();
                utils.claims.list.invalidate();
                toast.success("تم إلغاء الدفعة وعكس أثرها");
              },
              onError: (error) => toast.error(error.message),
            }
          ),
      },
      cancel: { label: "إلغاء", onClick: () => {} },
    });

  const payablesContent = (
    <PayablesPage
      canAccess={canAccess}
      vehicles={vehicles}
      prefillMaintenanceRequest={prefillMaintenanceRequest}
      onPrefillConsumed={() => setPrefillMaintenanceRequest(null)}
    />
  );

  const maintenanceContent = (
    <MaintenancePage
      maintenance={maintenance}
      vehicles={vehicles}
      drivers={drivers}
      canApprove={canAccess("finance")}
      canRecordInvoice={canAccess("payables") && canAccess("vehicles")}
      onRegisterInvoice={registerMaintenanceInvoice}
      onOpenForm={(row) => setModal({ module: "maintenance", row })}
      onAction={onAction}
    />
  );

  const content =
    active === "dashboard" ? (
      <DashboardHome
        canAccess={canAccess}
        onNavigateFinanceView={(view) => {
          if (!canAccess("finance")) {
            toast.error("ليس لديك صلاحية الوصول إلى هذا القسم");
            return;
          }
          setActive("finance");
          setMobileOpen(false);
          navigate(`/dashboard/financial/${view}`);
        }}
        onNavigate={onNavigate}
        userName={user?.name}
        vehicles={canAccess("vehicles") ? vehicles : []}
        drivers={canAccess("drivers") ? drivers : []}
        maintenance={canAccess("maintenance") ? maintenance : []}
        documents={canAccess("documents") ? documents : []}
        contracts={canAccess("finance") ? contracts : []}
        claims={canAccess("finance") ? claims : []}
        clients={canAccess("clients") ? clients : []}
        payables={canAccess("payables") ? ((payablesQuery.data ?? []) as PayableRow[]) : []}
        projects={canAccess("projects") ? ((projectsQuery.data ?? []) as ProjectRow[]) : []}
        tasks={canAccess("dashboard") ? ((tasksQuery.data ?? []) as WorkTask[]) : []}
        taskAssignees={
          (taskAssigneesQuery.data ?? []) as Array<{ id: number; name: string | null }>
        }
        relatedRecords={[
          ...(canAccess("vehicles")
            ? vehicles.map((row) => ({
                entityType: "vehicle" as const,
                id: row.id,
                label: `${row.plate} · ${row.brand} ${row.model}`,
              }))
            : []),
          ...(canAccess("maintenance")
            ? maintenance.map((row) => ({
                entityType: "maintenance" as const,
                id: row.id,
                label: `${row.ref} · ${row.vehicle} · ${row.type}`,
              }))
            : []),
          ...(canAccess("projects")
            ? ((projectsQuery.data ?? []) as ProjectRow[]).map((row) => ({
                entityType: "project" as const,
                id: row.id,
                label: `${row.ref} · ${row.name}`,
              }))
            : []),
          ...(canAccess("documents")
            ? documents.map((row) => ({
                entityType: "document" as const,
                id: row.id,
                label: `${row.name} · ${row.entity}`,
              }))
            : []),
          ...(canAccess("drivers")
            ? drivers.map((row) => ({
                entityType: "driver" as const,
                id: row.id,
                label: row.name,
              }))
            : []),
          ...(canAccess("employees")
            ? ((employeesSearchQuery.data ?? []) as Row[]).map((row) => ({
                entityType: "employee" as const,
                id: row.id,
                label: `${row.employeeNo || ""} · ${row.name}`,
              }))
            : []),
          ...(canAccess("clients")
            ? clients.map((row) => ({
                entityType: "client" as const,
                id: row.id,
                label: row.name,
              }))
            : []),
          ...(canAccess("finance")
            ? contracts.map((row) => ({
                entityType: "contract" as const,
                id: row.id,
                label: `${row.ref} · ${row.client}`,
              }))
            : []),
          ...(canAccess("finance")
            ? claims.map((row) => ({
                entityType: "claim" as const,
                id: row.id,
                label: `${row.ref} · ${row.client}`,
              }))
            : []),
          ...(canAccess("payables")
            ? ((payablesQuery.data ?? []) as PayableRow[]).map((row) => ({
                entityType: "payable" as const,
                id: row.id,
                label: `${row.ref} · ${row.supplier}`,
              }))
            : []),
        ]}
        viewerUserId={user?.id ?? 0}
        notifications={
          canAccess("dashboard")
            ? ((notificationsQuery.data ?? []) as Array<{
                id: number;
                title: string;
                message: string;
                severity: string;
              }>)
            : []
        }
        onTaskToggle={(task) => {
          const nextStatus = task.status === "مكتملة" ? "مفتوحة" : "مكتملة";
          taskUpdate.mutate(
            { id: task.id, data: { status: nextStatus } },
            {
              onSuccess: () => {
                utils.tasks.list.invalidate();
                toast.success("تم تحديث المهمة");
              },
              onError: (error) =>
                toast.error(`تعذر تحديث المهمة: ${error.message}`),
            }
          );
        }}
        onTaskCreate={(task) => {
          taskCreate.mutate(
            { ...task, status: "مفتوحة" },
            {
              onSuccess: () => {
                utils.tasks.list.invalidate();
                toast.success("تمت إضافة المهمة");
              },
              onError: (error) =>
                toast.error(`تعذر إضافة المهمة: ${error.message}`),
            }
          );
        }}
        canManageTasks={user?.role === "admin"}
        onNotificationOpen={openNotificationRecord}
        onOpenNotifications={() => setNotificationCenterOpen(true)}
        onMaintenanceOpen={setMaintenanceDetail}
        onTaskOpenRelated={(task) => {
          const type = task.relatedEntityType;
          if (!type || !task.relatedEntityId) return;
          const module = notificationTarget(type) as ModuleKey;
          if (!canAccess(module)) {
            toast.error("لا تملك صلاحية فتح السجل المرتبط بهذه المهمة");
            return;
          }
          const linkedRows: Record<TaskRelatedEntityType, Row[]> = {
            vehicle: vehicles,
            maintenance,
            project: (projectsQuery.data ?? []) as Row[],
            document: documents,
            driver: drivers,
            employee: (employeesSearchQuery.data ?? []) as Row[],
            client: clients,
            contract: contracts,
            claim: claims,
            payable: (payablesQuery.data ?? []) as Row[],
          };
          const record = linkedRows[type].find(
            (row) => row.id === task.relatedEntityId
          );
          if (!record) {
            toast.error("السجل المرتبط غير موجود أو غير محمّل");
            return;
          }
          setActive(module);
          setMobileOpen(false);
          navigate(
            module === "finance"
              ? `/dashboard/financial/${type === "claim" ? "claims" : "contracts"}`
              : `/dashboard/${module}`
          );
          if (module === "vehicles") setVehicleProfile(record as Vehicle);
          else if (module === "maintenance")
            setMaintenanceDetail(record as Maintenance);
          else if (module === "drivers") setDriverDetail(record as Driver);
          else setDetail({ module, row: record });
        }}
      />
    ) : active === "accidents" ? (
      <AccidentsPage vehicles={vehicles} drivers={drivers} />
    ) : active === "inventory" ? (
      <InventoryPage canApprove={canAccess("finance")} />
    ) : active === "procurement" ? (
      <ProcurementPage canApproveFinance={canAccess("finance")} />
    ) : active === "accounting" ? (
      <AccountingPage canAccessFinance={canAccess("finance")} />
    ) : active === "invoices" ? (
      <InvoicesPage canAccessFinance={canAccess("finance")} />
    ) : active === "vehicles" ? (
      <VehiclesPage
        vehicles={vehicles}
        setVehicles={setVehicles}
        onOpenForm={(row) => setModal({ module: "vehicles", row })}
        onAction={onAction}
        canAccess={canAccess}
      />
    ) : active === "projects" ? (
      <ProjectsPage canAccess={canAccess} />
    ) : active === "employees" ? (
      <EmployeesPage
        canAccess={canAccess}
        canManageAccounts={user?.role === "admin"}
      />
    ) : active === "reports" ? (
      <ReportsPage canAccess={canAccess} />
    ) : active === "payables" ? (
      payablesContent
    ) : active === "custody" ? (
      <CustodyPage
        canApprove={canAccess("finance")}
        currentUser={user}
        drivers={drivers}
        employees={(employeesSearchQuery.data ?? []) as any}
      />
    ) : active === "maintenance" ? (
      maintenanceContent
    ) : active === "documents" ? (
      <DocumentsPage
        documents={documents}
        onOpenForm={(row) => setModal({ module: "documents", row })}
        onAction={onAction}
      />
    ) : active === "drivers" ? (
      <EmployeesPage
        canAccess={canAccess}
        canManageAccounts={user?.role === "admin"}
        initialTab="drivers"
      />
    ) : active === "clients" ? (
      <ClientsPage
        clients={clients}
        onOpenForm={(row) => setModal({ module: "clients", row })}
        onAction={onAction}
      />
    ) : active === "finance" ? (
      <FinancePage
        contracts={contracts}
        claims={claims}
        payments={(paymentsQuery.data ?? []) as PaymentRow[]}
        onAction={onAction}
        onOpenForm={(row) => setModal({ module: "finance", row })}
        onPaymentArchive={handlePaymentArchive}
      />
    ) : active === "self_service" ? (
      <SelfServicePortalPage
        user={user}
        canInspection={
          user?.role === "admin" || userPermissions.has("self_service_driver")
        }
        canHr={
          user?.role === "admin" ||
          userPermissions.has("self_service_hr") ||
          userPermissions.has("self_service_driver")
        }
      />
    ) : (
      <SettingsPage
        settingsCount={(settingsQuery.data ?? []).length}
        auditLogs={
          (auditQuery.data ?? []) as Array<{
            action: string;
            entityType: string;
            createdAt?: Date | string;
          }>
        }
      />
    );

  if (authLoading)
    return (
      <div className="auth-state" dir="rtl">
        جارٍ التحقق من صلاحية الدخول...
      </div>
    );
  if (!user)
    return (
      <div className="auth-state" dir="rtl">
        جارٍ تحويلك إلى صفحة تسجيل الدخول...
      </div>
    );
  if (!canAccess(active))
    return (
      <div className="auth-state" dir="rtl">
        جارٍ التحقق من صلاحية القسم...
      </div>
    );

  return (
    <div className="app-shell" dir="rtl">
      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-top">
          <Logo compact={collapsed} />
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="طي القائمة"
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">ث</span>
          <div>
            <strong>شركة ثقة التوصيل لإدارة الأسطول</strong>
            <small>الحساب الرئيسي</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) =>
              canAccess(item.key as ModuleKey)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div className="nav-group" key={group.label}>
                <span className="nav-label">{group.label}</span>
                {visibleItems.map((item) => (
                  <button
                    key={item.key}
                    className={`nav-item ${active === item.key ? "active" : ""}`}
                    onClick={() => onNavigate(item.key as ModuleKey)}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    {sidebarCounts[item.key] !== undefined && (
                      <em>{sidebarCounts[item.key]!.toLocaleString("en-US")}</em>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="help-link"
            onClick={() =>
              toast.info("تواصل مع مسؤول النظام للحصول على المساعدة")
            }
          >
            <Headphones size={17} />
            <span>مركز المساعدة</span>
          </button>
          <div className="sidebar-user">
            <span className="user-avatar">ع</span>
            <div>
              <strong>{user?.name || "المستخدم"}</strong>
              <small>{user?.role === "admin" ? "مدير النظام" : "مستخدم"}</small>
            </div>
            <button onClick={() => logout()} aria-label="تسجيل الخروج">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumbs">
              <span>الرئيسية</span>
              <ChevronLeft size={14} />
              <strong>
                {active === "dashboard"
                  ? "الإحصائيات"
                  : navGroups
                      .flatMap((g) => g.items)
                      .find((i) => i.key === active)?.label}
              </strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="quick-search"
              onClick={() => {
                setCommandQuery("");
                setCommandOpen(true);
              }}
            >
              <Search size={16} />
              <span>بحث سريع</span>
              <kbd>⌘ K</kbd>
            </button>
            {canAccess("dashboard") && (
              <button
                className="top-icon"
                aria-label="فتح مركز التنبيهات"
                onClick={() => setNotificationCenterOpen(true)}
              >
                <Bell size={18} />
                {Boolean(visibleNotifications.some((item) => !item.readAt)) && <i />}
              </button>
            )}
            <span className="top-divider" />
            <div className="top-profile">
              <span className="user-avatar">ع</span>
              <div>
                <strong>{user?.name || "المستخدم"}</strong>
                <small>{user?.role === "admin" ? "مدير النظام" : "مستخدم"}</small>
              </div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>
        <div className="page-content">
          {hasWorkspaceQueryError && (
            <section className="workspace-data-alert" role="alert">
              <div>
                <strong>تعذر تحميل بعض بيانات النظام</strong>
                <span>
                  الأقسام المتأثرة:{" "}
                  {failedWorkspaceSources.map((source) => source.label).join("، ")}
                  . يمكنك متابعة العمل في الأقسام التي تم تحميلها.
                </span>
              </div>
              <button
                className="btn outline"
                onClick={() => void retryFailedWorkspaceSources()}
                disabled={failedWorkspaceSources.some(
                  (source) => source.query.isFetching
                )}
              >
                إعادة محاولة التحميل
              </button>
            </section>
          )}
          {content}
        </div>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} شركة ثقة التوصيل</span>
          <span
            className={`online ${workspaceStatusTone}`}
            role="status"
            aria-live="polite"
          >
            <i aria-hidden="true" />
            {workspaceStatus}
          </span>
        </footer>
      </main>

      {modal && canAccess(modal.module) && (
        <RecordForm
          module={modal.module}
          row={modal.row}
          canAccess={canAccess}
          onClose={() => setModal(null)}
          onSave={saveRecord}
        />
      )}
      {driverDetail && canAccess("drivers") && (
        <DriverVehiclesModal
          driver={driverDetail}
          vehicles={vehicles}
          documents={documents}
          canViewDocuments={canAccess("documents")}
          onClose={() => setDriverDetail(null)}
        />
      )}
      {assignmentVehicle && canAccess("vehicles") && (
        <AssignDriverModal
          vehicle={assignmentVehicle}
          drivers={drivers}
          onClose={() => setAssignmentVehicle(null)}
          onSave={saveAssignment}
        />
      )}
      {assignmentDriver && canAccess("drivers") && (
        <AssignVehicleModal
          driver={assignmentDriver}
          vehicles={vehicles}
          onClose={() => setAssignmentDriver(null)}
          onSave={saveVehicleAssignment}
        />
      )}
      {quickAction && canAccess(active) && (
        <QuickActionModal
          action={quickAction.action}
          module={active}
          row={quickAction.row}
          onClose={() => setQuickAction(null)}
          onSave={saveQuickAction}
        />
      )}
      {vehicleProfile && canAccess("vehicles") && (
        <VehicleProfileModal
          vehicle={vehicleProfile}
          canAccess={canAccess}
          maintenance={maintenance}
          documents={documents}
          onClose={() => setVehicleProfile(null)}
        />
      )}
      {maintenanceDetail && canAccess("maintenance") && (
        <MaintenanceDetailModal
          request={maintenanceDetail}
          linkedInvoices={(payablesQuery.data ?? []) as PayableRow[]}
          canViewFinance={canAccess("finance")}
          canViewPayables={canAccess("payables")}
          canViewDocuments={canAccess("documents")}
          onOpenPayables={() => {
            setMaintenanceDetail(null);
            onNavigate("payables");
          }}
          onClose={() => setMaintenanceDetail(null)}
          onEdit={() => {
            setMaintenanceDetail(null);
            setModal({ module: "maintenance", row: maintenanceDetail });
          }}
        />
      )}
      {detail && canAccess(detail.module) && (
        <DetailModal
          module={detail.module}
          row={detail.row}
          canAccess={canAccess}
          onClose={() => setDetail(null)}
          onEdit={
            detail.module === "dashboard"
              ? undefined
              : () => setModal({ module: detail.module, row: detail.row })
          }
        />
      )}

      {notificationCenterOpen && (
        <Modal
          title="مركز التنبيهات"
          onClose={() => setNotificationCenterOpen(false)}
        >
          <div className="compact-list">
            {visibleNotifications.length ? (
              visibleNotifications.map((notification) => {
                const target = notificationTarget(
                  notification.entityType
                ) as ModuleKey;
                return (
                  <button
                    className="compact-row"
                    key={notification.id}
                    onClick={() => openNotificationRecord(notification)}
                    style={{
                      width: "100%",
                      textAlign: "right",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className={`alert-icon ${
                        notification.severity === "حرج"
                          ? "red"
                          : notification.severity === "تنبيه"
                          ? "amber"
                          : "blue"
                      }`}
                    >
                      <Bell size={16} />
                    </span>
                    <span className="compact-main">
                      <strong>{notification.title}</strong>
                      <small>
                        {notification.message}
                        {notification.entityId ? ` · فتح ${target}` : ""}
                      </small>
                    </span>
                    <Badge>{notification.readAt ? "مقروء" : "جديد"}</Badge>
                    <ChevronLeft size={15} />
                  </button>
                );
              })
            ) : (
              <div className="empty-state">
                <strong>لا توجد إشعارات</strong>
                <span>ستظهر هنا الإشعارات التشغيلية المرتبطة بسجلاتك.</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {commandOpen && (
        <Modal
          title="البحث السريع"
          onClose={() => {
            setCommandOpen(false);
            setCommandQuery("");
          }}
        >
          <div className="command-search">
            <Search size={18} />
            <input
              autoFocus
              value={commandQuery}
              onChange={(event) => {
                setCommandQuery(event.target.value);
                setCommandActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && quickSearchResults.length) {
                  event.preventDefault();
                  setCommandActiveIndex((index) =>
                    Math.min(index + 1, quickSearchResults.length - 1)
                  );
                } else if (event.key === "ArrowUp" && quickSearchResults.length) {
                  event.preventDefault();
                  setCommandActiveIndex((index) => Math.max(0, index - 1));
                } else if (
                  event.key === "Enter" &&
                  quickSearchResults[commandActiveIndex]
                ) {
                  event.preventDefault();
                  openQuickSearchResult(quickSearchResults[commandActiveIndex]);
                }
              }}
              aria-label="البحث في سجلات النظام"
              aria-controls="quick-search-results"
              aria-activedescendant={
                commandQuery.trim() && quickSearchResults.length
                  ? `quick-search-result-${commandActiveIndex}`
                  : undefined
              }
              placeholder="ابحث برقم اللوحة أو الاسم أو المرجع..."
            />
          </div>
          <div
            className="command-list"
            id="quick-search-results"
            role={commandQuery.trim() ? "listbox" : undefined}
          >
            {commandQuery.trim() ? (
              quickSearchResults.length ? (
                quickSearchResultsContent
              ) : (
                quickSearchEmptyState
              )
            ) : (
              <>
                <div className="field-note">
                  ابحث في السجلات التي تملك صلاحية عرضها، أو استخدم اختصار Ctrl/⌘ +
                  K.
                </div>
                <button
                  onClick={() => {
                    onNavigate("vehicles");
                    setCommandOpen(false);
                  }}
                >
                  <CarFront size={16} />
                  <span>الانتقال إلى المركبات</span>
                  <kbd>↵</kbd>
                </button>
                <button
                  onClick={() => {
                    onNavigate("maintenance");
                    setCommandOpen(false);
                  }}
                >
                  <Wrench size={16} />
                  <span>فتح طلب صيانة جديد</span>
                  <kbd>↵</kbd>
                </button>
                <button
                  onClick={() => {
                    onNavigate("documents");
                    setCommandOpen(false);
                  }}
                >
                  <FileText size={16} />
                  <span>عرض المستندات</span>
                  <kbd>↵</kbd>
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
