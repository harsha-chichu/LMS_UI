/** Rows from lms_app_settings (only the keys that matter here are read). */
type SettingRow = { key: string; value: unknown };

export const MAINTENANCE_SESSION_MESSAGE =
  "we're doing some maintenance, so new sessions are paused. you can still look around — try again soon.";
export const PAUSED_SESSION_MESSAGE = "starting new sessions is paused for a moment — please try again soon.";
export const BUDGET_SESSION_MESSAGE =
  "we've reached today's practice limit for everyone. new sessions open again tomorrow (midnight UTC) — your history is all still here.";

/** The keys the session-start check reads. */
export const SESSION_BLOCK_KEYS = ["maintenance", "sessions_paused", "budget"];

export type BudgetSetting = { enabled?: boolean; daily_usd?: number };

const get = <T>(rows: SettingRow[] | null | undefined, key: string) => rows?.find((r) => r.key === key)?.value as T | undefined;

/** The daily budget when it's switched on with a positive limit, else null. */
export function activeBudget(rows: SettingRow[] | null | undefined): { dailyUsd: number } | null {
  const b = get<BudgetSetting>(rows, "budget");
  const daily = Number(b?.daily_usd);
  return b?.enabled && Number.isFinite(daily) && daily > 0 ? { dailyUsd: daily } : null;
}

/**
 * Why a new session can't start right now, or null if it can.
 * Maintenance mode, "pause new sessions" and a used-up daily AI budget all
 * block it; everything else in the app (profile, reports, friends, settings) keeps working.
 * `spentUsdToday` is only needed when a budget is active.
 */
export function newSessionBlock(rows: SettingRow[] | null | undefined, spentUsdToday?: number | null): string | null {
  const maintenance = get<{ enabled?: boolean; message?: string }>(rows, "maintenance");
  if (maintenance?.enabled) {
    const note = maintenance.message?.trim();
    return note ? `${note} new sessions are paused until we're done.` : MAINTENANCE_SESSION_MESSAGE;
  }
  const paused = get<{ enabled?: boolean; message?: string }>(rows, "sessions_paused");
  if (paused?.enabled) return paused.message?.trim() || PAUSED_SESSION_MESSAGE;
  const budget = activeBudget(rows);
  if (budget && spentUsdToday != null && spentUsdToday >= budget.dailyUsd) return BUDGET_SESSION_MESSAGE;
  return null;
}
