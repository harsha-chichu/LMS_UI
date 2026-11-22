import type { QuestionResult } from "@/types";

/** Answered questions that ended up without a score (agent and Claude both failed at the time). */
export function unscoredIndexes(results: (QuestionResult | null | undefined)[]) {
  return results.flatMap((r, i) => (r && !r.skipped && r.answer && (!r.evaluation || r.scoring?.status === "failed") ? [i] : []));
}

/**
 * PostgREST filter value for "results contains an answer whose scoring failed"
 * (jsonb containment, `results @> '[{"scoring":{"status":"failed"}}]'`).
 * Use with `.filter("results", "cs", UNSCORED_RESULTS_FILTER)`: supabase-js's
 * `.contains()` turns a JS array into a Postgres array literal, which breaks on jsonb.
 */
export const UNSCORED_RESULTS_FILTER = JSON.stringify([{ scoring: { status: "failed" } }]);
