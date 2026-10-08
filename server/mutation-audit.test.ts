import { describe, expect, it } from "vitest";
import { createMutationAuditEvent } from "./mutation-audit";

describe("automatic mutation audit events", () => {
  it("records the actor, procedure, and record id without copying submitted values", () => {
    const event = createMutationAuditEvent({
      path: "vehicles.update",
      userId: 8,
      procedureInput: { id: 24, amount: 1900, reference: "BANK-123", receiptUrl: "data:application/pdf;base64,private" },
    });
    expect(event).toEqual({
      userId: 8,
      action: "vehicles.update",
      entityType: "vehicles",
      entityId: 24,
      details: "الحقول المعدلة: المبلغ، المرجع",
    });
    expect(JSON.stringify(event)).not.toContain("private");
    expect(JSON.stringify(event)).not.toContain("1900");
  });

  it("summarizes changed field names without storing sensitive values", () => {
    const event = createMutationAuditEvent({
      path: "employees.update",
      userId: 8,
      procedureInput: { id: 2, data: { department: "الحسابات", password: "secret-value", permissions: ["finance"] } },
    });
    expect(event?.details).toBe("الحقول المعدلة: القسم، الصلاحيات");
    expect(JSON.stringify(event)).not.toContain("الحسابات");
    expect(JSON.stringify(event)).not.toContain("secret-value");
  });

  it("does not record untrusted, unscoped, or high-volume read-marker requests", () => {
    expect(createMutationAuditEvent({ path: "vehicles.update", userId: null, procedureInput: { id: 1 } })).toBeNull();
    expect(createMutationAuditEvent({ path: "audit.record", userId: 8, procedureInput: { id: 1 } })).toBeNull();
    expect(createMutationAuditEvent({ path: "notifications.markRead", userId: 8, procedureInput: { id: 1 } })).toBeNull();
    expect(createMutationAuditEvent({ path: "payables.registerPayment", userId: 8, procedureInput: { payableId: 1 } })).toBeNull();
    expect(createMutationAuditEvent({ path: "payments.create", userId: 8, procedureInput: { id: 1 } })).toBeNull();
    expect(createMutationAuditEvent({ path: "maintenance.decideApproval", userId: 8, procedureInput: { id: 1 } })).toBeNull();
  });
});
