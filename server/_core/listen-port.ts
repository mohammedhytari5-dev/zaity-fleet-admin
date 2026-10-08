export type PortAvailabilityCheck = (port: number) => Promise<boolean>;

export function configuredPort(value: string | undefined): number {
  const port = value === undefined || value.trim() === "" ? 3000 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

export async function resolveListenPort(
  preferredPort: number,
  isProduction: boolean,
  isAvailable: PortAvailabilityCheck,
): Promise<number> {
  if (isProduction) return preferredPort;
  const lastPort = Math.min(65_535, preferredPort + 19);
  for (let port = preferredPort; port <= lastPort; port++) {
    if (await isAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${preferredPort}`);
}
