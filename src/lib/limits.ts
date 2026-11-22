const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/**
 * Default per-user limits on the routes that cost money (LLM, eval agent,
 * Deepgram). Admins can change them from /admin/system and give one user a
 * temporary override; see resolveLimit.
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
export const LIMIT_NAMES = Object.keys(LIMITS) as LimitName[];

export const LIMIT_LABELS: Record<LimitName, string> = {
  session: "sessions per day",
  speechToken: "transcription tokens per hour",
  answer: "answers per hour",
  feedback: "feedback messages per day",
};

export type Override = { user_id: string; bucket: string; max_count: number; expires_at: string };

/** Which limit applies: an unexpired override for this user, then the admin setting, then the default. */
export function resolveLimit(
  name: LimitName,
  userId: string,
  configured: Partial<Record<string, number>> | null | undefined,
  overrides: Override[],
  now = Date.now(),
): number {
  const own = overrides.find((o) => o.user_id === userId && o.bucket === name && new Date(o.expires_at).getTime() > now);
  if (own) return own.max_count;
  const set = configured?.[name];
  if (typeof set === "number" && Number.isFinite(set) && set >= 0) return Math.floor(set);
  return LIMITS[name].limit;
}
