import { describe, expect, it } from "vitest";
import { maintenanceExpenseAssignment, postedVehicleExpenses, summarizePostedVehicleExpenses } from "./vehicle-expense-summary";

describe("vehicle expense summary", () => {
  it("uses the same posted invoice policy for ledger rows and financial totals", () => {
    const expenses = [
      { vehicleId: 1, amount: 100, category: "وقود", payableId: null },
      { vehicleId: 1, amount: 200, category: "صيانة", payableId: 10 },
      { vehicleId: 1, amount: 300, category: "صيانة", payableId: 11 },
      { vehicleId: 1, amount: 400, category: "صيانة", payableId: 12 },
    ];
    const payables = [
      { id: 10, status: "معتمدة" },
      { id: 11, status: "جديدة" },
      { id: 12, status: "ملغاة" },
    ];

    const posted = postedVehicleExpenses(expenses, payables);
    expect(posted.map(expense => expense.amount)).toEqual([100, 200]);
    expect(summarizePostedVehicleExpenses(posted)).toEqual({
      categoryTotals: { وقود: 100, صيانة: 200 },
      expenseTotal: 300,
    });
  });

  it("keeps maintenance expenses assigned to the project and client at request time", () => {
    const originalAssignment = { projectId: 3, projectName: "مشروع المطار", clientId: 8, clientName: "عميل أ" };
    const currentAssignment = { projectId: 9, projectName: "مشروع جديد", clientId: 11, clientName: "عميل ب" };

    expect(maintenanceExpenseAssignment({ requestSnapshot: originalAssignment, currentVehicle: currentAssignment }))
      .toEqual(originalAssignment);
    expect(maintenanceExpenseAssignment({ currentVehicle: currentAssignment }))
      .toEqual(currentAssignment);
    expect(maintenanceExpenseAssignment({ requestSnapshot: originalAssignment, currentVehicle: currentAssignment, existingSnapshot: currentAssignment, keepExisting: true }))
      .toEqual(currentAssignment);
  });
});
