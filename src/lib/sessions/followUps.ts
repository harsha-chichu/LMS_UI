import type { FollowUp } from "@/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Lines up the scorer's per-follow-up suggested answers with the follow-ups on the
 * question, by question text, falling back to position. One entry per follow-up
 * ("" where there is none); undefined when the scorer gave no suggestions at all.
 */
export function alignFollowUpAnswers(
  followUps: Pick<FollowUp, "question">[],
  suggestions: { question?: string | null; answer: string }[],
): string[] | undefined {
  const usable = suggestions.map((s) => ({ key: norm(s.question ?? ""), answer: s.answer.trim() }));
  if (!followUps.length || !usable.some((s) => s.answer)) return undefined;
  const used = new Set<number>();
  const byText = followUps.map((f) => {
    const i = usable.findIndex((s, k) => !used.has(k) && s.key !== "" && s.key === norm(f.question));
    if (i >= 0) used.add(i);
    return i;
  });
  return byText.map((i, j) => {
    if (i >= 0) return usable[i].answer;
    if (j < usable.length && !used.has(j)) {
      used.add(j);
      return usable[j].answer;
    }
    return "";
  });
}
