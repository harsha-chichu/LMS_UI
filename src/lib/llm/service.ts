import "server-only";
import { TOPICS } from "@/lib/constants";
import { generateStructured } from "@/lib/llm/client";
import {
  INTERVIEWER_SYSTEM,
  evaluatePrompt,
  narrativePrompt,
  questionsPrompt,
} from "@/lib/llm/prompts";
import { evaluationOutput, narrativeOutput, questionsOutput } from "@/lib/llm/schemas";
import type { ReportNarrative } from "@/lib/scoring";
import type { Difficulty, Domain, Evaluation, QuestionResult, SpeechMetrics } from "@/types";

/*
 * Each call throws if Claude is unavailable or replies with something unusable;
 * callers decide how to degrade (see questions/pick.ts and sessions/engine.ts).
 */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface GeneratedQuestion {
  text: string;
  /** Lowercase; one of the requested topics, or of the domain's TOPICS when none were given. */
  topics: string[];
}

/** New questions, each tagged with a topic. `avoid` lists questions not to repeat. */
export async function generateQuestions(
  domain: Domain,
  difficulty: Difficulty,
  count: number,
  topics: string[] = [],
  avoid: string[] = [],
): Promise<GeneratedQuestion[]> {
  const allowed = new Set((topics.length ? topics : TOPICS[domain]).map((t) => t.trim().toLowerCase()));
  const out = await generateStructured({
    schema: questionsOutput,
    system: INTERVIEWER_SYSTEM,
    prompt: questionsPrompt(domain, difficulty, count, topics, avoid),
    effort: "low",
  });
  const qs = out.questions
    .map((q) => ({ text: q.text.trim(), topic: q.topic.trim().toLowerCase() }))
    .filter((q) => q.text)
    .map((q) => ({ text: q.text, topics: allowed.has(q.topic) ? [q.topic] : [] }));
  if (qs.length < count) throw new Error(`expected ${count} questions, got ${qs.length}`);
  return qs.slice(0, count);
}

export async function evaluateAnswer(input: {
  domain: Domain;
  difficulty: Difficulty;
  question: string;
  answer: string;
  followUp?: { question: string; answer: string };
}): Promise<Evaluation> {
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
    strengths: out.strengths.map((s) => s.trim()).filter(Boolean).slice(0, 3),
    weaknesses: out.weaknesses.map((s) => s.trim()).filter(Boolean).slice(0, 3),
    suggestedAnswer: out.suggested_answer.trim() || undefined,
    suggestedPoints: out.suggested_points.map((p) => p.trim()).filter(Boolean).slice(0, 5),
    needsFollowUp: followUp !== null,
    followUp,
  };
}

export async function writeNarrative(input: {
  domain: Domain;
  difficulty: Difficulty;
  results: QuestionResult[];
  metrics: SpeechMetrics;
}): Promise<ReportNarrative> {
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
}
