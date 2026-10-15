import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge, toInputDate, Modal } from "../common";
import {
  Gauge,
  Droplet,
  Fuel,
  Car,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Filter,
  Check,
  Wrench,
  Search,
} from "lucide-react";
import type { VehicleInspectionRow, Vehicle, Driver } from "../types";

export function InspectionsSection({
  vehicles,
  drivers,
  onOpenSelfService,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
  onOpenSelfService: () => void;
}) {
  const [tab, setTab] = useState<"all" | "issues" | "healthy">("all");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [search, setSearch] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);

  const utils = trpc.useUtils();
  const inspectionsQuery = trpc.inspections.list.useQuery();
  const updateStatusMutation = trpc.inspections.updateStatus.useMutation();

  const inspections = inspectionsQuery.data ?? [];

  const filtered = inspections.filter((item) => {
    if (tab === "issues" && !item.hasIssue) return false;
    if (tab === "healthy" && item.hasIssue) return false;
    if (selectedVehicle && item.vehiclePlate !== selectedVehicle) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.driverName.toLowerCase().includes(q) ||
        item.vehiclePlate.toLowerCase().includes(q) ||
        (item.issueSummary && item.issueSummary.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleReview = async (id: number, status: "تمت المراجعة" | "تم تحويله للصيانة") => {
    try {
      await updateStatusMutation.mutateAsync({ id, status });
      toast.success(`تم تحديث حالة الفحص إلى: ${status}`);
      utils.inspections.list.invalidate();
    } catch (err: any) {
      toast.error(`تعذر التحديث: ${err.message}`);
    }
  };

  const issuesCount = inspections.filter((i) => i.hasIssue).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Top Banner & Quick Stats */}
      <div
        style={{
          background: "white",
          padding: "1rem 1.25rem",
          borderRadius: "10px",
          border: "1px solid var(--border-color, #e5e7eb)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "var(--brand-primary, #25364c)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Gauge size={20} color="#2563eb" /> سجل الفحوصات والتفقد اليومي للباصات
          </h3>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
            متابعة فورية لقراءات عدادات الكيلومتر، عيار الزيت، ماء الرديتر، وصور الباصات الملتقطة بواسطة السائقين يومياً.
          </p>
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={onOpenSelfService}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <Car size={16} /> فتح بوابة السائق / تسجيل فحص
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div className="table-tabs" style={{ background: "white", padding: "0.25rem 0.5rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <button
            className={tab === "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            كافة الفحوصات ({inspections.length})
          </button>
          <button
            className={tab === "issues" ? "active" : ""}
            onClick={() => setTab("issues")}
            style={{ color: issuesCount > 0 ? "#dc2626" : "inherit", fontWeight: issuesCount > 0 ? 700 : "normal" }}
          >
            ⚠️ باصات بها نواقص أو أعطال ({issuesCount})
          </button>
          <button
            className={tab === "healthy" ? "active" : ""}
            onClick={() => setTab("healthy")}
          >
            🟢 باصات سليمة ({inspections.length - issuesCount})
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "white" }}
          >
            <option value="">جميع الباصات</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.plate}>
                {v.plate} ({v.brand})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="بحث باسم السائق أو اللوحة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "white", minWidth: 200 }}
          />
        </div>
      </div>

      {/* Inspections Table */}
      <div className="table-scroll" style={{ background: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <table>
          <thead>
            <tr>
              <th>تاريخ ووقت الفحص</th>
              <th>السائق المفحوص</th>
              <th>الباص واللوحة</th>
              <th>قراءة العداد</th>
              <th>زيت المحرك</th>
              <th>ماء الرديتر</th>
              <th>الإطارات والسلامة</th>
              <th>الصور الموثقة</th>
              <th>ملخص الملاحظات</th>
              <th>حالة التقرير</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} style={{ background: item.hasIssue ? "#fff7ed" : "inherit" }}>
                <td>
                  <strong>{toInputDate(item.createdAt)}</strong>
                  <br />
                  <small style={{ color: "var(--muted)" }}>
                    {new Date(item.createdAt || "").toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </td>
                <td>
                  <strong>{item.driverName}</strong>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "var(--brand-primary, #25364c)" }}>
                    {item.vehiclePlate}
                  </span>
                </td>
                <td>
                  <strong>{Number(item.odometer).toLocaleString("en-US")}</strong> كم
                </td>
                <td>
                  <Badge variant={item.oilStatus === "سليم" ? "neutral" : "bad"}>
                    {item.oilStatus}
                  </Badge>
                </td>
                <td>
                  <Badge variant={item.waterStatus === "سليم" ? "neutral" : "bad"}>
                    {item.waterStatus}
                  </Badge>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.8rem" }}>
                    <span>إطارات: {item.tiresStatus}</span>
                    <span>فرامل: {item.brakesStatus}</span>
                    <span>مكيف: {item.acStatus}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    {item.oilPhotoUrl && (
                      <button
                        type="button"
                        className="btn outline"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        onClick={() => setPreviewPhoto({ title: `صورة الزيت · ${item.vehiclePlate}`, url: item.oilPhotoUrl! })}
                      >
                        <Droplet size={12} color="#0284c7" /> الزيت
                      </button>
                    )}
                    {item.waterPhotoUrl && (
                      <button
                        type="button"
                        className="btn outline"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        onClick={() => setPreviewPhoto({ title: `صورة الماء · ${item.vehiclePlate}`, url: item.waterPhotoUrl! })}
                      >
                        <Fuel size={12} color="#06b6d4" /> الماء
                      </button>
                    )}
                    {item.odometerPhotoUrl && (
                      <button
                        type="button"
                        className="btn outline"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        onClick={() => setPreviewPhoto({ title: `صورة العداد · ${item.vehiclePlate}`, url: item.odometerPhotoUrl! })}
                      >
                        <Gauge size={12} color="#8b5cf6" /> العداد
                      </button>
                    )}
                    {item.exteriorPhotoUrl && (
                      <button
                        type="button"
                        className="btn outline"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        onClick={() => setPreviewPhoto({ title: `صورة الباص · ${item.vehiclePlate}`, url: item.exteriorPhotoUrl! })}
                      >
                        <Car size={12} color="#16a34a" /> الباص
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  {item.hasIssue ? (
                    <div style={{ color: "#b45309", fontWeight: 600, fontSize: "0.85rem" }}>
                      ⚠️ {item.issueSummary || "يوجد ملاحظات"}
                    </div>
                  ) : (
                    <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>✓ لا توجد نواقص</span>
                  )}
                  {item.notes && <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{item.notes}</div>}
                </td>
                <td>
                  <Badge variant={item.status === "تمت المراجعة" ? "neutral" : item.status === "تم تحويله للصيانة" ? "bad" : "warn"}>
                    {item.status}
                  </Badge>
                  {item.reviewedBy && (
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      بواسطة: {item.reviewedBy}
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    {item.status === "جديد" && (
                      <button
                        type="button"
                        className="btn outline"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        onClick={() => handleReview(item.id, "تمت المراجعة")}
                      >
                        <Check size={13} /> اعتماد
                      </button>
                    )}
                    {item.hasIssue && item.status !== "تم تحويله للصيانة" && (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#dc2626" }}
                        onClick={() => handleReview(item.id, "تم تحويله للصيانة")}
                      >
                        <Wrench size={13} /> تحويل للصيانة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", color: "var(--muted)", padding: "2.5rem" }}>
                  لا توجد سجلات فحص تطابق معايير التصفية المحددة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <Modal title={previewPhoto.title} onClose={() => setPreviewPhoto(null)}>
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <img
              src={previewPhoto.url}
              alt={previewPhoto.title}
              style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button type="button" className="btn ghost" onClick={() => setPreviewPhoto(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
