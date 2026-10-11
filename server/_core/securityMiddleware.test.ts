import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applySecurityMiddleware, resolveTrustProxy } from "./securityMiddleware";
import { ENV } from "./env";

const originalIsProduction = ENV.isProduction;
const originalTrustProxy = process.env.TRUST_PROXY;

let server: Server | undefined;
let baseUrl = "";

async function startTestApp(): Promise<void> {
  const app = express();
  applySecurityMiddleware(app);
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/api/ping", (_req, res) => res.status(200).json({ ok: true }));
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${address.port}`;
}

beforeEach(async () => {
  await startTestApp();
});

afterEach(async () => {
  ENV.isProduction = originalIsProduction;
  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = originalTrustProxy;
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server!.close(error => (error ? reject(error) : resolve()))
    );
    server = undefined;
  }
});

describe("HTTP security headers", () => {
  it("sets hardening headers on every response", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    // Previously the server sent no security headers at all.
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBeTruthy();
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });

  it("does not advertise the server implementation", async () => {
    // `app.disable("x-powered-by")` is applied alongside the middleware.
    const app = express();
    app.disable("x-powered-by");
    applySecurityMiddleware(app);
    app.get("/", (_req, res) => res.status(200).send("ok"));
    const local = createServer(app);
    await new Promise<void>(resolve => local.listen(0, "127.0.0.1", resolve));
    const address = local.address();
    if (!address || typeof address === "string") throw new Error("no address");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      expect(response.headers.get("x-powered-by")).toBeNull();
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.close(error => (error ? reject(error) : resolve()))
      );
    }
  });

  it("omits a content security policy outside production", async () => {
    // Vite injects inline module scripts and a websocket in development.
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("sends a content security policy in production", async () => {
    // A second app instance is required: the policy is chosen at setup time.
    ENV.isProduction = true;
    const app = express();
    applySecurityMiddleware(app);
    app.get("/", (_req, res) => res.status(200).send("ok"));
    const local = createServer(app);
    await new Promise<void>(resolve => local.listen(0, "127.0.0.1", resolve));
    const address = local.address();
    if (!address || typeof address === "string") throw new Error("no address");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      const csp = response.headers.get("content-security-policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.close(error => (error ? reject(error) : resolve()))
      );
    }
  });
});

describe("API rate limiting", () => {
  it("exposes rate limit headers on API routes", async () => {
    const response = await fetch(`${baseUrl}/api/ping`);
    expect(response.status).toBe(200);
    expect(
      response.headers.get("ratelimit-limit") ?? response.headers.get("ratelimit")
    ).toBeTruthy();
  });

  it("does not throttle non-API routes", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(
      response.headers.get("ratelimit-limit") ?? response.headers.get("ratelimit")
    ).toBeNull();
  });
});

describe("proxy trust resolution", () => {
  it("trusts one hop in production by default", () => {
    ENV.isProduction = true;
    delete process.env.TRUST_PROXY;
    expect(resolveTrustProxy()).toBe(1);
  });

  it("trusts nothing outside production by default", () => {
    // A local request must not be able to claim it arrived over HTTPS.
    ENV.isProduction = false;
    delete process.env.TRUST_PROXY;
    expect(resolveTrustProxy()).toBe(false);
  });

  it("honours an explicit hop count", () => {
    process.env.TRUST_PROXY = "2";
    expect(resolveTrustProxy()).toBe(2);
  });

  it("honours explicit true and false", () => {
    process.env.TRUST_PROXY = "true";
    expect(resolveTrustProxy()).toBe(true);
    process.env.TRUST_PROXY = "false";
    expect(resolveTrustProxy()).toBe(false);
  });

  it("falls back safely on an invalid value", () => {
    ENV.isProduction = false;
    process.env.TRUST_PROXY = "yes-please";
    expect(resolveTrustProxy()).toBe(false);
  });
});
