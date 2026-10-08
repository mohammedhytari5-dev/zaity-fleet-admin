import { describe, expect, it } from "vitest";
import { maintenanceEventForViewer, maintenanceRecordForViewer } from "./maintenance-access";

describe("maintenance finance visibility", () => {
  it("hides actual cost, invoice, and funding fields from operations-only users", () => {
    const record = {
      workflowStage: "تنفيذ",
      estimatedCost: 300,
      cost: "250 SAR",
      receiptUrl: "private invoice",
      fundingReference: "BANK-123",
      advanceSettlementReference: "SETTLE-456",
    };

    expect(maintenanceRecordForViewer(record, false)).toEqual({ workflowStage: "تنفيذ", estimatedCost: 300 });
    expect(maintenanceRecordForViewer(record, true)).toMatchObject({ cost: "250 SAR", fundingReference: "BANK-123" });
    expect(record.cost).toBe("250 SAR");
  });

  it("keeps operational event details but hides approval and settlement details", () => {
    const approval = { eventType: "اعتماد الصيانة · تحويل مباشر", details: "BANK-123 · المستلم: الورشة" };
    const operation = { eventType: "تغيير المرحلة", details: "بدء التنفيذ" };

    expect(maintenanceEventForViewer(approval, false).details).toBeNull();
    expect(maintenanceEventForViewer(operation, false).details).toBe("بدء التنفيذ");
    expect(maintenanceEventForViewer(approval, true).details).toBe(approval.details);
  });
});

describe("maintenance vehicle visibility", () => {
  it("hides linked vehicle identity when the viewer lacks vehicle permission", () => {
    expect(maintenanceRecordForViewer({ id: 3, vehicleId: 8, vehicle: "ABC-123", reason: "محرك" }, false, false))
      .toMatchObject({ id: 3, vehicle: "—", reason: "محرك" });
    expect(maintenanceRecordForViewer({ id: 3, vehicleId: 8, vehicle: "ABC-123" }, false, false)).not.toHaveProperty("vehicleId");
  });
});
