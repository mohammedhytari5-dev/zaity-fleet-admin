import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Modal } from "../common";
import { Cpu, Wifi, CheckCircle2, AlertTriangle, RefreshCw, Plus, Trash2 } from "lucide-react";

export function BiometricDeviceModal({
  onClose,
  onSynced,
}: {
  onClose: () => void;
  onSynced?: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: devices = [], isLoading } = trpc.attendance.devices.list.useQuery();
  const createDevice = trpc.attendance.devices.create.useMutation();
  const deleteDevice = trpc.attendance.devices.delete.useMutation();
  const syncMutation = trpc.attendance.sync.useMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("جهاز البصمة الرئيسي (ZKTeco)");
  const [ip, setIp] = useState("192.168.1.201");
  const [port, setPort] = useState("4370");
  const [commKey, setCommKey] = useState("0");
  const [location, setLocation] = useState("المدخل الرئيسي - الإدارة");
  const [model, setModel] = useState("ZKTeco BioTime / Standalone");
  const [isTesting, setIsTesting] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ip.trim()) {
      toast.error("يرجى إدخال اسم الجهاز وعنوان IP");
      return;
    }
    try {
      await createDevice.mutateAsync({
        name: name.trim(),
        ip: ip.trim(),
        port: parseInt(port, 10) || 4370,
        commKey: commKey.trim() || "0",
        location: location.trim() || "—",
        model: model.trim() || "ZKTeco Standalone",
        autoSync: 1,
      });
      void utils.attendance.devices.list.invalidate();
      toast.success("تمت إضافة جهاز البصمة بنجاح");
      setShowAdd(false);
    } catch (err: any) {
      toast.error(`تعذر إضافة الجهاز: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف إعدادات جهاز البصمة هذا؟")) return;
    try {
      await deleteDevice.mutateAsync({ id });
      void utils.attendance.devices.list.invalidate();
      toast.success("تم حذف الجهاز بنجاح");
    } catch (err: any) {
      toast.error(`تعذر حذف الجهاز: ${err.message}`);
    }
  };

  const handleTestAndSync = async (device?: any) => {
    setSyncingId(device ? device.id : 0);
    setIsTesting(true);
    try {
      const res = await syncMutation.mutateAsync({
        deviceId: device?.id,
      });
      void utils.attendance.list.invalidate();
      void utils.attendance.devices.list.invalidate();
      toast.success(`تم الاتصال بنجاح بمحرك البصمة (${res.deviceName}) ومزامنة ${res.synced} حركة`);
      if (onSynced) onSynced();
    } catch (err: any) {
      toast.error(`فشل الاتصال بجهاز البصمة: ${err.message}`);
    } finally {
      setIsTesting(false);
      setSyncingId(null);
    }
  };

  return (
    <Modal title="إعدادات وتكامل أجهزة البصمة (Biometric Devices)" onClose={onClose} wide>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ fontSize: 15, margin: 0 }}>الأجهزة المتصلة بالنظام</h3>
          <small style={{ color: "var(--muted)" }}>
            يدعم أجهزة ZKTeco، Anviz، BioTime، وبروتوكولات الشبكة TCP/IP Port 4370
          </small>
        </div>
        <button
          type="button"
          className="btn outline"
          onClick={() => setShowAdd(!showAdd)}
          style={{ height: 32, fontSize: 13 }}
        >
          <Plus size={15} /> {showAdd ? "إلغاء الإضافة" : "إضافة جهاز بصمة جديد"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="surface" style={{ padding: "1.25rem", marginBottom: "1.25rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <h4 style={{ fontSize: 14, marginBottom: "1rem", color: "var(--ink)" }}>إضافة جهاز بصمة جديد</h4>
          <div className="form-grid">
            <label className="field">
              <span>اسم الجهاز *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: بصمة بوابة السائقين" required />
            </label>
            <label className="field">
              <span>عنوان IP الجهاز في الشبكة *</span>
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="مثال: 192.168.1.201" required dir="ltr" />
            </label>
            <label className="field">
              <span>المنفذ (Port)</span>
              <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="4370" dir="ltr" />
            </label>
            <label className="field">
              <span>مفتاح الاتصال / كلمة المرور (Comm Key)</span>
              <input value={commKey} onChange={(e) => setCommKey(e.target.value)} placeholder="0" dir="ltr" />
            </label>
            <label className="field">
              <span>الموديل / النوع</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="ZKTeco K40 / SilkBio / BioTime" />
            </label>
            <label className="field">
              <span>موقع الجهاز</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="مثال: مدخل الإدارة العامة" />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}>
            <button type="button" className="btn outline" onClick={() => setShowAdd(false)}>
              إلغاء
            </button>
            <button type="submit" className="btn primary" disabled={createDevice.isPending}>
              {createDevice.isPending ? "جاري الحفظ..." : "حفظ إعدادات الجهاز"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>جاري تحميل الأجهزة...</div>
      ) : devices.length === 0 ? (
        <div className="surface" style={{ padding: "2rem", textAlign: "center", borderRadius: "10px" }}>
          <Cpu size={36} style={{ color: "var(--teal)", margin: "0 auto 10px" }} />
          <h4 style={{ margin: "0 0 6px" }}>لم يتم ربط أجهزة بصمة بعد</h4>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
            يمكنك إضافة عنوان IP لجهاز البصمة في الشبكة المحلية أو سحب الحركات التلقائية فوراً.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => handleTestAndSync()}
            disabled={isTesting}
          >
            <RefreshCw size={15} className={isTesting ? "animate-spin" : ""} />
            تفعيل جهاز البصمة الافتراضي ومزامنة الحركات الآن
          </button>
        </div>
      ) : (
        <div className="compact-list">
          {devices.map((device) => (
            <div
              key={device.id}
              className="compact-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem",
                background: "var(--surface)",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: ".6rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: device.status === "متصل" ? "#e6f8f1" : "#fff1f1",
                    color: device.status === "متصل" ? "var(--teal)" : "#e5484d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Wifi size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 14, display: "block" }}>{device.name}</strong>
                  <small style={{ color: "var(--muted)", display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span>IP: <code dir="ltr">{device.ip}:{device.port}</code></span>
                    <span>·</span>
                    <span>الموديل: {device.model || "ZKTeco"}</span>
                    <span>·</span>
                    <span>الموقع: {device.location || "—"}</span>
                  </small>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: device.status === "متصل" ? "#e6f8f1" : "#fef0e6",
                    color: device.status === "متصل" ? "var(--teal)" : "#c26300",
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={12} /> {device.status}
                </span>

                <button
                  type="button"
                  className="btn outline"
                  onClick={() => handleTestAndSync(device)}
                  disabled={syncingId === device.id}
                  style={{ height: 32, fontSize: 12, padding: "0 10px" }}
                >
                  <RefreshCw size={13} className={syncingId === device.id ? "animate-spin" : ""} />
                  {syncingId === device.id ? "جاري المزامنة..." : "مزامنة الآن"}
                </button>

                <button
                  type="button"
                  className="btn outline"
                  onClick={() => handleDelete(device.id)}
                  style={{ height: 32, width: 32, padding: 0, color: "var(--danger)" }}
                  title="حذف الجهاز"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "1.5rem", padding: "12px", background: "#f8faf9", borderRadius: "8px", border: "1px dashed #d1deda" }}>
        <h4 style={{ fontSize: 13, margin: "0 0 6px", color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
          <Cpu size={16} style={{ color: "var(--teal)" }} />
          ملاحظة الربط الشبكي (Network Integration)
        </h4>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          يدعم النظام سحب الحركات المباشرة عبر الاتصال بالـ IP على بورت 4370 أو تلقي الإشعارات اللحظية من خوادم ZKBioTime عبر الـ Webhook. كما يمكنك في أي وقت رفع ملف الحركات (DAT أو CSV) مباشرة من زر «استيراد ملف البصمة».
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
        <button type="button" className="btn outline" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}
