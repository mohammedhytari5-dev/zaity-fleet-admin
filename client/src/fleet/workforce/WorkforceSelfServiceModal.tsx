import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Modal,
  Field,
  FormActions,
  Badge,
  toInputDate,
} from "../common";
import {
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  User,
  Car,
  Calendar,
  Send,
  Eye,
  Plus,
  ShieldAlert,
  Fuel,
  Droplet,
  Gauge,
} from "lucide-react";
import { readUploadDataUrl, SUPPORTED_UPLOAD_ACCEPT } from "@/lib/fileUploads";
import type { Driver, EmployeeRow, Vehicle, VehicleInspectionRow, EmployeeRequestRow } from "../types";

export function WorkforceSelfServiceModal({
  onClose,
  employees,
  drivers,
  vehicles,
  initialPersonId,
  initialPersonType = "employee",
  mode = "hr",
}: {
  onClose: () => void;
  employees: EmployeeRow[];
  drivers: Driver[];
  vehicles: Vehicle[];
  initialPersonId?: number;
  initialPersonType?: "driver" | "employee";
  mode?: "hr" | "inspection" | "all";
}) {
  const [personType, setPersonType] = useState<"driver" | "employee">(initialPersonType);
  const [selectedPersonId, setSelectedPersonId] = useState<number>(() => {
    if (initialPersonId) return initialPersonId;
    if (initialPersonType === "driver" && drivers.length > 0) return drivers[0].id;
    if (employees.length > 0) return employees[0].id;
    return 1;
  });

  const selectedDriver = personType === "driver" ? drivers.find((d) => d.id === selectedPersonId) : null;
  const selectedEmployee = personType === "employee" ? employees.find((e) => e.id === selectedPersonId) : null;

  // If driver has assigned vehicle, find it
  const assignedVehicle = selectedDriver
    ? vehicles.find((v) => v.id === (selectedDriver as any).vehicleId || v.driver === selectedDriver.name || v.driverId === selectedDriver.id)
    : null;

  // Active tab inside portal:
  const isDriver = personType === "driver";
  const [activeTab, setActiveTab] = useState<"inspection" | "requests">(() => {
    if (mode === "inspection") return "inspection";
    if (mode === "hr") return "requests";
    return isDriver ? "inspection" : "requests";
  });

  // Inspection form state
  const [vehicleId, setVehicleId] = useState<number | "">(assignedVehicle?.id ?? (vehicles[0]?.id || ""));
  const [odometer, setOdometer] = useState<number>(assignedVehicle ? Number(String(assignedVehicle.mileage || "0").replace(/[^0-9]/g, "")) || 0 : 0);
  const [oilStatus, setOilStatus] = useState<"سليم" | "ناقص" | "يحتاج تغيير">("سليم");
  const [waterStatus, setWaterStatus] = useState<"سليم" | "ناقص">("سليم");
  const [tiresStatus, setTiresStatus] = useState<"ممتاز" | "يحتاج هواء" | "متضرر">("ممتاز");
  const [cleanlinessStatus, setCleanlinessStatus] = useState<"نظيف" | "متوسط" | "يحتاج غسيل">("نظيف");
  const [lightsStatus, setLightsStatus] = useState<"سليم" | "عطلان">("سليم");
  const [brakesStatus, setBrakesStatus] = useState<"سليم" | "يحتاج فحص">("سليم");
  const [acStatus, setAcStatus] = useState<"سليم" | "ضعيف" | "عطلان">("سليم");
  const [safetyKitStatus, setSafetyKitStatus] = useState<"متوفر" | "ناقص">("متوفر");
  const [inspectionNotes, setInspectionNotes] = useState("");

  // Photos
  const [oilPhoto, setOilPhoto] = useState<string | null>(null);
  const [waterPhoto, setWaterPhoto] = useState<string | null>(null);
  const [odometerPhoto, setOdometerPhoto] = useState<string | null>(null);
  const [exteriorPhoto, setExteriorPhoto] = useState<string | null>(null);

  // New Request modal state
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState<"إجازة" | "نقل كفالة" | "خروج نهائي" | "خروج وعودة" | "سلفة راتب" | "تعريف بالراتب" | "أخرى">("إجازة");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestStartDate, setRequestStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [requestEndDate, setRequestEndDate] = useState("");
  const [requestDays, setRequestDays] = useState(1);
  const [requestAmount, setRequestAmount] = useState(0);
  const [requestReason, setRequestReason] = useState("");
  const [requestAttachmentUrl, setRequestAttachmentUrl] = useState<string | null>(null);
  const [requestAttachmentName, setRequestAttachmentName] = useState("");

  // Preview modal for photos
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);

  // Queries
  const utils = trpc.useUtils();
  const inspectionsQuery = trpc.inspections.list.useQuery(
    isDriver && selectedDriver ? { driverId: selectedDriver.id } : undefined,
    { enabled: isDriver }
  );
  const requestsQuery = trpc.employeeRequests.list.useQuery(
    isDriver
      ? { driverId: selectedPersonId }
      : { employeeId: selectedPersonId }
  );

  const createInspectionMutation = trpc.inspections.create.useMutation();
  const createRequestMutation = trpc.employeeRequests.create.useMutation();

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) {
      toast.error("يرجى اختيار السائق أولاً");
      return;
    }
    const currentVeh = vehicles.find((v) => v.id === Number(vehicleId));
    if (!currentVeh) {
      toast.error("يرجى اختيار المركبة أو الباص");
      return;
    }

    const hasIssue = oilStatus !== "سليم" || waterStatus !== "سليم" || tiresStatus === "متضرر" || brakesStatus !== "سليم" || lightsStatus !== "سليم";
    const issues = [];
    if (oilStatus !== "سليم") issues.push(`الزيت: ${oilStatus}`);
    if (waterStatus !== "سليم") issues.push(`ماء الرديتر: ${waterStatus}`);
    if (tiresStatus === "متضرر") issues.push(`الإطارات: متضررة`);
    if (brakesStatus !== "سليم") issues.push(`الفرامل: تحتاج فحص`);
    if (lightsStatus !== "سليم") issues.push(`الأنوار: عطلانة`);

    try {
      await createInspectionMutation.mutateAsync({
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        vehicleId: currentVeh.id,
        vehiclePlate: currentVeh.plate,
        odometer: Number(odometer) || 0,
        oilStatus,
        waterStatus,
        tiresStatus,
        cleanlinessStatus,
        lightsStatus,
        brakesStatus,
        acStatus,
        safetyKitStatus,
        oilPhotoUrl: oilPhoto,
        waterPhotoUrl: waterPhoto,
        odometerPhotoUrl: odometerPhoto,
        exteriorPhotoUrl: exteriorPhoto,
        hasIssue: hasIssue ? 1 : 0,
        issueSummary: issues.join(" · ") || null,
        notes: inspectionNotes.trim() || null,
      });

      toast.success(
        hasIssue
          ? "تم إرسال تقرير الفحص بنجاح، وتنبيه الصيانة بالنواقص المسجلة ⚠️"
          : "تم تسجيل وتوثيق الفحص اليومي للباص بنجاح بنجاح 🟢"
      );
      // Reset photo fields
      setOilPhoto(null);
      setWaterPhoto(null);
      setOdometerPhoto(null);
      setExteriorPhoto(null);
      setInspectionNotes("");
      utils.inspections.list.invalidate();
    } catch (err: any) {
      toast.error(`تعذر حفظ تقرير الفحص: ${err.message}`);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const personName = selectedDriver ? selectedDriver.name : selectedEmployee?.name || "موظف";
    const dept = selectedEmployee?.department || "الحركة والأسطول";

    try {
      await createRequestMutation.mutateAsync({
        driverId: isDriver ? selectedPersonId : null,
        employeeId: !isDriver ? selectedPersonId : null,
        personName,
        personRole: isDriver ? "سائق" : "موظف",
        department: dept,
        requestType,
        title: requestTitle.trim() || `طلب ${requestType} - ${personName}`,
        startDate: requestType === "إجازة" || requestType === "خروج وعودة" ? requestStartDate : null,
        endDate: requestType === "إجازة" || requestType === "خروج وعودة" ? requestEndDate : null,
        days: Number(requestDays) || 0,
        amount: Number(requestAmount) || 0,
        reason: requestReason.trim() || null,
        attachmentUrl: requestAttachmentUrl,
        attachmentName: requestAttachmentName || null,
      });

      toast.success("تم إرسال طلبك بنجاح وسيتتم مراجعته من الموارد البشرية 📋");
      setIsNewRequestOpen(false);
      setRequestTitle("");
      setRequestReason("");
      setRequestAttachmentUrl(null);
      setRequestAttachmentName("");
      utils.employeeRequests.list.invalidate();
    } catch (err: any) {
      toast.error(`تعذر إرسال الطلب: ${err.message}`);
    }
  };

  const handleFileUpload = (setter: (url: string) => void, nameSetter?: (name: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readUploadDataUrl(file);
      setter(dataUrl);
      if (nameSetter) nameSetter(file.name);
      toast.success(`تم إرفاق الصورة: ${file.name}`);
    } catch (err: any) {
      toast.error(err.message || "تعذر قراءة الملف");
    }
  };

  const currentPersonName = isDriver ? selectedDriver?.name : selectedEmployee?.name;
  const currentPersonJob = isDriver ? "سائق أسطول" : selectedEmployee?.jobTitle || "موظف إداري";

  return (
    <Modal
      title={
        mode === "inspection"
          ? "تسجيل الفحص والتفقد الميداني للباص 🚌"
          : "بوابة الخدمة الذاتية للموارد البشرية (موظفين وسائقين) 📄"
      }
      onClose={onClose}
      wide
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        
        {/* Top Profile & Identity Bar */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "white",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: isDriver ? "#3b82f6" : "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "1.2rem",
              }}
            >
              {isDriver ? "🚗" : "👔"}
            </div>
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {currentPersonName || "الكادر"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", display: "flex", gap: "0.6rem" }}>
                <span>{currentPersonJob}</span>
                <span>•</span>
                <span>{isDriver ? `رقم السائق: #${selectedPersonId}` : `رقم الموظف: ${selectedEmployee?.employeeNo || selectedPersonId}`}</span>
              </div>
            </div>
          </div>

          {/* Role & Person Switcher for Testing / Admin view */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.1)", padding: "0.4rem 0.6rem", borderRadius: "8px" }}>
            <select
              value={personType}
              onChange={(e) => {
                const newType = e.target.value as "driver" | "employee";
                setPersonType(newType);
                if (newType === "driver") {
                  if (drivers.length > 0) setSelectedPersonId(drivers[0].id);
                  setActiveTab("inspection");
                } else {
                  if (employees.length > 0) setSelectedPersonId(employees[0].id);
                  setActiveTab("requests");
                }
              }}
              style={{ background: "#334155", color: "white", border: "none", borderRadius: "6px", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="driver">🚗 حساب سائق أسطول</option>
              <option value="employee">👔 حساب موظف إداري</option>
            </select>

            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(Number(e.target.value))}
              style={{ background: "#334155", color: "white", border: "none", borderRadius: "6px", padding: "0.3rem 0.6rem", fontSize: "0.85rem" }}
            >
              {isDriver
                ? drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                : employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.jobTitle})
                    </option>
                  ))}
            </select>
          </div>
        </div>

        {/* Dynamic Navigation Tabs (Only rendered if mode is 'all') */}
        {mode === "all" && (
          <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.25rem" }}>
            {isDriver && (
              <button
                onClick={() => setActiveTab("inspection")}
                style={{
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px 8px 0 0",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: activeTab === "inspection" ? "var(--brand-primary, #25364c)" : "transparent",
                  color: activeTab === "inspection" ? "white" : "var(--muted, #64748b)",
                  transition: "all 0.15s ease",
                }}
              >
                <Gauge size={17} />
                الفحص والتفقد اليومي للباص
              </button>
            )}

            <button
              onClick={() => setActiveTab("requests")}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "8px 8px 0 0",
                fontWeight: 700,
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: activeTab === "requests" ? "var(--brand-primary, #25364c)" : "transparent",
                color: activeTab === "requests" ? "white" : "var(--muted, #64748b)",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={17} />
              طلباتي والخدمات الإدارية ({requestsQuery.data?.length ?? 0})
            </button>
          </div>
        )}

        {/* TAB 1: DAILY INSPECTION (ONLY WHEN MODE IS INSPECTION OR ALL) */}
        {mode !== "hr" && (mode === "inspection" || (isDriver && activeTab === "inspection")) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Urgent Warning alert if Oil or Water is low */}
            {(oilStatus === "ناقص" || waterStatus === "ناقص") && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #f87171",
                  color: "#991b1b",
                  padding: "0.85rem 1rem",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                <ShieldAlert size={22} color="#dc2626" />
                <div>
                  <strong>⚠️ تنبيه أمني عاجل:</strong> لقد حددت وجود نقص في سوائل المحرك (الزيت / الماء). يُمنع تحريك الباص لمسافات طويلة حتى تعبئته تجنباً لتلف وتخبيط المحرك. سيتم إشعار مسؤول الحركة تلقائياً فور الإرسال.
                </div>
              </div>
            )}

            <form onSubmit={handleInspectionSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              
              {/* Vehicle Selection & Odometer */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Car size={18} color="#2563eb" /> مركبة الفحص وعداد الكيلومتر
                </h4>
                <div className="form-grid">
                  <label className="field">
                    <span>الباص أو المركبة المفحوصة *</span>
                    <select
                      value={vehicleId}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVehicleId(val);
                        const v = vehicles.find((x) => x.id === val);
                        if (v) {
                          setOdometer(Number(String(v.mileage || "0").replace(/[^0-9]/g, "")) || 0);
                        }
                      }}
                      required
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.brand} {v.model} {v.driver ? `(مع: ${v.driver})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Field
                    label="قراءة عداد الكيلومتر الحالية (KM) *"
                    type="number"
                    value={String(odometer)}
                    onChange={(v) => setOdometer(Number(v) || 0)}
                  />
                </div>
              </div>

              {/* Engine Fluids & Mandatory Photo Proofs */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Droplet size={18} color="#0284c7" /> فحص الزيت وماء الرديتر مع إرفاق الصور الإلزامية
                </h4>
                <div className="form-grid">
                  
                  {/* OIL STATUS & PHOTO */}
                  <div style={{ background: "white", padding: "0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <label className="field" style={{ marginBottom: "0.5rem" }}>
                      <span>عيار زيت المحرك *</span>
                      <select value={oilStatus} onChange={(e) => setOilStatus(e.target.value as any)}>
                        <option value="سليم">🟢 سليم (ضمن المستوى الطبيعي)</option>
                        <option value="ناقص">🔴 ناقص (يحتاج تزويد فوري)</option>
                        <option value="يحتاج تغيير">🟡 محروق / يحتاج تغيير دوري</option>
                      </select>
                    </label>

                    <div style={{ marginTop: "0.5rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
                        <Camera size={15} /> صورة لمقياس عيار الزيت:
                      </label>
                      <input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={handleFileUpload(setOilPhoto)} style={{ marginTop: "0.3rem", fontSize: "0.8rem" }} />
                      {oilPhoto && (
                        <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>✓ تم التقاط صورة الزيت</span>
                          <button type="button" className="text-link" onClick={() => setPreviewPhoto({ title: "صورة عيار الزيت", url: oilPhoto })}>
                            <Eye size={13} /> معاينة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WATER STATUS & PHOTO */}
                  <div style={{ background: "white", padding: "0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <label className="field" style={{ marginBottom: "0.5rem" }}>
                      <span>ماء الرديتر وخزان المساحات *</span>
                      <select value={waterStatus} onChange={(e) => setWaterStatus(e.target.value as any)}>
                        <option value="سليم">🟢 سليم وممتلئ</option>
                        <option value="ناقص">🔴 ناقص (يحتاج تزويد ماء)</option>
                      </select>
                    </label>

                    <div style={{ marginTop: "0.5rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
                        <Camera size={15} /> صورة لخزان ماء الرديتر:
                      </label>
                      <input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={handleFileUpload(setWaterPhoto)} style={{ marginTop: "0.3rem", fontSize: "0.8rem" }} />
                      {waterPhoto && (
                        <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>✓ تم التقاط صورة الماء</span>
                          <button type="button" className="text-link" onClick={() => setPreviewPhoto({ title: "صورة ماء الرديتر", url: waterPhoto })}>
                            <Eye size={13} /> معاينة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Safety, Tires & Body Photos */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CheckCircle2 size={18} color="#16a34a" /> فحص الإطارات والسلامة وصور الباص
                </h4>
                <div className="form-grid">
                  <label className="field">
                    <span>ضغط وحالة الإطارات</span>
                    <select value={tiresStatus} onChange={(e) => setTiresStatus(e.target.value as any)}>
                      <option value="ممتاز">🟢 ممتازة وسليمة</option>
                      <option value="يحتاج هواء">🟡 تحتاج تعبئة هواء</option>
                      <option value="متضرر">🔴 تالفة أو بها تمزق</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>نظافة الباص</span>
                    <select value={cleanlinessStatus} onChange={(e) => setCleanlinessStatus(e.target.value as any)}>
                      <option value="نظيف">🟢 نظيف تماماً</option>
                      <option value="متوسط">🟡 متوسط</option>
                      <option value="يحتاج غسيل">🔴 يحتاج غسيل داخلي/خارجي</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>الفرامل والمكابح</span>
                    <select value={brakesStatus} onChange={(e) => setBrakesStatus(e.target.value as any)}>
                      <option value="سليم">🟢 ممتازة وتستجيب</option>
                      <option value="يحتاج فحص">🔴 بها صوت أو تحتاج فحص</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>الأنوار والإشارات</span>
                    <select value={lightsStatus} onChange={(e) => setLightsStatus(e.target.value as any)}>
                      <option value="سليم">🟢 تعمل بالكامل</option>
                      <option value="عطلان">🔴 يوجد لمبة محروقة / عطل</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>المكيف والتهوية</span>
                    <select value={acStatus} onChange={(e) => setAcStatus(e.target.value as any)}>
                      <option value="سليم">🟢 يبرد بكفاءة</option>
                      <option value="ضعيف">🟡 تبريد ضعيف</option>
                      <option value="عطلان">🔴 عطلان ولا يبرد</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>طفاية الحريق وحقيبة الإسعافات</span>
                    <select value={safetyKitStatus} onChange={(e) => setSafetyKitStatus(e.target.value as any)}>
                      <option value="متوفر">🟢 متوفرة وصالحة</option>
                      <option value="ناقص">🔴 ناقصة أو منتهية الصلاحية</option>
                    </select>
                  </label>
                </div>

                {/* Body & Odometer Photos */}
                <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                  <div style={{ background: "white", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
                      <Camera size={15} /> صورة لعداد الكيلومتر (Odometer):
                    </label>
                    <input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={handleFileUpload(setOdometerPhoto)} style={{ marginTop: "0.3rem", fontSize: "0.8rem" }} />
                    {odometerPhoto && (
                      <div style={{ marginTop: "0.4rem" }}>
                        <button type="button" className="text-link" onClick={() => setPreviewPhoto({ title: "صورة عداد الكيلومتر", url: odometerPhoto })}>
                          <Eye size={13} /> معاينة الصورة
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ background: "white", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
                      <Camera size={15} /> صورة لمقدمة وجوانب الباص:
                    </label>
                    <input type="file" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={handleFileUpload(setExteriorPhoto)} style={{ marginTop: "0.3rem", fontSize: "0.8rem" }} />
                    {exteriorPhoto && (
                      <div style={{ marginTop: "0.4rem" }}>
                        <button type="button" className="text-link" onClick={() => setPreviewPhoto({ title: "صورة الباص من الخارج", url: exteriorPhoto })}>
                          <Eye size={13} /> معاينة الصورة
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <label className="field">
                    <span>ملاحظات السائق وأي أصوات غير طبيعية</span>
                    <textarea
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      rows={2}
                      placeholder="اكتب هنا أي ملاحظة أو صوت أو عطل بالباص أثناء القيادة..."
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
                <button type="submit" className="btn primary" disabled={createInspectionMutation.isPending} style={{ padding: "0.6rem 1.75rem" }}>
                  <Send size={16} /> {createInspectionMutation.isPending ? "جاري الإرسال..." : "إرسال تقرير الفحص اليومي"}
                </button>
              </div>
            </form>

            {/* Inspection History for this driver */}
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ margin: "0 0 0.75rem 0", color: "#1e293b" }}>
                سجل الفحوصات السابقة لهذا السائق ({inspectionsQuery.data?.length ?? 0})
              </h4>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>التاريخ والوقت</th>
                      <th>رقم اللوحة</th>
                      <th>العداد</th>
                      <th>الزيت</th>
                      <th>الماء</th>
                      <th>الإطارات</th>
                      <th>الصور المرفقة</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inspectionsQuery.data ?? []).map((insp) => (
                      <tr key={insp.id}>
                        <td>
                          <strong>{toInputDate(insp.createdAt)}</strong>
                        </td>
                        <td>{insp.vehiclePlate}</td>
                        <td>{insp.odometer?.toLocaleString("en-US")} كم</td>
                        <td>
                          <Badge variant={insp.oilStatus === "سليم" ? "neutral" : "bad"}>{insp.oilStatus}</Badge>
                        </td>
                        <td>
                          <Badge variant={insp.waterStatus === "سليم" ? "neutral" : "bad"}>{insp.waterStatus}</Badge>
                        </td>
                        <td>
                          <Badge variant={insp.tiresStatus === "ممتاز" ? "neutral" : "warn"}>{insp.tiresStatus}</Badge>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            {insp.oilPhotoUrl && (
                              <button type="button" className="icon-btn" title="صورة الزيت" onClick={() => setPreviewPhoto({ title: "صورة الزيت", url: insp.oilPhotoUrl! })}>
                                <Droplet size={14} color="#0284c7" />
                              </button>
                            )}
                            {insp.waterPhotoUrl && (
                              <button type="button" className="icon-btn" title="صورة الماء" onClick={() => setPreviewPhoto({ title: "صورة الماء", url: insp.waterPhotoUrl! })}>
                                <Fuel size={14} color="#06b6d4" />
                              </button>
                            )}
                            {insp.exteriorPhotoUrl && (
                              <button type="button" className="icon-btn" title="صورة الباص" onClick={() => setPreviewPhoto({ title: "صورة الباص", url: insp.exteriorPhotoUrl! })}>
                                <Car size={14} color="#3b82f6" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge variant={insp.hasIssue ? "bad" : "neutral"}>
                            {insp.hasIssue ? "⚠️ يوجد ملاحظات" : "✓ سليم"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {(inspectionsQuery.data ?? []).length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>
                          لا توجد سجلات فحص سابقة مسجلة بعد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: HR & ADMINISTRATIVE REQUESTS (FOR BOTH DRIVERS & EMPLOYEES) */}
        {mode !== "inspection" && (mode === "hr" || activeTab === "requests") && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div>
                <h4 style={{ margin: 0, color: "#1e293b" }}>طلبات الموارد البشرية والخدمة الذاتية</h4>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  يمكنك تقديم طلبات الإجازة، نقل الكفالة، الخروج النهائي، السلف، وخطابات التعريف ومتابعتها مباشرة.
                </p>
              </div>
              <button
                type="button"
                className="btn primary"
                onClick={() => setIsNewRequestOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <Plus size={16} /> تقديم طلب جديد
              </button>
            </div>

            {/* List of Requests */}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>تاريخ الطلب</th>
                    <th>نوع الطلب</th>
                    <th>عنوان الطلب والمبررات</th>
                    <th>المدة / المبلغ</th>
                    <th>المرفق</th>
                    <th>الحالة</th>
                    <th>رد الموارد البشرية</th>
                  </tr>
                </thead>
                <tbody>
                  {(requestsQuery.data ?? []).map((req) => (
                    <tr key={req.id}>
                      <td>{toInputDate(req.createdAt)}</td>
                      <td>
                        <strong style={{ color: "var(--brand-primary, #25364c)" }}>{req.requestType}</strong>
                      </td>
                      <td>
                        <div><strong>{req.title}</strong></div>
                        {req.reason && <small style={{ color: "#475569" }}>{req.reason}</small>}
                      </td>
                      <td>
                        {req.requestType === "إجازة" || req.requestType === "خروج وعودة" ? (
                          <span>{req.days} يوم ({toInputDate(req.startDate)} إلى {toInputDate(req.endDate)})</span>
                        ) : req.requestType === "سلفة راتب" ? (
                          <strong style={{ color: "#047857" }}>{Number(req.amount).toLocaleString("en-US")} SAR</strong>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td>
                        {req.attachmentUrl ? (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setPreviewPhoto({ title: req.attachmentName || "المستند المرفق", url: req.attachmentUrl! })}
                          >
                            <FileText size={14} /> {req.attachmentName || "عرض الملف"}
                          </button>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td>
                        <Badge
                          variant={
                            req.status === "معتمدة"
                              ? "neutral"
                              : req.status === "مرفوضة"
                              ? "bad"
                              : "warn"
                          }
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td>
                        {req.status === "معتمدة" ? (
                          <span style={{ color: "#16a34a", fontSize: "0.85rem", fontWeight: 600 }}>
                            اعتمدها: {req.approvedBy || "الإدارة"} ({toInputDate(req.approvedAt)})
                          </span>
                        ) : req.status === "مرفوضة" ? (
                          <span style={{ color: "#dc2626", fontSize: "0.85rem" }}>
                            السبب: {req.rejectionReason || "لم يذكر سبب"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>قيد الدراسة والمراجعة...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(requestsQuery.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>
                        لا توجد طلبات سابقة مسجلة. انقر على «تقديم طلب جديد» لرفع طلب إجازة، نقل كفالة، أو خروج نهائي.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>

      {/* NEW REQUEST SUB-MODAL */}
      {isNewRequestOpen && (
        <Modal title={`تقديم طلب جديد · ${currentPersonName}`} onClose={() => setIsNewRequestOpen(false)}>
          <form onSubmit={handleRequestSubmit}>
            <div className="form-grid single">
              
              <label className="field">
                <span>نوع الطلب *</span>
                <select
                  value={requestType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setRequestType(val);
                    if (!requestTitle) setRequestTitle(`طلب ${val} - ${currentPersonName}`);
                  }}
                  required
                >
                  <option value="إجازة">🏖️ طلب إجازة (سنوية / مرضية / طارئة)</option>
                  <option value="نقل كفالة">🔄 طلب نقل كفالة</option>
                  <option value="خروج نهائي">✈️ طلب تأشيرة خروج نهائي</option>
                  <option value="خروج وعودة">🛫 طلب تأشيرة خروج وعودة</option>
                  <option value="سلفة راتب">💵 طلب سلفة راتب شهرية</option>
                  <option value="تعريف بالراتب">📄 طلب شهادة تعريف بالراتب أو تثبيت خدمة</option>
                  <option value="أخرى">📝 طلب إداري آخر</option>
                </select>
              </label>

              <Field
                label="عنوان الطلب *"
                value={requestTitle}
                onChange={setRequestTitle}
                placeholder={`مثال: طلب ${requestType}`}
              />

              {/* Leave specific fields */}
              {(requestType === "إجازة" || requestType === "خروج وعودة") && (
                <div className="form-grid">
                  <Field
                    label="تاريخ البدء *"
                    type="date"
                    value={requestStartDate}
                    onChange={setRequestStartDate}
                  />
                  <Field
                    label="تاريخ الانتهاء *"
                    type="date"
                    value={requestEndDate}
                    onChange={setRequestEndDate}
                  />
                  <Field
                    label="عدد الأيام *"
                    type="number"
                    value={String(requestDays)}
                    onChange={(v) => setRequestDays(Number(v) || 1)}
                  />
                </div>
              )}

              {/* Salary advance specific field */}
              {requestType === "سلفة راتب" && (
                <Field
                  label="مبلغ السلفة المطلوب (SAR) *"
                  type="number"
                  value={String(requestAmount)}
                  onChange={(v) => setRequestAmount(Number(v) || 0)}
                />
              )}

              <label className="field">
                <span>المبررات والتفاصيل *</span>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  required
                  placeholder={
                    requestType === "نقل كفالة"
                      ? "أدخل اسم الكفيل الجديد، رقم السجل التجاري / الهوية، والمبررات..."
                      : requestType === "خروج نهائي"
                      ? "أدخل تاريخ السفر المتوقع وأسباب إنهاء الخدمة..."
                      : "أدخل مبررات وتفاصيل الطلب..."
                  }
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </label>

              {/* Attachment */}
              <label className="field">
                <span>إرفاق مستند أو صورة داعمة (اختياري)</span>
                <input
                  type="file"
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={handleFileUpload(setRequestAttachmentUrl, setRequestAttachmentName)}
                />
                {requestAttachmentName && (
                  <small style={{ color: "#16a34a", fontWeight: 600 }}>المرفق المختار: {requestAttachmentName}</small>
                )}
              </label>

            </div>

            <FormActions
              onCancel={() => setIsNewRequestOpen(false)}
              label="إرسال الطلب للموارد البشرية"
            />
          </form>
        </Modal>
      )}

      {/* PHOTO PREVIEW MODAL */}
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
            <button type="button" className="btn ghost" onClick={() => setPreviewPhoto(null)}>إغلاق</button>
          </div>
        </Modal>
      )}

    </Modal>
  );
}
