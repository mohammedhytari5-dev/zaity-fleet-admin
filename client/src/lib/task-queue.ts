import { companyDateOffsetFromToday } from "@shared/date-utils";
import type { TaskRelatedEntityType } from "@shared/task-relations";

export type WorkTask = { id: number; title: string; dueAt: string; status: string; assignee?: string | null; assigneeUserId?: number | null; description?: string | null; relatedEntityType?: TaskRelatedEntityType | null; relatedEntityId?: number | null; createdAt?: string | Date | null };
export type TaskRelatedOption = { entityType: TaskRelatedEntityType; id: number; label: string };
export type WorkTaskUrgency = "متأخرة" | "اليوم" | "قادمة" | "بلا موعد" | "مكتملة" | "ملغاة";
export type WorkTaskQueueFilter = "الكل" | "متأخرة" | "اليوم" | "قادمة" | "مكتملة";

export function taskUrgency(task: Pick<WorkTask, "dueAt" | "status">, now = new Date()): WorkTaskUrgency {
  if (task.status === "مكتملة") return "مكتملة";
  if (task.status === "ملغاة") return "ملغاة";
  const offset = companyDateOffsetFromToday(task.dueAt, now);
  if (offset === null) return "بلا موعد";
  if (offset < 0) return "متأخرة";
  if (offset === 0) return "اليوم";
  return "قادمة";
}

export function orderWorkTasks<T extends WorkTask>(tasks: T[], now = new Date()): T[] {
  const priority: Record<WorkTaskUrgency, number> = { متأخرة: 0, اليوم: 1, قادمة: 2, "بلا موعد": 3, مكتملة: 4, ملغاة: 5 };
  return [...tasks].sort((a, b) => {
    const urgency = priority[taskUrgency(a, now)] - priority[taskUrgency(b, now)];
    if (urgency) return urgency;
    const aDate = companyDateOffsetFromToday(a.dueAt, now) ?? Number.MAX_SAFE_INTEGER;
    const bDate = companyDateOffsetFromToday(b.dueAt, now) ?? Number.MAX_SAFE_INTEGER;
    return aDate - bDate || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

export function filterWorkTasks<T extends WorkTask>(tasks: T[], filter: WorkTaskQueueFilter, now = new Date()): T[] {
  const visible = tasks.filter(task => task.status !== "ملغاة" && (filter === "الكل" || taskUrgency(task, now) === filter));
  return orderWorkTasks(visible, now);
}
