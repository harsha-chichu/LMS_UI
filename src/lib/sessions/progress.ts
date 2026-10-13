import type { Question, QuestionResult } from "@/types";

/** Shared by the API (validation) and the session screen (resuming). */

export function emptyResult(question: Question): QuestionResult {
  return { question, skipped: false, followUps: [] };
}

export function pendingFollowUp(r: QuestionResult) {
  const last = r.followUps.at(-1);
  return last && !last.answer && !last.skipped ? last : undefined;
}

/** A question is resolved once it's skipped, or answered with no follow-up waiting. */
function isResolved(r: QuestionResult | undefined) {
  return !!r && (r.skipped || (!!r.answer && !pendingFollowUp(r)));
}

/** Index of the first question still needing input, or `results.length` when done. */
export function resumeIndex(results: QuestionResult[]) {
  const i = results.findIndex((r) => !isResolved(r));
  return i === -1 ? results.length : i;
}
