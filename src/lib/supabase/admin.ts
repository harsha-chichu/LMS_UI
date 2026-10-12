import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

// Either the legacy service_role key or the newer secret key works. Never expose it as NEXT_PUBLIC_*.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

let client: SupabaseClient | null = null;

/**
 * Service-role client for writes users aren't allowed to make themselves
 * (lms_sessions; see supabase/migrations/0004_server_only_session_writes.sql).
 * It bypasses RLS: always filter by the signed-in user's id.
 */
export function getSupabaseAdmin() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
