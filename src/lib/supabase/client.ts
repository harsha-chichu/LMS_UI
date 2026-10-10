"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client; queries run as the signed-in user, scoped by RLS. */
export function getSupabase() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
