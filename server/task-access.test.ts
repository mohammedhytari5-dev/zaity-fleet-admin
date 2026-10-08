import { describe, expect, it } from "vitest";
import { canUpdateTask, taskAssignedToUser } from "../shared/task-access";

describe("assigned task access", () => {
  const worker = { id: 7, name: "سالم" };
  const task = { assigneeUserId: 7, assignee: "سالم" };

  it("matches an assignment to the account id and supports legacy name-only tasks", () => {
    expect(taskAssignedToUser(task, worker)).toBe(true);
    expect(taskAssignedToUser({ assignee: "سالم" }, worker)).toBe(true);
    expect(taskAssignedToUser({ assigneeUserId: 8, assignee: "سالم" }, worker)).toBe(false);
  });

  it("lets an assignee update only their status and lets administrators manage task fields", () => {
    expect(canUpdateTask(task, { status: "مكتملة" }, worker)).toBe(true);
    expect(canUpdateTask(task, { title: "مهمة أخرى" }, worker)).toBe(false);
    expect(canUpdateTask({ assigneeUserId: 8 }, { status: "مكتملة" }, worker)).toBe(false);
    expect(canUpdateTask(task, { status: "ملغاة" }, worker)).toBe(false);
    expect(canUpdateTask(task, { title: "مهمة أخرى", assigneeUserId: 8 }, { id: 1, role: "admin" })).toBe(true);
  });
});
