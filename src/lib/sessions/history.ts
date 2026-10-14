import "server-only";
import type { ReportHistory } from "@/lib/scoring";
import type { SupabaseServer } from "@/lib/supabase/server";
import type { SessionRow } from "@/types";

/**
 * What the user scored before this session, for the report's before / after:
 * the repeated session's total on a "try again", and each bank question's most
 * recent score. Runs before the session's own attempts are recorded, so every
 * attempt found is an earlier one. Best effort: a failed lookup just means the
 * report shows no comparison.
 */
export async function loadHistory(supabase: SupabaseServer, userId: string, row: SessionRow): Promise<ReportHistory> {
  const bankIds = row.questions.map((q) => q.bankId).filter((id): id is string => Boolean(id));
  const retryOf = row.config.retryOf;

  const [previous, attempts] = await Promise.all([
    retryOf
      ? supabase
          .from("lms_sessions")
          .select("id, total")
          .eq("id", retryOf)
          .eq("user_id", userId)
          .eq("status", "completed")
          .maybeSingle()
          .then(({ data }) => (data && typeof data.total === "number" ? { sessionId: data.id as string, total: data.total } : undefined))
      : Promise.resolve(undefined),
    bankIds.length
      ? supabase
          .from("lms_question_attempts")
          .select("question_id, score, skipped, created_at")
          .in("question_id", bankIds)
          .neq("session_id", row.id)
          .order("created_at", { ascending: false })
          .limit(500)
          .then(({ data }) => (data ?? []) as { question_id: string; score: number | null; skipped: boolean }[])
      : Promise.resolve([]),
  ]).catch((err) => {
    console.warn("[history] couldn't load previous scores:", err instanceof Error ? err.message : err);
    return [undefined, []] as const;
  });

  // Newest first, so the first attempt seen per question is its latest.
  const previousScores: Record<string, number | null> = {};
  for (const a of attempts) {
    if (a.question_id in previousScores) continue;
    previousScores[a.question_id] = a.skipped || a.score == null ? null : Number(a.score);
  }
  return { previous, previousScores };
}
