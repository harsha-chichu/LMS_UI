import type { QuestionResult, Report } from "@/types";

/** Answered questions that ended up without a score (agent and Claude both failed at the time). */
export function unscoredIndexes(results: (QuestionResult | null | undefined)[]) {
  return results.flatMap((r, i) => (r && !r.skipped && r.answer && (!r.evaluation || r.scoring?.status === "failed") ? [i] : []));
}

/** A scored answer that came with a suggested answer or key points. */
export function hasSuggestion(r: QuestionResult | null | undefined) {
  return Boolean(r?.evaluation?.suggestedAnswer?.trim() || r?.evaluation?.suggestedPoints?.length);
}

/** Scored answers with no suggested answer (seen when the scorer left it out, typically after follow-ups). */
export function missingSuggestionIndexes(results: (QuestionResult | null | undefined)[]) {
  return results.flatMap((r, i) => (r && !r.skipped && r.answer && r.evaluation && !hasSuggestion(r) ? [i] : []));
}

/**
 * Copies only the suggested answer and key points from a fresh evaluation into
 * the stored one, so the user's score and feedback stay exactly as they were.
 * Returns null when the fresh evaluation has no suggestion either.
 */
export function withSuggestion(stored: QuestionResult, fresh: QuestionResult): QuestionResult | null {
  if (!stored.evaluation || !hasSuggestion(fresh)) return null;
  return {
    ...stored,
    evaluation: {
      ...stored.evaluation,
      suggestedAnswer: fresh.evaluation?.suggestedAnswer?.trim() || undefined,
      suggestedPoints: fresh.evaluation?.suggestedPoints ?? [],
      followUpAnswers: fresh.evaluation?.followUpAnswers ?? stored.evaluation.followUpAnswers,
    },
  };
}

/** The stored report with question i's suggested answer filled in (nothing else changes). */
export function patchReportSuggestion(report: Report, i: number, r: QuestionResult): Report {
  if (!report.questions?.[i]) return report;
  const questions = report.questions.map((q, j) =>
    j === i
      ? {
          ...q,
          suggestedAnswer: r.evaluation?.suggestedAnswer ?? null,
          suggestedPoints: r.evaluation?.suggestedPoints ?? [],
          followUps: q.followUps?.map((f, k) => ({ ...f, suggestedAnswer: r.evaluation?.followUpAnswers?.[k] || null })),
        }
      : q,
  );
  return { ...report, questions };
}

/**
 * PostgREST filter value for "results contains an answer whose scoring failed"
 * (jsonb containment, `results @> '[{"scoring":{"status":"failed"}}]'`).
 * Use with `.filter("results", "cs", UNSCORED_RESULTS_FILTER)`: supabase-js's
 * `.contains()` turns a JS array into a Postgres array literal, which breaks on jsonb.
 */
export const UNSCORED_RESULTS_FILTER = JSON.stringify([{ scoring: { status: "failed" } }]);
