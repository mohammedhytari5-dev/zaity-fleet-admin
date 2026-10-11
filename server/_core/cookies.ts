import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  // `req.secure` and `req.protocol` honour the app's `trust proxy` setting, so
  // X-Forwarded-Proto is only believed for the configured number of hops.
  // Reading the raw header here previously let any client claim HTTPS and gain
  // `SameSite=None` cookies over a plaintext connection.
  return req.secure || req.protocol === "https";
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None is required for the cross-site callback flows and is
    // rejected by browsers unless Secure is also set. Local HTTP development
    // stays on Lax.
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
