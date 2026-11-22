export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

/** `?range=7|30|90` → whole UTC days ending tonight (exclusive `to`). */
export function parseRange(raw: string | string[] | undefined, now = new Date()) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  const days: RangeDays = (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const from = new Date(to.getTime() - days * 86_400_000);
  return { days, from, to };
}

/** First value of a search param. */
export function param(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function pageParam(v: string | string[] | undefined) {
  const n = Math.floor(Number(param(v)));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * The current time, for admin server components. They render once per request
 * (after reading cookies), so reading the clock there is safe.
 */
export function nowMs() {
  return Date.now();
}
