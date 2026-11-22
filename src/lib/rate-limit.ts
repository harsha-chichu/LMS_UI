import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/**
 * Per-user limits on the routes that cost money (LLM, eval agent, Deepgram).
 * Fixed windows, counted atomically in Postgres (lms_rate_limit, migration 0013).
 */
export const LIMITS = {
  /** Keeps one account from burning through the LLM budget. */
  session: { limit: 30, windowSec: DAY },
  /** A session needs a token per recording; this is far above honest use. */
  speechToken: { limit: 120, windowSec: HOUR },
  /** Answers and skips: 10 questions × (1 answer + 2 follow-ups) per session, with room for retries. */
  answer: { limit: 300, windowSec: HOUR },
  feedback: { limit: 20, windowSec: DAY },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Takes one unit of `name` for this user. False once the window's limit is used up. Throws on database errors. */
export async function takeRateLimit(userId: string, name: LimitName): Promise<boolean> {
  const { limit, windowSec } = LIMITS[name];
  const { data, error } = await getSupabaseAdmin().rpc("lms_rate_limit", {
    p_user: userId,
    p_bucket: name,
    p_limit: limit,
    p_window_seconds: windowSec,
  });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return data === true;
}

export function rateLimited(message = "you're going a bit fast — wait a little and try again.") {
  return Response.json({ error: message }, { status: 429 });
}
