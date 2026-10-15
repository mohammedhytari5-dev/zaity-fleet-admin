import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Bus,
  Wrench,
  DollarSign,
  FileText,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  DailyInspectionAlertBanner,
  DriverMaintenanceSection,
  DriverPayrollDisputesSection,
} from "./workforce/DriverSelfServiceFeatures";
import { InspectionsSection } from "./workforce/InspectionsSection";
import { EmployeeRequestsSection } from "./workforce/EmployeeRequestsSection";
import { WorkforceSelfServiceModal } from "./workforce/WorkforceSelfServiceModal";
import type { Driver, Vehicle, EmployeeRow } from "./types";

export interface SelfServicePortalPageProps {
  user: {
    id?: number;
    username?: string | null;
    name?: string | null;
    role?: string;
  } | null;
  canInspection?: boolean;
  canHr?: boolean;
}

export function SelfServicePortalPage({
  user,
  canInspection = true,
  canHr = true,
}: SelfServicePortalPageProps) {
  const [activeTab, setActiveTab] = useState<
    "inspections" | "maintenance" | "payroll" | "requests"
  >("inspections");
  const [selfServiceModalOpen, setSelfServiceModalOpen] = useState(false);

  // Queries
  const driversQuery = trpc.drivers.list.useQuery();
  const vehiclesQuery = trpc.vehicles.list.useQuery();
  const employeesQuery = trpc.employees.list.useQuery();
  const inspectionsQuery = trpc.inspections.list.useQuery();

  const drivers = (driversQuery.data ?? []) as Driver[];
  const vehicles = (vehiclesQuery.data ?? []) as Vehicle[];
  const employees = (employeesQuery.data ?? []) as EmployeeRow[];
  const inspections = inspectionsQuery.data ?? [];

  // Match current user to driver if applicable
  const currentDriver = drivers.find(
    (d) =>
      d.name === user?.name ||
      d.nationalId === user?.username ||
      d.phone === user?.username
  );

  return (
    <div style={{ padding: "1.25rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
            بوابة الخدمة الذاتية للسائقين والموظفين
          </h2>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.88rem" }}>
            إجراء الفحص اليومي، متابعة الصيانة والفواتير، استعراض كشف الراتب والاعتراض على الخصومات، وتقديم الطلبات الإدارية
          </p>
        </div>

        <button
          className="btn primary"
          onClick={() => setSelfServiceModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.25rem",
            borderRadius: "10px",
            fontWeight: 700,
          }}
        >
          <Plus size={18} />
          تقديم فحص / طلب جديد
        </button>
      </div>

      {/* Daily Inspection Alert Banner for Drivers */}
      <div style={{ marginBottom: "1.5rem" }}>
        <DailyInspectionAlertBanner
          inspections={inspections}
          onStartInspection={() => setSelfServiceModalOpen(true)}
        />
      </div>

      {/* Navigation Tabs */}
      <div
        className="table-tabs"
        style={{
          background: "white",
          padding: "0.4rem 0.75rem",
          borderRadius: "10px",
          border: "1px solid var(--border-color, #e5e7eb)",
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <button
          className={activeTab === "inspections" ? "active" : ""}
          onClick={() => setActiveTab("inspections")}
          type="button"
        >
          <Bus size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
          فحص الباص والمركبات
        </button>

        <button
          className={activeTab === "maintenance" ? "active" : ""}
          onClick={() => setActiveTab("maintenance")}
          type="button"
        >
          <Wrench size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
          طلبات الصيانة وإصلاح الأعطال
        </button>

        <button
          className={activeTab === "payroll" ? "active" : ""}
          onClick={() => setActiveTab("payroll")}
          type="button"
        >
          <DollarSign size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
          كشف الراتب واعتراضات الخصومات
        </button>

        <button
          className={activeTab === "requests" ? "active" : ""}
          onClick={() => setActiveTab("requests")}
          type="button"
        >
          <FileText size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
          الطلبات الإدارية والإجازات
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "inspections" && (
        <InspectionsSection
          vehicles={vehicles}
          drivers={drivers}
          onOpenSelfService={() => setSelfServiceModalOpen(true)}
        />
      )}

      {activeTab === "maintenance" && (
        <DriverMaintenanceSection
          driverId={currentDriver?.id}
          driverName={currentDriver?.name || user?.name || undefined}
          vehicles={vehicles}
        />
      )}

      {activeTab === "payroll" && (
        <DriverPayrollDisputesSection
          driverId={currentDriver?.id}
          driverName={currentDriver?.name || user?.name || undefined}
        />
      )}

      {activeTab === "requests" && (
        <EmployeeRequestsSection
          employees={employees}
          drivers={drivers}
          onOpenSelfService={() => setSelfServiceModalOpen(true)}
        />
      )}

      {/* Self Service Modal */}
      {selfServiceModalOpen && (
        <WorkforceSelfServiceModal
          onClose={() => setSelfServiceModalOpen(false)}
          employees={employees}
          drivers={drivers}
          vehicles={vehicles}
          initialPersonId={currentDriver?.id}
          initialPersonType={currentDriver ? "driver" : "employee"}
          mode="all"
        />
      )}
    </div>
  );
}

export default SelfServicePortalPage;
