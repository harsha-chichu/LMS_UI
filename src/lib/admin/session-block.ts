/** Rows from lms_app_settings (only the keys that matter here are read). */
type SettingRow = { key: string; value: unknown };

export const MAINTENANCE_SESSION_MESSAGE =
  "we're doing some maintenance, so new sessions are paused. you can still look around — try again soon.";
export const PAUSED_SESSION_MESSAGE = "starting new sessions is paused for a moment — please try again soon.";

/**
 * Why a new session can't start right now, or null if it can.
 * Maintenance mode and "pause new sessions" both block it; everything else in
 * the app (profile, reports, friends, settings) keeps working.
 */
export function newSessionBlock(rows: SettingRow[] | null | undefined): string | null {
  const get = (key: string) => rows?.find((r) => r.key === key)?.value as { enabled?: boolean; message?: string } | undefined;
  const maintenance = get("maintenance");
  if (maintenance?.enabled) {
    const note = maintenance.message?.trim();
    return note ? `${note} new sessions are paused until we're done.` : MAINTENANCE_SESSION_MESSAGE;
  }
  const paused = get("sessions_paused");
  if (paused?.enabled) return paused.message?.trim() || PAUSED_SESSION_MESSAGE;
  return null;
}
