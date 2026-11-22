import "server-only";
import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface UsageEvent {
  kind: "claude" | "agent" | "deepgram";
  operation: string;
  ok: boolean;
  latencyMs?: number;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  error?: string | null;
  userId?: string | null;
}

async function insert(e: UsageEvent) {
  try {
    const { error } = await getSupabaseAdmin()
      .from("lms_usage_events")
      .insert({
        kind: e.kind,
        operation: e.operation.slice(0, 80),
        ok: e.ok,
        latency_ms: e.latencyMs == null ? null : Math.round(e.latencyMs),
        model: e.model ?? null,
        input_tokens: e.inputTokens ?? null,
        output_tokens: e.outputTokens ?? null,
        error: e.error ? e.error.slice(0, 500) : null,
        user_id: e.userId ?? null,
      });
    if (error) console.warn("[usage] not recorded:", error.message);
  } catch (err) {
    // Missing service key (local dev, tests) or network trouble: never break the caller.
    console.warn("[usage] not recorded:", err instanceof Error ? err.message : err);
  }
}

/** Records one external call for the admin dashboard, after the response is sent. Never throws. */
export function recordUsage(e: UsageEvent) {
  if (process.env.VITEST) return;
  try {
    after(() => insert(e));
  } catch {
    // Outside a request scope: write directly.
    void insert(e);
  }
}

/** "/evaluations/3f2a…/followup" → "/evaluations/:id/followup". */
export function operationFromPath(path: string) {
  return path.split("?")[0].replace(/\/[0-9a-zA-Z_-]{16,}(?=\/|$)/g, "/:id");
}
