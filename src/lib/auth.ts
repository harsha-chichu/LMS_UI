import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServer, type SupabaseServer } from "@/lib/supabase/server";

type Authed = { ok: true; user: User; supabase: SupabaseServer };
type Unauthed = { ok: false; response: Response };

/** Route-handler guard: the verified user plus an RLS-scoped client, or a 401. */
export async function requireUser(): Promise<Authed | Unauthed> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: Response.json({ error: "sign in required" }, { status: 401 }) };
  }
  return { ok: true, user: data.user, supabase };
}
