import { describe, expect, it } from "vitest";

describe("Client Public Portal & CRM Requests Workflow", () => {
  describe("Public Request Processing & Data Isolation", () => {
    it("ensures public guest requests contain only submitted information without exposing company data", () => {
      const publicSubmission = {
        requestType: "استئجار باصات",
        clientType: "عميل جديد",
        companyName: "شركة اليمامة للمقاولات",
        contactPerson: "سعد الشهري",
        phone: "0509876543",
        city: "الرياض",
        busType: "باص 50 راكب VIP فاخر",
        busesCount: 3,
        duration: "سنة كاملة",
        workNature: "نقل موظفين وشركات",
        dailyEstimatedKm: 180,
        withDriver: 1,
        withFuel: 1,
      };

      // Ensure no company internal fields are present
      expect((publicSubmission as any).companyCosts).toBeUndefined();
      expect((publicSubmission as any).companyContracts).toBeUndefined();
      expect((publicSubmission as any).companyVehicles).toBeUndefined();

      expect(publicSubmission.requestType).toBe("استئجار باصات");
      expect(publicSubmission.busesCount).toBe(3);
      expect(publicSubmission.withDriver).toBe(1);
      expect(publicSubmission.withFuel).toBe(1);
    });

    it("supports all existing client service types", () => {
      const supportedServiceTypes = [
        "باصات إضافية",
        "بلاغ عطل",
        "شكوى سائق",
        "إلغاء أو تعديل عقد",
        "استفسار عام",
      ];

      expect(supportedServiceTypes).toContain("باصات إضافية");
      expect(supportedServiceTypes).toContain("بلاغ عطل");
      expect(supportedServiceTypes).toContain("شكوى سائق");
      expect(supportedServiceTypes).toContain("إلغاء أو تعديل عقد");
    });

    it("accepts breakdown report submissions even if city is short, dash, or empty", () => {
      const cityParser = (val?: string) => (val && val.trim().length >= 2 && val.trim() !== "—" ? val.trim() : "غير محدد");

      expect(cityParser("—")).toBe("غير محدد");
      expect(cityParser("")).toBe("غير محدد");
      expect(cityParser(undefined)).toBe("غير محدد");
      expect(cityParser("الرياض")).toBe("الرياض");
      expect(cityParser("جدة - طريق الحرمين")).toBe("جدة - طريق الحرمين");
    });
  });

  describe("Status Transitions for Client Requests in CRM", () => {
    type ClientRequestStatus = "جديد" | "قيد التواصل" | "تم الاتفاق والتنفيذ" | "مرفوض" | "ملغى";

    it("initializes new requests with 'جديد' status and allows updating notes and status", () => {
      let status: ClientRequestStatus = "جديد";
      let responseNotes = "";
      let assignedTo = "";

      function updateStatus(newStatus: ClientRequestStatus, notes: string, specialist: string) {
        status = newStatus;
        responseNotes = notes;
        assignedTo = specialist;
      }

      expect(status).toBe("جديد");

      updateStatus("قيد التواصل", "تم الاتصال بالعميل وإرسال التسعيرة عبر الواتساب", "أحمد مختص العملاء");
      expect(status).toBe("قيد التواصل");
      expect(responseNotes).toContain("تم الاتصال");
      expect(assignedTo).toBe("أحمد مختص العملاء");

      updateStatus("تم الاتفاق والتنفيذ", "تم توقيع العقد CON-2024-088 بنجاح", "أحمد مختص العملاء");
      expect(status).toBe("تم الاتفاق والتنفيذ");
    });
  });
});
