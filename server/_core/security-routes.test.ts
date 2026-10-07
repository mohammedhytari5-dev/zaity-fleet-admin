import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerApiNotFound } from "./apiRouting";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function registeredPaths(app: express.Express): string[] {
  return (app as any)._router.stack
    .flatMap((layer: any) => layer.route ? [layer.route.path] : []);
}

describe("security-sensitive HTTP routes", () => {
  it("does not register the mock OAuth administrator in production", () => {
    process.env.NODE_ENV = "production";
    const app = express();
    registerOAuthRoutes(app);
    expect(registeredPaths(app)).not.toContain("/api/oauth/mock");
  });

  it("keeps the mock OAuth route available outside production", () => {
    process.env.NODE_ENV = "test";
    const app = express();
    registerOAuthRoutes(app);
    expect(registeredPaths(app)).toContain("/api/oauth/mock");
  });

  it.each(["staging", "preview", undefined])("does not register mock OAuth for NODE_ENV=%s", nodeEnv => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    const app = express();
    registerOAuthRoutes(app);
    expect(registeredPaths(app)).not.toContain("/api/oauth/mock");
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
