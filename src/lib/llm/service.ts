import "server-only";
import { generateStructured, llmDisabled } from "@/lib/llm/client";
import { mockEvaluate, mockNarrative, mockQuestions } from "@/lib/llm/mock";
import {
  INTERVIEWER_SYSTEM,
  evaluatePrompt,
  narrativePrompt,
  questionsPrompt,
} from "@/lib/llm/prompts";
import { evaluationOutput, narrativeOutput, questionsOutput } from "@/lib/llm/schemas";
import type { ReportNarrative } from "@/lib/scoring";
import type { Difficulty, Domain, Evaluation, QuestionResult, SpeechMetrics } from "@/types";

export type Source = "llm" | "mock";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Run the LLM path; on any failure log it and use the mock instead. */
async function withFallback<T>(label: string, llm: () => Promise<T>, mock: () => T) {
  if (llmDisabled()) return { data: mock(), source: "mock" as Source };
  try {
    return { data: await llm(), source: "llm" as Source };
  } catch (err) {
    console.warn(`[llm:${label}] falling back to mock:`, err instanceof Error ? err.message : err);
    return { data: mock(), source: "mock" as Source };
  }
}

export function generateQuestions(domain: Domain, difficulty: Difficulty, count: number) {
  return withFallback(
    "questions",
    async () => {
      const out = await generateStructured({
        schema: questionsOutput,
        system: INTERVIEWER_SYSTEM,
        prompt: questionsPrompt(domain, difficulty, count),
        effort: "low",
      });
      const qs = out.questions.map((q) => q.trim()).filter(Boolean);
      if (qs.length < count) throw new Error(`expected ${count} questions, got ${qs.length}`);
      return qs.slice(0, count);
    },
    () => mockQuestions(domain, difficulty, count),
  );
}

export function evaluateAnswer(input: {
  domain: Domain;
  difficulty: Difficulty;
  question: string;
  answer: string;
  followUp?: { question: string; answer: string };
}) {
  return withFallback<Evaluation>(
    "evaluate",
    async () => {
      const out = await generateStructured({
        schema: evaluationOutput,
        system: INTERVIEWER_SYSTEM,
        prompt: evaluatePrompt(input),
        effort: "low",
      });
      // Enforce the follow-up policy in code too; the prompt is not a guarantee.
      const allowFollowUp = !input.followUp && input.difficulty !== "easy";
      const followUp = allowFollowUp && out.needs_follow_up && out.follow_up?.trim() ? out.follow_up.trim() : null;
      return {
        score: Math.round(clamp(out.score, 0, 10) * 10) / 10,
        feedback: out.feedback.trim(),
        nextTime: out.next_time.trim(),
        needsFollowUp: followUp !== null,
        followUp,
      };
    },
    () => mockEvaluate(input),
  );
}

export function writeNarrative(input: {
  domain: Domain;
  difficulty: Difficulty;
  results: QuestionResult[];
  metrics: SpeechMetrics;
}) {
  return withFallback<ReportNarrative>(
    "report",
    async () => {
      const out = await generateStructured({
        schema: narrativeOutput,
        system: INTERVIEWER_SYSTEM,
        prompt: narrativePrompt(input),
        effort: "medium",
      });
      return {
        summary: out.summary.trim(),
        strengths: out.strengths.slice(0, 3),
        improvements: out.improvements.slice(0, 3),
        clarity: { level: Math.round(clamp(out.clarity_level, 1, 5)), label: out.clarity_label },
        confidence: { level: Math.round(clamp(out.confidence_level, 1, 5)), label: out.confidence_label },
      };
    },
    () => mockNarrative(input.results, input.metrics),
  );
}
