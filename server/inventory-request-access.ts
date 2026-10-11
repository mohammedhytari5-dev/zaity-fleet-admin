export function inventoryRequestOwnerFilter(
  viewer: { id: number; role?: string },
  canApprove: boolean,
): number | undefined {
  return viewer.role === "admin" || canApprove ? undefined : viewer.id;
}
