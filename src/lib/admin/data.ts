import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Calls an lms_admin_* function with the service role. Throws on error. */
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabaseAdmin().rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

export const db = () => getSupabaseAdmin();

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** id → { email, name } for a set of user ids. */
export async function emailsFor(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  const map = new Map<string, { email: string; name: string }>();
  if (!unique.length) return map;
  const rows = await rpc<{ id: string; email: string; name: string }[]>("lms_admin_emails", { p_ids: unique });
  for (const r of rows) map.set(r.id, { email: r.email, name: r.name });
  return map;
}

export type AppSettings = {
  maintenance: { enabled: boolean; message: string };
  sessions_paused: { enabled: boolean; message: string };
};

export const DEFAULT_SETTINGS: AppSettings = {
  maintenance: { enabled: false, message: "" },
  sessions_paused: { enabled: false, message: "" },
};

/** App-wide switches from lms_app_settings, with defaults when unset or unreadable. */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const { data, error } = await getSupabaseAdmin().from("lms_app_settings").select("key, value");
    if (error) throw error;
    const out: AppSettings = structuredClone(DEFAULT_SETTINGS);
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      const key = row.key as keyof AppSettings;
      if (key in out) out[key] = { ...out[key], ...(row.value as object) };
    }
    return out;
  } catch (err) {
    console.warn("[settings] using defaults:", err instanceof Error ? err.message : err);
    return structuredClone(DEFAULT_SETTINGS);
  }
}
