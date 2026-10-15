import React from "react";
import { DonutKpiCard } from "./DonutKpiCard";
import type { Vehicle, Driver, Maintenance, Contract, Claim } from "../types";
import {
  CarFront,
  Users,
  Building2,
  BadgeDollarSign,
  Briefcase,
  Wrench,
} from "lucide-react";

interface FleetDonutKpiSectionProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  clients?: any[];
  claims: Claim[];
  contracts: Contract[];
  maintenance: Maintenance[];
  onNavigate: (module: any) => void;
}

export function FleetDonutKpiSection({
  vehicles = [],
  drivers = [],
  clients = [],
  claims = [],
  contracts = [],
  maintenance = [],
  onNavigate,
}: FleetDonutKpiSectionProps) {
  // 1. Vehicles
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.status === "متاحة").length;
  const busyVehicles = vehicles.filter((v) => ["مؤجرة", "مشغولة"].includes(v.status)).length;
  const inMaintVehicles = vehicles.filter((v) => v.status === "في الصيانة").length;
  const prepVehicles = vehicles.filter((v) => ["قيد التجهيز", "متوقفة"].includes(v.status)).length;

  const vehicleSegments = [
    { label: "نشطة", value: activeVehicles, color: "#10b981" },
    { label: "مشغول", value: busyVehicles, color: "#f59e0b" },
    { label: "تحت التجهيز", value: prepVehicles, color: "#f87171" },
    { label: "في الصيانة", value: inMaintVehicles, color: "#38bdf8" },
  ];

  // 2. Drivers
  const totalDrivers = drivers.length;
  const availDrivers = drivers.filter((d) => d.status === "نشط" || d.status === "متاح").length;
  const busyDrivers = drivers.filter((d) => d.status === "مشغول").length;
  const leaveDrivers = drivers.filter((d) => d.status === "إجازة" || d.status === "في إجازة").length;
  const stoppedDrivers = drivers.filter((d) => ["متوقف", "غير نشط"].includes(d.status)).length;

  const driverSegments = [
    { label: "متاح", value: availDrivers, color: "#10b981" },
    { label: "مشغول", value: busyDrivers, color: "#f59e0b" },
    { label: "في إجازة", value: leaveDrivers, color: "#6366f1" },
    { label: "متوقف", value: stoppedDrivers, color: "#94a3b8" },
  ];

  // 3. Clients
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status !== "غير نشط").length;
  const inactiveClients = clients.filter((c) => c.status === "غير نشط").length;

  const clientSegments = [
    { label: "نشط", value: activeClients, color: "#10b981" },
    { label: "غير نشط", value: inactiveClients, color: "#94a3b8" },
  ];

  // 4. Collections / Claims
  const totalClaims = claims.length;
  const collectedClaims = claims.filter((c) => c.status === "مسددة" || c.status === "مدفوعة").length;
  const pendingClaims = claims.filter((c) => ["مفتوحة", "قيد المتابعة", "مطالبة"].includes(c.status)).length;
  const overdueClaims = claims.filter((c) => c.status === "متأخرة" || c.status === "متعثرة").length;

  const claimSegments = [
    { label: "تم التحصيل", value: collectedClaims, color: "#10b981" },
    { label: "قيد المتابعة", value: pendingClaims, color: "#f59e0b" },
    { label: "متأخرة", value: overdueClaims, color: "#ef4444" },
  ];

  // 5. Operations / Contracts
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((c) => c.status === "ساري" || c.status === "نشط").length;
  const expiringContracts = contracts.filter((c) => c.status === "ينتهي قريباً").length;
  const closedContracts = contracts.filter((c) => ["منتهي", "ملغي", "مسودة"].includes(c.status)).length;

  const contractSegments = [
    { label: "ساري", value: activeContracts, color: "#10b981" },
    { label: "ينتهي قريباً", value: expiringContracts, color: "#f59e0b" },
    { label: "منتهي / مسودة", value: closedContracts, color: "#64748b" },
  ];

  // 6. Maintenance
  const totalMaint = maintenance.length;
  const inProgressMaint = maintenance.filter((m) => m.status === "جاري العمل" || m.workflowStage === "تنفيذ").length;
  const pendingApprovalMaint = maintenance.filter((m) => m.approvalStatus === "بانتظار الاعتماد" || m.workflowStage === "اعتماد").length;
  const completedMaint = maintenance.filter((m) => m.status === "مكتمل" || m.workflowStage === "مغلق").length;
  const urgentMaint = maintenance.filter((m) => ["طارئ", "عاجل"].includes(String(m.priority)) && m.status !== "مكتمل").length;

  const maintSegments = [
    { label: "قيد التنفيذ", value: inProgressMaint, color: "#38bdf8" },
    { label: "بانتظار الاعتماد", value: pendingApprovalMaint, color: "#f59e0b" },
    { label: "مكتمل", value: completedMaint, color: "#10b981" },
    { label: "طارئ", value: urgentMaint, color: "#ef4444" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "1.25rem",
        marginBottom: "1.75rem",
      }}
    >
      <DonutKpiCard
        title="المركبات"
        total={totalVehicles}
        segments={vehicleSegments}
        icon={<CarFront size={18} color="#059669" />}
        onClick={() => onNavigate("vehicles")}
      />

      <DonutKpiCard
        title="السائقين"
        total={totalDrivers}
        segments={driverSegments}
        icon={<Users size={18} color="#2563eb" />}
        onClick={() => onNavigate("drivers")}
      />

      <DonutKpiCard
        title="العملاء"
        total={totalClients}
        segments={clientSegments}
        icon={<Building2 size={18} color="#7c3aed" />}
        onClick={() => onNavigate("clients")}
      />

      <DonutKpiCard
        title="التحصيل"
        total={totalClaims}
        segments={claimSegments}
        icon={<BadgeDollarSign size={18} color="#d97706" />}
        onClick={() => onNavigate("finance")}
      />

      <DonutKpiCard
        title="التشغيل"
        total={totalContracts}
        segments={contractSegments}
        icon={<Briefcase size={18} color="#0891b2" />}
        onClick={() => onNavigate("contracts")}
      />

      <DonutKpiCard
        title="الصيانة"
        total={totalMaint}
        segments={maintSegments}
        icon={<Wrench size={18} color="#dc2626" />}
        onClick={() => onNavigate("maintenance")}
      />
    </div>
  );
}
