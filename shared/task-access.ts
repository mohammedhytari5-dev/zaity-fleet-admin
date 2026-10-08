export type TaskAccessUser = { id: number; name?: string | null; role?: string };
export type TaskAccessRecord = { assigneeUserId?: number | null; assignee?: string | null };

export function taskAssignedToUser(task: TaskAccessRecord, user: TaskAccessUser): boolean {
  if (task.assigneeUserId != null) return task.assigneeUserId === user.id;
  return Boolean(user.name && task.assignee?.trim().toLocaleLowerCase() === user.name.trim().toLocaleLowerCase());
}

export function canUpdateTask(task: TaskAccessRecord, changes: Record<string, unknown>, user: TaskAccessUser): boolean {
  if (user.role === "admin") return true;
  if (!taskAssignedToUser(task, user)) return false;
  return Object.keys(changes).length === 1 && Object.hasOwn(changes, "status") && ["مفتوحة", "مكتملة"].includes(String(changes.status));
}
