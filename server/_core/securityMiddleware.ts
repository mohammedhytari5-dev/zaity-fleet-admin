import type { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ENV } from "./env";

/**
 * Resolves how many proxy hops Express should trust.
 *
 * Cookie `Secure`/`SameSite` decisions previously read the raw
 * `X-Forwarded-Proto` header directly, which any client can forge. Express's
 * `trust proxy` setting is the supported way to opt into that header, and it
 * only honours it for a configured number of hops.
 *
 * Defaults: one hop in production (the usual reverse-proxy/PaaS topology, e.g.
 * Render's edge proxy) and none outside it, so a local request cannot claim to
 * be HTTPS. Override with TRUST_PROXY=<hops|false|true> when the topology
 * differs.
 */
export function resolveTrustProxy(): number | boolean {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return ENV.isProduction ? 1 : false;
  if (raw === "false") return false;
  if (raw === "true") return true;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    console.warn(`[Config] Ignoring invalid TRUST_PROXY="${raw}"`);
    return ENV.isProduction ? 1 : false;
  }
  return hops;
}

/**
 * Content-Security-Policy for the production bundle.
 *
 * The app cannot use helmet's defaults: report rows render stored documents as
 * `data:` URLs (base64 payloads live in the database), and a handful of
 * components load the Google Maps script. Development is deliberately excluded
 * because Vite injects inline module scripts and opens a websocket.
 */
const productionCsp = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://maps.googleapis.com"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'", "https:"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: ENV.isProduction ? [] : null,
  },
} as const;

/**
 * Applies baseline HTTP hardening. Previously the server sent no security
 * headers at all: no CSP, no HSTS, no framing protection, no rate limiting.
 */
export function applySecurityMiddleware(app: Express): void {
  app.set("trust proxy", resolveTrustProxy());

  app.use(
    helmet({
      contentSecurityPolicy: ENV.isProduction
        ? (productionCsp as unknown as boolean | object)
        : false,
      // The API is consumed by a same-origin SPA; keep the strict default
      // cross-origin resource policy so stored documents are not embeddable
      // from other sites.
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy: { policy: "same-origin" },
    })
  );

  // Coarse ceiling for the whole API. Individual credential endpoints apply
  // much tighter limits (see the login procedure).
  app.use(
    "/api",
    rateLimit({
      windowMs: 5 * 60_000,
      limit: 1_000,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later." },
    })
  );

  // Credential and OAuth endpoints are throttled far more aggressively than the
  // rest of the API.
  app.use(
    ["/api/oauth", "/api/trpc/auth.login"],
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 50,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many authentication attempts, please try again later." },
    })
  );
}
