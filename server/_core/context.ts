import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * Caller address, resolved through the app's `trust proxy` setting.
   * `createContext` always populates it; it is optional so tests can build
   * partial contexts without restating transport details.
   */
  ip?: string;
  userAgent?: string | null;
};

/** Best-effort caller address for rate limiting and audit records. */
export function callerIp(ctx: TrpcContext): string {
  return ctx.ip ?? ctx.req?.ip ?? "unknown";
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const header = opts.req.headers["user-agent"];

  return {
    req: opts.req,
    res: opts.res,
    user,
    // req.ip honours `trust proxy`, so a spoofed X-Forwarded-For is ignored
    // unless the deployment declared its proxy topology.
    ip: opts.req.ip ?? opts.req.socket?.remoteAddress ?? "unknown",
    userAgent: typeof header === "string" ? header.slice(0, 255) : null,
  };
}
