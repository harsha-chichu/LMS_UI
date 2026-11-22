import { describe, expect, it } from "vitest";
import { hasSuggestion, missingSuggestionIndexes, patchReportSuggestion, withSuggestion } from "@/lib/admin/rescore";
import type { Evaluation, QuestionResult, Report } from "@/types";

const q = { id: "q", text: "t" };
const answer = { text: "a", mode: "text" as const, durationSec: 0 };
const evaluation = (extra: Partial<Evaluation> = {}): Evaluation => ({
  score: 6,
  feedback: "ok",
  nextTime: "more depth",
  needsFollowUp: false,
  followUp: null,
  ...extra,
});
const scored = (extra: Partial<Evaluation> = {}): QuestionResult => ({
  question: q,
  skipped: false,
  answer,
  followUps: [{ question: "why?", skipped: false, answer }],
  evaluation: evaluation(extra),
  scoring: { engine: "agent", status: "done" },
});

describe("missing suggested answers", () => {
  it("finds scored answers with no suggested answer or points", () => {
    const results: QuestionResult[] = [
      scored({ suggestedAnswer: "model answer", suggestedPoints: ["a"] }),
      scored(),
      scored({ suggestedAnswer: "  " }),
      scored({ suggestedPoints: ["only points"] }),
      { question: q, skipped: true, followUps: [] },
      { question: q, skipped: false, answer, followUps: [], scoring: { engine: "claude", status: "failed" } },
    ];
    expect(missingSuggestionIndexes(results)).toEqual([1, 2]);
    expect(hasSuggestion(results[3])).toBe(true);
  });

  it("copies only the suggestion, keeping score and feedback", () => {
    const stored = scored();
    const fresh = scored({ score: 9, feedback: "different", suggestedAnswer: " model ", suggestedPoints: ["p1", "p2"] });
    const merged = withSuggestion(stored, fresh)!;
    expect(merged.evaluation).toMatchObject({ score: 6, feedback: "ok", nextTime: "more depth", suggestedAnswer: "model", suggestedPoints: ["p1", "p2"] });
    expect(merged.scoring).toEqual(stored.scoring);
  });

  it("returns null when the fresh evaluation has no suggestion either", () => {
    expect(withSuggestion(scored(), scored())).toBeNull();
    expect(withSuggestion(scored(), { ...scored(), evaluation: undefined })).toBeNull();
  });

  it("patches only that question in the report", () => {
    const report = {
      total: 70,
      questions: [
        { text: "a", score: 6, suggestedAnswer: null, suggestedPoints: [] },
        { text: "b", score: 8, suggestedAnswer: "kept", suggestedPoints: ["k"] },
      ],
    } as unknown as Report;
    const merged = withSuggestion(scored(), scored({ suggestedAnswer: "new", suggestedPoints: ["n"] }))!;
    const out = patchReportSuggestion(report, 0, merged);
    expect(out.total).toBe(70);
    expect(out.questions[0]).toMatchObject({ score: 6, suggestedAnswer: "new", suggestedPoints: ["n"] });
    expect(out.questions[1]).toEqual(report.questions[1]);
    expect(patchReportSuggestion(report, 5, merged)).toBe(report);
  });
});
