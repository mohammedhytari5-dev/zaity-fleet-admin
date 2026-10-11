import React from "react";
import { formatSAR } from "../common";
import type { WorkforceMember, DriverWorkforceMember } from "@shared/workforce-domain";

interface WorkforceStatsCardsProps {
  members: (WorkforceMember | DriverWorkforceMember)[];
  totalMonthlyPayroll: number;
  expiringDocsCount: number;
}

export const WorkforceStatsCards: React.FC<WorkforceStatsCardsProps> = ({
  members,
  totalMonthlyPayroll,
  expiringDocsCount,
}) => {
  const driversCount = members.filter((m) => m.isDriver()).length;
  const staffCount = members.filter((m) => !m.isDriver()).length;
  const activeCount = members.filter((m) => m.isActive()).length;

  return (
    <div className="quick-metrics">
      <div>
        <span>إجمالي القوى العاملة</span>
        <strong>{members.length.toLocaleString("en-US")}</strong>
      </div>
      <div>
        <span>سائقو الأسطول</span>
        <strong className="blue-text">{driversCount.toLocaleString("en-US")}</strong>
      </div>
      <div>
        <span>موظفو الإدارة والتشغيل</span>
        <strong style={{ color: "#15803d" }}>{staffCount.toLocaleString("en-US")}</strong>
      </div>
      <div>
        <span>على رأس العمل</span>
        <strong className="green-text">{activeCount.toLocaleString("en-US")}</strong>
      </div>
      <div>
        <span>إجمالي الرواتب الشهرية</span>
        <strong className="teal-text">{formatSAR(totalMonthlyPayroll)}</strong>
      </div>
      <div>
        <span>وثائق ورخص حرجة</span>
        <strong className={expiringDocsCount > 0 ? "red-text" : "green-text"}>
          {expiringDocsCount.toLocaleString("en-US")}
        </strong>
      </div>
    </div>
  );
};
