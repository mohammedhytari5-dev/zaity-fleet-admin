import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { createMutationAuditEvent } from "../mutation-audit";
import { createAuditLog } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Database driver errors can contain the complete SQL parameters, including
    // base64 encoded attachments. Never return those details to API clients.
    if (/Failed query:|\bparams:\s|\b(?:insert into|update\s+`|delete from)\b/i.test(error.message)) {
      return {
        ...shape,
        message: "تعذر حفظ البيانات. تحقق من تحديث قاعدة البيانات ثم أعد المحاولة.",
        data: { ...shape.data, stack: undefined },
      };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const auditSuccessfulMutation = t.middleware(async opts => {
  const result = await opts.next();
  if (opts.type !== "mutation" || !result.ok) return result;
  if (result.data === false || result.data === null) return result;
  if (typeof result.data === "object" && result.data !== null && "success" in result.data && result.data.success === false) return result;
  const event = createMutationAuditEvent({
    path: opts.path,
    userId: opts.ctx.user?.id,
    procedureInput: opts.input,
  });
  if (!event) return result;
  try {
    await createAuditLog(event);
  } catch (error) {
    // The business action has already completed; report audit persistence
    // failures for operational follow-up without making clients retry it.
    console.error("[Audit] Could not record successful mutation:", error);
  }
  return result;
});

export const protectedProcedure = t.procedure.use(requireUser).use(auditSuccessfulMutation);

export const permissionProcedure = (permission: string) => t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    let permissions: string[] = [];
    try {
      permissions = JSON.parse(ctx.user.permissions || "[]");
    } catch {
      permissions = [];
    }

    if (ctx.user.role !== "admin" && !permissions.includes(permission)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
).use(auditSuccessfulMutation);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
).use(auditSuccessfulMutation);
