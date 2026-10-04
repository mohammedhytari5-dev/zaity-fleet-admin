export function isProtectedLastAdminDemotion(input: {
  targetRole: string;
  targetActive: number;
  nextRole: "user" | "admin";
  activeAdminCount: number;
}): boolean {
  return input.targetRole === "admin" && input.targetActive === 1 && input.nextRole === "user" && input.activeAdminCount <= 1;
}
