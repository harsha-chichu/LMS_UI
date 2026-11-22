import "server-only";
import { after } from "next/server";
import { errorFingerprint } from "@/lib/admin/fingerprint";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface ErrorContext {
  route?: string | null;
  userId?: string | null;
  digest?: string | null;
  details?: Record<string, unknown>;
}

function describe(err: unknown) {
  if (err instanceof Error) return { message: err.message || err.name, stack: err.stack?.split("\n").slice(0, 8).join("\n") };
  if (err && typeof err === "object" && "message" in err) return { message: String((err as { message: unknown }).message) };
  return { message: String(err) };
}

async function insert(source: string, err: unknown, ctx: ErrorContext) {
  try {
    const { message, stack } = describe(err);
    const { error } = await getSupabaseAdmin()
      .from("lms_error_events")
      .insert({
        fingerprint: errorFingerprint(source, ctx.route, message),
        source,
        route: ctx.route ?? null,
        message: message.slice(0, 2000),
        digest: ctx.digest ?? null,
        user_id: ctx.userId ?? null,
        details: { ...(ctx.details ?? {}), ...(stack ? { stack } : {}) },
      });
    if (error) console.warn("[errors] not recorded:", error.message);
  } catch (e) {
    console.warn("[errors] not recorded:", e instanceof Error ? e.message : e);
  }
}

/**
 * Records a server error for /admin/errors, after the response is sent.
 * Never throws and never slows the request down.
 */
export function logServerError(source: string, err: unknown, ctx: ErrorContext = {}) {
  if (process.env.VITEST) return;
  try {
    after(() => insert(source, err, ctx));
  } catch {
    void insert(source, err, ctx);
  }
}

/** Same, but awaited: for places with no request scope (instrumentation). */
export function logServerErrorNow(source: string, err: unknown, ctx: ErrorContext = {}) {
  if (process.env.VITEST) return Promise.resolve();
  return insert(source, err, ctx);
}
