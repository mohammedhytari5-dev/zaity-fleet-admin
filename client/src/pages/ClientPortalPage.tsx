import React, { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Bus,
  Send,
  CheckCircle2,
  Phone,
  Building2,
  User,
  MapPin,
  Calendar,
  Fuel,
  Users,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  Headphones,
  Check,
} from "lucide-react";

export function ClientPortalPage() {
  const [activeTab, setActiveTab] = useState<"new_rental" | "existing_client">("new_rental");
  const [submitted, setSubmitted] = useState<{ id: number; ref: string } | null>(null);

  // New Rental Form State
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("الرياض");
  const [busType, setBusType] = useState("باص 50 راكب VIP فاخر");
  const [busesCount, setBusesCount] = useState(1);
  const [duration, setDuration] = useState("شهر");
  const [startDate, setStartDate] = useState("");
  const [workNature, setWorkNature] = useState("نقل موظفين وشركات");
  const [dailyEstimatedKm, setDailyEstimatedKm] = useState(150);
  const [withDriver, setWithDriver] = useState(1);
  const [withFuel, setWithFuel] = useState(1);
  const [rentalDetails, setRentalDetails] = useState("");

  // Existing Client Form State
  const [existingServiceType, setExistingServiceType] = useState<
    "باصات إضافية" | "بلاغ عطل" | "شكوى سائق" | "إلغاء أو تعديل عقد" | "استفسار عام"
  >("باصات إضافية");
  const [existingCompanyName, setExistingCompanyName] = useState("");
  const [existingContactPerson, setExistingContactPerson] = useState("");
  const [existingPhone, setExistingPhone] = useState("");
  const [currentContractNo, setCurrentContractNo] = useState("");
  const [busPlateNumber, setBusPlateNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [existingCity, setExistingCity] = useState("الرياض");
  const [existingDetails, setExistingDetails] = useState("");

  const submitMutation = trpc.clientPortal.submit.useMutation();

  const handleRentalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim() || !phone.trim() || !city.trim()) {
      toast.error("يرجى ملء جميع الحقول الإلزامية");
      return;
    }

    try {
      const res = await submitMutation.mutateAsync({
        requestType: "استئجار باصات",
        clientType: "عميل جديد",
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        city: city.trim(),
        busType,
        busesCount: Number(busesCount) || 1,
        duration,
        startDate: startDate || null,
        workNature,
        dailyEstimatedKm: Number(dailyEstimatedKm) || 0,
        withDriver: Number(withDriver),
        withFuel: Number(withFuel),
        details: rentalDetails.trim() || null,
      });

      const refNo = `REQ-BUS-${1000 + (res?.id || 1)}`;
      setSubmitted({ id: res?.id || 1, ref: refNo });
      toast.success("تم استلام طلبكم بنجاح!");
    } catch (err: any) {
      toast.error(err.message || "تعذر إرسال الطلب، يرجى المحاولة لاحقاً");
    }
  };

  const handleExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingCompanyName.trim() || !existingContactPerson.trim() || !existingPhone.trim() || !existingDetails.trim()) {
      toast.error("يرجى ملء جميع الحقول الإلزامية وتوضيح التفاصيل");
      return;
    }

    try {
      const res = await submitMutation.mutateAsync({
        requestType: existingServiceType,
        clientType: "عميل حالي",
        companyName: existingCompanyName.trim(),
        contactPerson: existingContactPerson.trim(),
        phone: existingPhone.trim(),
        city: existingCity.trim() || "الرياض",
        currentContractNo: currentContractNo.trim() || null,
        busPlateNumber: busPlateNumber.trim() || null,
        driverName: driverName.trim() || null,
        details: existingDetails.trim(),
      });

      const refNo = `SRV-${1000 + (res?.id || 1)}`;
      setSubmitted({ id: res?.id || 1, ref: refNo });
      toast.success("تم إرسال طلبكم لمختص حسابكم بنجاح!");
    } catch (err: any) {
      toast.error(err.message || "تعذر إرسال الطلب، يرجى المحاولة لاحقاً");
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 15%, #f1f5f9 100%)",
        color: "#0f172a",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, 'Readex Pro', sans-serif",
        padding: "2rem 1rem 3rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header & Brand Banner */}
      <header
        style={{
          width: "100%",
          maxWidth: "920px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.1rem 1.75rem",
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          marginBottom: "1.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #059669 0%, #0284c7 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "1.35rem",
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
            }}
          >
            ثـ+
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
              شركة ثقة التوصيل للنقليات
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#475569", fontWeight: 500 }}>
              بوابة خدمات وتشغيل أسطول الحافلات والباصات المعتمدة
            </p>
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            background: "#ecfdf5",
            color: "#047857",
            padding: "0.45rem 0.95rem",
            borderRadius: "999px",
            fontSize: "0.82rem",
            fontWeight: 700,
            border: "1px solid #a7f3d0",
          }}
        >
          <ShieldCheck size={17} color="#059669" />
          <span>بوابة عملاء معتمدة ومباشرة</span>
        </div>
      </header>

      {/* Main Container Card */}
      <main
        style={{
          width: "100%",
          maxWidth: "920px",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #cbd5e1",
          padding: "2.25rem 2.25rem",
          boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        {submitted ? (
          /* SUCCESS SCREEN */
          <div style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#059669",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.5rem",
                boxShadow: "0 0 0 8px rgba(16, 185, 129, 0.1)",
              }}
            >
              <CheckCircle2 size={52} />
            </div>
            <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
              تم استلام طلبكم بنجاح!
            </h2>
            <p style={{ color: "#475569", fontSize: "1.05rem", maxWidth: "560px", margin: "0 auto 1.75rem", lineHeight: 1.6 }}>
              نشكركم على ثقتكم بنا. تم تسجيل طلبكم وتوجيهه مباشرة إلى فريق إدارة الحسابات والتشغيل، وسنتواصل معكم هاتفياً أو عبر الواتساب في أقرب وقت.
            </p>
            <div
              style={{
                display: "inline-block",
                background: "#f8fafc",
                border: "2px dashed #94a3b8",
                padding: "1rem 2.5rem",
                borderRadius: "14px",
                marginBottom: "2.25rem",
              }}
            >
              <span style={{ fontSize: "0.88rem", color: "#64748b", fontWeight: 600 }}>رقم المرجع للمتابعة والاستفسار:</span>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1d4ed8", letterSpacing: "1px", marginTop: "4px" }}>
                {submitted.ref}
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                style={{
                  background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "0.85rem 2.5rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(37, 99, 235, 0.3)",
                }}
              >
                تقديم طلب آخر
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Title & Intro */}
            <div style={{ marginBottom: "2rem", textAlign: "center" }}>
              <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem 0" }}>
                بوابة طلبات وخدمات العملاء
              </h1>
              <p style={{ color: "#475569", fontSize: "1rem", margin: 0, fontWeight: 500 }}>
                طلب تشغيل واستئجار باصات جديدة، أو تقديم طلبات وبلاغات العقود الحالية بكل سهولة وسرعة وبأعلى معايير الخدمة.
              </p>
            </div>

            {/* Tab Selection */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                padding: "0.4rem",
                borderRadius: "14px",
                border: "1px solid #cbd5e1",
                marginBottom: "2.25rem",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("new_rental")}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  padding: "0.95rem 1.25rem",
                  borderRadius: "10px",
                  border: activeTab === "new_rental" ? "1px solid #1d4ed8" : "1px solid transparent",
                  background: activeTab === "new_rental" ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)" : "transparent",
                  color: activeTab === "new_rental" ? "#ffffff" : "#334155",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: activeTab === "new_rental" ? "0 4px 12px rgba(37, 99, 235, 0.25)" : "none",
                }}
              >
                <Bus size={20} />
                <span>طلب استئجار وتشغيل باصات (عميل جديد / عرض سعر)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("existing_client")}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  padding: "0.95rem 1.25rem",
                  borderRadius: "10px",
                  border: activeTab === "existing_client" ? "1px solid #1d4ed8" : "1px solid transparent",
                  background: activeTab === "existing_client" ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)" : "transparent",
                  color: activeTab === "existing_client" ? "#ffffff" : "#334155",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: activeTab === "existing_client" ? "0 4px 12px rgba(37, 99, 235, 0.25)" : "none",
                }}
              >
                <Headphones size={20} />
                <span>خدمات العملاء الحاليين (باصات إضافية، أعطال، شكاوى، عقود)</span>
              </button>
            </div>

            {/* TAB 1: NEW BUS RENTAL REQUEST */}
            {activeTab === "new_rental" && (
              <form onSubmit={handleRentalSubmit}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
                    gap: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div>
                    <label style={labelStyle}>
                      اسم المنشأة / الشركة / الجهة <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="مثال: شركة المقاولات الحديثة"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      اسم مسؤول التواصل <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="مثال: أ. محمد العتيبي"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      رقم الجوال / الواتساب <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="مثال: 0501234567"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>البريد الإلكتروني (اختياري)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@company.com"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      مدينة العمل والتشغيل <span style={requiredMark}>*</span>
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="الرياض">الرياض</option>
                      <option value="جدة">جدة</option>
                      <option value="مكة المكرمة">مكة المكرمة</option>
                      <option value="المدينة المنورة">المدينة المنورة</option>
                      <option value="الدمام / الخبر">الدمام / الخبر</option>
                      <option value="الجبيل">الجبيل</option>
                      <option value="ينبع">ينبع</option>
                      <option value="أبها / خميس مشيط">أبها / خميس مشيط</option>
                      <option value="تبوك / نيوم">تبوك / نيوم</option>
                      <option value="أخرى">مدينة أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      نوع الباص المطلوب <span style={requiredMark}>*</span>
                    </label>
                    <select
                      value={busType}
                      onChange={(e) => setBusType(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="باص 50 راكب VIP فاخر">باص 50 راكب VIP فاخر</option>
                      <option value="باص 45-50 راكب سياحي">باص 45-50 راكب سياحي</option>
                      <option value="ميني باص كوستر (30 راكب)">ميني باص كوستر (30 راكب)</option>
                      <option value="فان هايس (13-15 راكب)">فان هايس (13-15 راكب)</option>
                      <option value="باص نقل عمال ومشروعات">باص نقل عمال ومشروعات</option>
                      <option value="أسطول مشكل (أنواع متعددة)">أسطول مشكل (أنواع متعددة)</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      عدد الباصات المطلوبة <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={busesCount}
                      onChange={(e) => setBusesCount(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      مدة العقد والتشغيل <span style={requiredMark}>*</span>
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="يومي / فعاليات">يومي / فعاليات</option>
                      <option value="أسبوعي">أسبوعي</option>
                      <option value="شهر">شهر واحد</option>
                      <option value="3 أشهر">3 أشهر</option>
                      <option value="6 أشهر">6 أشهر</option>
                      <option value="سنة كاملة">سنة كاملة (عقد سنوي)</option>
                      <option value="سنتين أو أكثر">سنتين أو أكثر (طويل الأجل)</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      طبيعة العمل والتشغيل <span style={requiredMark}>*</span>
                    </label>
                    <select
                      value={workNature}
                      onChange={(e) => setWorkNature(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="نقل موظفين وشركات">نقل موظفين وشركات</option>
                      <option value="نقل حجاج ومعتمرين ومواسم">نقل حجاج ومعتمرين ومواسم</option>
                      <option value="رحلات وسياحة وفعاليات">رحلات وسياحة وفعاليات</option>
                      <option value="مواقع إنشائية ومشاريع">مواقع إنشائية ومشاريع</option>
                      <option value="مدارس وجامعات">مدارس وجامعات</option>
                      <option value="أخرى">طبيعة عمل أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      المسافة التقديرية اليومية (كم) <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1500}
                      value={dailyEstimatedKm}
                      onChange={(e) => setDailyEstimatedKm(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>تاريخ بدء التشغيل المطلوب</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Driver & Fuel Options Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1.25rem",
                    background: "#f8fafc",
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: "1.5px solid #e2e8f0",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div>
                    <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.75rem" }}>
                      خدمة السائق:
                    </span>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                          border: withDriver === 1 ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                          background: withDriver === 1 ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                          fontWeight: 700,
                          color: withDriver === 1 ? "#1d4ed8" : "#334155",
                        }}
                      >
                        <input
                          type="radio"
                          name="withDriver"
                          checked={withDriver === 1}
                          onChange={() => setWithDriver(1)}
                        />
                        <span>مع سائق محترف</span>
                      </label>
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                          border: withDriver === 0 ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                          background: withDriver === 0 ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                          fontWeight: 700,
                          color: withDriver === 0 ? "#1d4ed8" : "#334155",
                        }}
                      >
                        <input
                          type="radio"
                          name="withDriver"
                          checked={withDriver === 0}
                          onChange={() => setWithDriver(0)}
                        />
                        <span>بدون سائق (تأجير)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.75rem" }}>
                      المحروقات (الديزل/البنزين):
                    </span>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                          border: withFuel === 1 ? "2px solid #059669" : "1.5px solid #cbd5e1",
                          background: withFuel === 1 ? "#ecfdf5" : "#ffffff",
                          cursor: "pointer",
                          fontWeight: 700,
                          color: withFuel === 1 ? "#047857" : "#334155",
                        }}
                      >
                        <input
                          type="radio"
                          name="withFuel"
                          checked={withFuel === 1}
                          onChange={() => setWithFuel(1)}
                        />
                        <span>شامل المحروقات</span>
                      </label>
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                          border: withFuel === 0 ? "2px solid #059669" : "1.5px solid #cbd5e1",
                          background: withFuel === 0 ? "#ecfdf5" : "#ffffff",
                          cursor: "pointer",
                          fontWeight: 700,
                          color: withFuel === 0 ? "#047857" : "#334155",
                        }}
                      >
                        <input
                          type="radio"
                          name="withFuel"
                          checked={withFuel === 0}
                          onChange={() => setWithFuel(0)}
                        />
                        <span>بدون محروقات (على العميل)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "1.75rem" }}>
                  <label style={labelStyle}>
                    ملاحظات أو مواصفات إضافية تود إضافتها
                  </label>
                  <textarea
                    rows={3}
                    value={rentalDetails}
                    onChange={(e) => setRentalDetails(e.target.value)}
                    placeholder="أي تفاصيل تخص مسارات النقل، أوقات الورديات، شروط خاصة..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem",
                    background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "14px",
                    padding: "1.1rem",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    cursor: submitMutation.isPending ? "not-allowed" : "pointer",
                    boxShadow: "0 6px 20px rgba(37, 99, 235, 0.35)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <Send size={20} />
                  <span>{submitMutation.isPending ? "جارٍ الإرسال..." : "إرسال طلب الاستئجار وتسعير الأسطول"}</span>
                </button>
              </form>
            )}

            {/* TAB 2: EXISTING CLIENT SERVICES */}
            {activeTab === "existing_client" && (
              <form onSubmit={handleExistingSubmit}>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.75rem" }}>
                    اختر نوع الخدمة أو البلاغ المطلوبة:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem" }}>
                    {(
                      [
                        { id: "باصات إضافية", label: "طلب باصات إضافية 🚌" },
                        { id: "بلاغ عطل", label: "بلاغ عطل فني في باص ⚠️" },
                        { id: "شكوى سائق", label: "شكوى أو ملاحظة على سائق 👤" },
                        { id: "إلغاء أو تعديل عقد", label: "تعديل أو إلغاء العقد 📄" },
                        { id: "استفسار عام", label: "استفسار أو طلب تواصل 💬" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setExistingServiceType(st.id)}
                        style={{
                          padding: "0.85rem 0.65rem",
                          borderRadius: "12px",
                          border: existingServiceType === st.id ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                          background: existingServiceType === st.id ? "#eff6ff" : "#ffffff",
                          color: existingServiceType === st.id ? "#1d4ed8" : "#334155",
                          fontWeight: 800,
                          fontSize: "0.88rem",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: existingServiceType === st.id ? "0 4px 10px rgba(37, 99, 235, 0.15)" : "none",
                        }}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
                    gap: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div>
                    <label style={labelStyle}>
                      اسم شركتكم المعتمدة لدينا <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={existingCompanyName}
                      onChange={(e) => setExistingCompanyName(e.target.value)}
                      placeholder="اسم الشركة المسجل في العقد"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      اسم المسؤول / المنسق <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={existingContactPerson}
                      onChange={(e) => setExistingContactPerson(e.target.value)}
                      placeholder="اسم منسق النقل أو المشرف"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      رقم الجوال للتواصل الفوري <span style={requiredMark}>*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={existingPhone}
                      onChange={(e) => setExistingPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>رقم العقد الحالي (إن وجد)</label>
                    <input
                      type="text"
                      value={currentContractNo}
                      onChange={(e) => setCurrentContractNo(e.target.value)}
                      placeholder="مثال: CON-2024-001"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>المدينة / موقع تواجد الباص</label>
                    <input
                      type="text"
                      value={existingCity}
                      onChange={(e) => setExistingCity(e.target.value)}
                      placeholder="مثال: الرياض - طريق الملك فهد"
                      style={inputStyle}
                    />
                  </div>

                  {(existingServiceType === "بلاغ عطل" || existingServiceType === "شكوى سائق") && (
                    <div>
                      <label style={labelStyle}>رقم لوحة الباص المعني</label>
                      <input
                        type="text"
                        value={busPlateNumber}
                        onChange={(e) => setBusPlateNumber(e.target.value)}
                        placeholder="مثال: أ ب ج 1234"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {existingServiceType === "شكوى سائق" && (
                    <div>
                      <label style={labelStyle}>اسم السائق (إن عُرف)</label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="اسم السائق"
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "1.75rem" }}>
                  <label style={labelStyle}>
                    تفاصيل الطلب أو المشكلة بالتحديد <span style={requiredMark}>*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={existingDetails}
                    onChange={(e) => setExistingDetails(e.target.value)}
                    placeholder="يرجى توضيح المطلوب بدقة (مكان الباص، طبيعة العطل، عدد الباصات الإضافية المطلوبة، التواريخ...)"
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem",
                    background:
                      existingServiceType === "بلاغ عطل"
                        ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                        : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "14px",
                    padding: "1.1rem",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    cursor: submitMutation.isPending ? "not-allowed" : "pointer",
                    boxShadow:
                      existingServiceType === "بلاغ عطل"
                        ? "0 6px 20px rgba(220, 38, 38, 0.35)"
                        : "0 6px 20px rgba(37, 99, 235, 0.35)",
                  }}
                >
                  <Send size={20} />
                  <span>
                    {submitMutation.isPending
                      ? "جارٍ الإرسال..."
                      : existingServiceType === "بلاغ عطل"
                      ? "إرسال بلاغ العطل العاجل ⚠️"
                      : "إرسال الطلب لمختص الحساب"}
                  </span>
                </button>
              </form>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: "2.5rem",
          textAlign: "center",
          color: "#64748b",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        © {new Date().getFullYear()} شركة ثقة التوصيل للنقليات | نظام إدارة الأساطيل الذكية. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  color: "#1e293b",
  marginBottom: "0.45rem",
  fontWeight: 700,
};

const requiredMark: React.CSSProperties = {
  color: "#dc2626",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border: "1.5px solid #cbd5e1",
  borderRadius: "10px",
  padding: "0.75rem 0.95rem",
  color: "#0f172a",
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

export default ClientPortalPage;
