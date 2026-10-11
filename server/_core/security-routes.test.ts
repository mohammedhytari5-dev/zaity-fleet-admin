import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerApiNotFound } from "./apiRouting";
import { ALLOW_MOCK_OAUTH_FLAG } from "./env";

const originalNodeEnv = process.env.NODE_ENV;
const originalMockFlag = process.env[ALLOW_MOCK_OAUTH_FLAG];

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalMockFlag === undefined) delete process.env[ALLOW_MOCK_OAUTH_FLAG];
  else process.env[ALLOW_MOCK_OAUTH_FLAG] = originalMockFlag;
});

function registeredPaths(app: express.Express): string[] {
  return (app as any)._router.stack
    .flatMap((layer: any) => layer.route ? [layer.route.path] : []);
}

function mockRouteRegistered(nodeEnv: string | undefined, flag: string | undefined): boolean {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (flag === undefined) delete process.env[ALLOW_MOCK_OAUTH_FLAG];
  else process.env[ALLOW_MOCK_OAUTH_FLAG] = flag;

  const app = express();
  registerOAuthRoutes(app);
  return registeredPaths(app).includes("/api/oauth/mock");
}

describe("security-sensitive HTTP routes", () => {
  it("never registers the mock OAuth administrator in production", () => {
    // Even an explicit opt-in must not override the production guard.
    expect(mockRouteRegistered("production", "true")).toBe(false);
    expect(mockRouteRegistered("production", undefined)).toBe(false);
  });

  it("does not register the mock OAuth route from NODE_ENV alone", () => {
    // Regression guard: enabling this route merely by running in development
    // exposed a credential-free administrator session on whatever database the
    // process was pointed at.
    expect(mockRouteRegistered("development", undefined)).toBe(false);
    expect(mockRouteRegistered("test", undefined)).toBe(false);
    expect(mockRouteRegistered("staging", undefined)).toBe(false);
    expect(mockRouteRegistered(undefined, undefined)).toBe(false);
  });

  it("ignores flags other than the exact opt-in value", () => {
    expect(mockRouteRegistered("development", "1")).toBe(false);
    expect(mockRouteRegistered("development", "TRUE")).toBe(false);
    expect(mockRouteRegistered("development", "")).toBe(false);
  });

  it("registers the mock OAuth route only with an explicit non-production opt-in", () => {
    expect(mockRouteRegistered("development", "true")).toBe(true);
    expect(mockRouteRegistered("test", "true")).toBe(true);
  });

  it("requires authentication before serving stored files", async () => {
    const app = express();
    registerStorageProxy(app);
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No HTTP server address");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/manus-storage/private/test.pdf`);
      expect(response.status).toBe(401);
      expect(await response.text()).toBe("Authentication required");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("returns JSON 404 for unknown API routes instead of the SPA shell", async () => {
    const app = express();
    registerApiNotFound(app);
    app.use((_req, res) => res.status(200).send("SPA shell"));
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No HTTP server address");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/unknown`);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ error: "API route not found" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
