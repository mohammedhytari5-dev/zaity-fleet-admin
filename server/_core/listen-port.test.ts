import { describe, expect, it, vi } from "vitest";
import { configuredPort, resolveListenPort } from "./listen-port";

describe("server listen port selection", () => {
  it("uses the platform-assigned port exactly in production", async () => {
    const isAvailable = vi.fn(async () => false);
    await expect(resolveListenPort(10_000, true, isAvailable)).resolves.toBe(10_000);
    expect(isAvailable).not.toHaveBeenCalled();
  });

  it("may find a nearby free port during local development", async () => {
    const isAvailable = vi.fn(async (port: number) => port === 3002);
    await expect(resolveListenPort(3000, false, isAvailable)).resolves.toBe(3002);
    expect(isAvailable).toHaveBeenNthCalledWith(1, 3000);
    expect(isAvailable).toHaveBeenNthCalledWith(2, 3001);
    expect(isAvailable).toHaveBeenNthCalledWith(3, 3002);
  });

  it("does not scan past the valid TCP port range", async () => {
    const isAvailable = vi.fn(async () => false);
    await expect(resolveListenPort(65_534, false, isAvailable)).rejects.toThrow("No available port found");
    expect(isAvailable).toHaveBeenCalledTimes(2);
  });

  it("validates the PORT environment value", () => {
    expect(configuredPort(undefined)).toBe(3000);
    expect(configuredPort("10000")).toBe(10000);
    for (const value of ["0", "65536", "-2", "abc", "3.5"]) {
      expect(() => configuredPort(value)).toThrow("PORT must be an integer");
    }
  });
});
