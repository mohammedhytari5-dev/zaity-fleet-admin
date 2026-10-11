import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerApiNotFound } from "./apiRouting";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { configuredPort, resolveListenPort } from "./listen-port";
import { applySecurityMiddleware } from "./securityMiddleware";
import { assertProductionEnv, ENV, sessionSecretIssues } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

/**
 * Development servers bind to loopback by default. Combined with an explicit
 * HOST override, this keeps an accidentally exposed development instance (which
 * may be pointed at a production database) off the network. Production keeps
 * binding all interfaces, which container platforms require.
 */
function resolveListenHost(): string {
  if (process.env.HOST) return process.env.HOST;
  return ENV.isProduction ? "0.0.0.0" : "127.0.0.1";
}

async function startServer() {
  assertProductionEnv();
  const secretIssues = sessionSecretIssues();
  if (secretIssues.length) {
    console.warn(
      `[Config] ${secretIssues.join("; ")}. Session signing will fail until this is fixed.`
    );
  }

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  // Security headers, proxy trust, and rate limiting must be installed before
  // any route so they also cover the OAuth and storage handlers.
  applySecurityMiddleware(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  registerApiNotFound(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = configuredPort(process.env.PORT);
  const port = await resolveListenPort(preferredPort, process.env.NODE_ENV === "production", isPortAvailable);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const host = resolveListenHost();
  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}

startServer().catch(console.error);
