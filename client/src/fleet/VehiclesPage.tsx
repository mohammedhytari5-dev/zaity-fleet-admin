import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { matchesQuickSearch } from "@/lib/quick-search";
import { MoreHorizontal, Upload } from "lucide-react";
import type { ModuleKey, Row, Vehicle, ImportConfig } from "./types";
import {
  Badge,
  PageHeader,
  TableShell,
  ContextMenu,
  ImportModal,
  exportCsv,
  formatSAR,
} from "./common";

export function VehiclesPage({
  vehicles,
  setVehicles,
  onOpenForm,
  onAction,
  canAccess,
}: {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  onOpenForm: (row?: Row) => void;
  onAction: (action: string, row: Row) => void;
  canAccess: (key: ModuleKey) => boolean;
}) {
  const utils = trpc.useUtils();
  const createVehicle = trpc.vehicles.create.useMutation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("الكل");
  const [menu, setMenu] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = vehicles.filter(
    (v) =>
      matchesQuickSearch(v, search) &&
      (tab === "الكل" ||
        (tab === "متاح" && v.status === "متاحة") ||
        (tab === "في الصيانة" && v.status === "في الصيانة") ||
        (tab === "مؤجر / مشغول" && ["مؤجرة", "مشغولة"].includes(v.status)) ||
        (tab === "قيد التجهيز" && v.status === "قيد التجهيز") ||
        (tab === "متوقفة" && v.status === "متوقفة"))
  );

  const topSpender = [...vehicles].sort(
    (a, b) => Number(b.expenseTotal || 0) - Number(a.expenseTotal || 0)
  )[0];

  const vehicleImportConfig: ImportConfig = {
    label: "المركبات",
    sampleFilename: "نموذج_استيراد_المركبات.csv",
    columns: [
      { key: "plate", header: "رقم اللوحة", required: true, hint: "أ ب ج 1234" },
      { key: "brand", header: "الشركة", required: true, hint: "تويوتا" },
      { key: "model", header: "الموديل", required: false, hint: "هايلوكس" },
      { key: "year", header: "سنة الصنع", required: false, hint: "2024" },
      { key: "color", header: "اللون", required: false, hint: "أبيض" },
      { key: "mileage", header: "عداد المسافة", required: false, hint: "150000 كم" },
      { key: "status", header: "الحالة", required: false, hint: "متاحة" },
      { key: "purchasePrice", header: "قيمة الشراء", required: false, hint: "120000" },
      { key: "purchaseDate", header: "تاريخ الشراء", required: false, hint: "2023-01-15" },
    ],
    mapRow: (raw) => ({
      plate: raw["رقم اللوحة"]?.trim() || "",
      brand: raw["الشركة"]?.trim() || "تويوتا",
      model: raw["الموديل"]?.trim() || "",
      year: raw["سنة الصنع"]?.trim() || String(new Date().getFullYear()),
      color: raw["اللون"]?.trim() || "أبيض",
      mileage: raw["عداد المسافة"]?.trim() || "0 كم",
      status: raw["الحالة"]?.trim() || "متاحة",
      purchasePrice: Number(String(raw["قيمة الشراء"] || "0").replace(/[^0-9]/g, "")) || 0,
      purchaseDate: raw["تاريخ الشراء"]?.trim() || "—",
      driver: "—",
      client: "—",
      contract: "—",
    }),
  };

  const doImportVehicles = async (rows: Record<string, any>[]) => {
    for (const row of rows) {
      await createVehicle.mutateAsync(row as any);
    }
    void utils.vehicles.list.invalidate();
  };

  return (
    <>
      <PageHeader
        eyebrow="التشغيل / إدارة الأسطول"
        title="المركبات"
        description="افتح قائمة الإجراءات ثم «عرض التفاصيل» لملف الباص المالي والتشغيلي."
        action="إضافة مركبة"
        onAction={() => onOpenForm()}
      />

      <div className="quick-metrics">
        <div>
          <span>كل المركبات</span>
          <strong>{vehicles.length.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>متاحة</span>
          <strong className="green-text">
            {vehicles.filter((v) => v.status === "متاحة").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>في الصيانة</span>
          <strong className="red-text">
            {vehicles.filter((v) => v.status === "في الصيانة").length.toLocaleString("en-US")}
          </strong>
        </div>
        <div>
          <span>مؤجرة / مشغولة</span>
          <strong className="blue-text">
            {vehicles.filter((v) => ["مؤجرة", "مشغولة"].includes(v.status)).length.toLocaleString("en-US")}
          </strong>
        </div>
        {canAccess("finance") && (
          <>
            <div>
              <span>مصروفات التشغيل للأسطول</span>
              <strong>
                {formatSAR(vehicles.reduce((total, vehicle) => total + Number(vehicle.expenseTotal || 0), 0))}
              </strong>
            </div>
            <div>
              <span>الأعلى مصروفًا</span>
              <strong>{topSpender ? `${topSpender.plate} · ${formatSAR(Number(topSpender.expenseTotal || 0))}` : "—"}</strong>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: ".5rem" }}>
        <button className="btn outline" onClick={() => setImportOpen(true)}>
          <Upload size={15} /> استيراد من CSV
        </button>
      </div>

      <TableShell
        columns={[
          "رقم اللوحة",
          "المركبة",
          "السنة",
          "المسافة",
          "السائق",
          "الموظف المسؤول",
          "الحالة",
          "العميل",
          ...(canAccess("finance") ? ["مصروف التشغيل", "إيراد محصل"] : []),
        ]}
        onExport={() =>
          exportCsv(
            filtered,
            [
              "plate",
              "brand",
              "model",
              "year",
              "mileage",
              "driver",
              "employee",
              "status",
              "client",
              ...(canAccess("finance")
                ? ["purchasePrice", "expenseTotal", "revenueTotal", "netOperatingReturn"]
                : []),
            ],
            "vehicles"
          )
        }
        search={search}
        setSearch={setSearch}
        tabs={["الكل", "متاح", "في الصيانة", "مؤجر / مشغول", "قيد التجهيز", "متوقفة"]}
        activeTab={tab}
        setActiveTab={setTab}
        addLabel="إضافة مركبة"
        onAdd={() => onOpenForm()}
      >
        {filtered.map((v) => (
          <tr key={v.id}>
            <td>
              <strong className="table-primary">{v.plate}</strong>
              <small>{v.brand}</small>
            </td>
            <td>
              {v.model}
              <small>{v.color}</small>
            </td>
            <td>{v.year}</td>
            <td>{v.mileage}</td>
            <td>{v.driver}</td>
            <td>{v.employee || "—"}</td>
            <td>
              <Badge>{v.status}</Badge>
            </td>
            <td>
              {v.client}
              <small>{v.contract}</small>
            </td>
            {canAccess("finance") && (
              <>
                <td>{formatSAR(Number(v.expenseTotal || 0))}</td>
                <td>{formatSAR(Number(v.revenueTotal || 0))}</td>
              </>
            )}
            <td className="actions-cell">
              <button className="row-menu-btn" onClick={() => setMenu(menu === v.id ? null : v.id)}>
                <MoreHorizontal size={18} />
              </button>
              {menu === v.id && (
                <ContextMenu
                  row={v}
                  module="vehicles"
                  onClose={() => setMenu(null)}
                  onAction={(action) => {
                    setMenu(null);
                    onAction(action, v);
                  }}
                />
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {importOpen && (
        <ImportModal
          config={vehicleImportConfig}
          onClose={() => setImportOpen(false)}
          onImport={doImportVehicles}
        />
      )}
    </>
  );
}

export default VehiclesPage;
