import "server-only";
import { LIMITS, type LimitName, type Override, resolveLimit } from "@/lib/limits";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export { LIMITS, type LimitName } from "@/lib/limits";

/**
 * Admin-set limits and per-user overrides, cached for a minute per server
 * instance so the hot paths (answers) don't pay an extra query. Changes from
 * /admin apply within a minute (immediately on the instance that saved them).
 */
const CACHE_MS = 60_000;
let cache: { at: number; configured: Partial<Record<string, number>>; overrides: Override[] } | null = null;

async function limitConfig() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const db = getSupabaseAdmin();
  const [settings, overrides] = await Promise.all([
    db.from("lms_app_settings").select("value").eq("key", "rate_limits").maybeSingle(),
    db.from("lms_rate_limit_overrides").select("user_id, bucket, max_count, expires_at").gt("expires_at", new Date().toISOString()),
  ]);
  cache = {
    at: Date.now(),
    // Missing tables (migration 0015 not run yet) just mean "use the defaults".
    configured: settings.error ? {} : ((settings.data?.value as Partial<Record<string, number>> | undefined) ?? {}),
    overrides: overrides.error ? [] : ((overrides.data ?? []) as Override[]),
  };
  return cache;
}

/** Drops the cached limits, after an admin changes them. */
export function clearLimitCache() {
  cache = null;
}

/** The limit that applies to this user right now. */
export async function limitFor(userId: string, name: LimitName) {
  const { configured, overrides } = await limitConfig();
  return resolveLimit(name, userId, configured, overrides);
}

/** Takes one unit of `name` for this user. False once the window's limit is used up. Throws on database errors. */
export async function takeRateLimit(userId: string, name: LimitName): Promise<boolean> {
  const limit = await limitFor(userId, name);
  const { data, error } = await getSupabaseAdmin().rpc("lms_rate_limit", {
    p_user: userId,
    p_bucket: name,
    p_limit: limit,
    p_window_seconds: LIMITS[name].windowSec,
  });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return data === true;
}

export function rateLimited(message = "you're going a bit fast — wait a little and try again.") {
  return Response.json({ error: message }, { status: 429 });
}
