import { describe, expect, it } from "vitest";
import { filterWorkTasks, orderWorkTasks, taskUrgency } from "../client/src/lib/task-queue";

describe("daily task queue", () => {
  const today = new Date(2026, 9, 8, 12);

  it("classifies tasks by company calendar date and status", () => {
    expect(taskUrgency({ dueAt: "2026-10-07", status: "مفتوحة" }, today)).toBe("متأخرة");
    expect(taskUrgency({ dueAt: "2026-10-08", status: "مفتوحة" }, today)).toBe("اليوم");
    expect(taskUrgency({ dueAt: "2026-10-09", status: "مفتوحة" }, today)).toBe("قادمة");
    expect(taskUrgency({ dueAt: "اليوم", status: "مفتوحة" }, today)).toBe("بلا موعد");
    expect(taskUrgency({ dueAt: "2026-10-07", status: "مكتملة" }, today)).toBe("مكتملة");
  });

  it("orders overdue open work before today's, upcoming, and completed tasks", () => {
    const tasks = [
      { id: 1, title: "مكتملة", dueAt: "2026-10-07", status: "مكتملة" },
      { id: 2, title: "غدًا", dueAt: "2026-10-09", status: "مفتوحة" },
      { id: 3, title: "متأخرة", dueAt: "2026-10-07", status: "مفتوحة" },
      { id: 4, title: "اليوم", dueAt: "2026-10-08", status: "مفتوحة" },
    ];
    expect(orderWorkTasks(tasks, today).map(task => task.id)).toEqual([3, 4, 2, 1]);
  });

  it("filters the daily queue by urgency while keeping the work priority order", () => {
    const tasks = [
      { id: 1, title: "مكتملة", dueAt: "2026-10-07", status: "مكتملة" },
      { id: 2, title: "غدًا", dueAt: "2026-10-09", status: "مفتوحة" },
      { id: 3, title: "متأخرة أ", dueAt: "2026-10-06", status: "مفتوحة" },
      { id: 4, title: "اليوم", dueAt: "2026-10-08", status: "مفتوحة" },
      { id: 5, title: "متأخرة ب", dueAt: "2026-10-07", status: "مفتوحة" },
      { id: 6, title: "ملغاة", dueAt: "2026-10-08", status: "ملغاة" },
    ];

    expect(filterWorkTasks(tasks, "متأخرة", today).map(task => task.id)).toEqual([3, 5]);
    expect(filterWorkTasks(tasks, "اليوم", today).map(task => task.id)).toEqual([4]);
    expect(filterWorkTasks(tasks, "مكتملة", today).map(task => task.id)).toEqual([1]);
    expect(filterWorkTasks(tasks, "الكل", today).map(task => task.id)).toEqual([3, 5, 4, 2, 1]);
  });
});
