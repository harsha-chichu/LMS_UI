import "server-only";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import { logServerError } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/admin/guard";
import { isUuid } from "@/lib/admin/data";

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Handler<C> = (args: { admin: User; request: Request; ctx: C }) => Promise<Response | object | void>;

/**
 * Wraps an admin route handler: checks access (full admin by default; pass
 * `{ write: false }` for read-only endpoints support may use) and turns thrown
 * errors into JSON responses. Returning a plain object sends it as JSON.
 */
export function adminRoute<C = unknown>(handler: Handler<C>, { write = true }: { write?: boolean } = {}) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const auth = await requireAdmin({ write });
    if (!auth.ok) return auth.response;
    try {
      const out = await handler({ admin: auth.user, request, ctx });
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof AdminError) return Response.json({ error: err.message }, { status: err.status });
      console.error("[admin]", err);
      logServerError("admin-api", err, { route: new URL(request.url).pathname, userId: auth.user.id });
      return Response.json({ error: "something went wrong — check /admin/errors" }, { status: 500 });
    }
  };
}

/** Parses the JSON body with `schema`, or throws a 400. */
export async function body<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AdminError(parsed.error.issues[0]?.message ?? "invalid request");
  return parsed.data;
}

/** Reads and validates the `[id]` route param. */
export async function idParam(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new AdminError("not found", 404);
  return id;
}

/** Throws a 400 when an admin aims a lock-out action at their own account. */
export function notSelf(admin: User, id: string) {
  if (admin.id === id) throw new AdminError("you can't do that to your own account");
}

/** Unwraps a Supabase result, throwing its error. */
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
