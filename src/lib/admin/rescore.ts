import type { QuestionResult } from "@/types";

/** Answered questions that ended up without a score (agent and Claude both failed at the time). */
export function unscoredIndexes(results: (QuestionResult | null | undefined)[]) {
  return results.flatMap((r, i) => (r && !r.skipped && r.answer && (!r.evaluation || r.scoring?.status === "failed") ? [i] : []));
}
