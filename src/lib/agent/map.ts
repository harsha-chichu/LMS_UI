import type { AgentEvaluationResult, AgentSummary, SummaryRequest } from "@/lib/agent/client";
import type { ReportNarrative } from "@/lib/scoring";
import type { Difficulty, Domain, Evaluation, QuestionResult, SpeechMetrics } from "@/types";

/** The agent has a rubric for each LMS domain, under the same key (see its src/rubrics.py). */
const AGENT_DOMAIN: Record<Domain, string> = {
  "ai-ml": "ai-ml",
  "data-science": "data-science",
  backend: "backend",
  frontend: "frontend",
  "system-design": "system-design",
  behavioral: "behavioral",
  "finance-accounting": "finance-accounting",
};

export function agentDomain(domain: Domain) {
  return AGENT_DOMAIN[domain];
}

const firstSentence = (s: string) => s.match(/^[^.!?]*[.!?]/)?.[0] ?? s;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function toEvaluation(result: AgentEvaluationResult): Evaluation {
  const weakness = result.weaknesses[0];
  return {
    score: Math.round(Math.min(10, Math.max(0, result.score)) * 10) / 10,
    feedback: result.feedback,
    nextTime: weakness ? lower(firstSentence(weakness)) : "",
    needsFollowUp: false,
    followUp: null,
    suggestedAnswer: result.suggested_answer?.trim() || undefined,
    suggestedPoints: result.suggested_points?.map((p) => p.trim()).filter(Boolean).slice(0, 5),
    strengths: result.strengths,
    weaknesses: result.weaknesses,
  };
}

const MAX_SUMMARY_TEXT = 20_000;
const turn = (t: { text: string; mode: string }) => ({ text: t.text.slice(0, MAX_SUMMARY_TEXT), mode: t.mode });

/** The session as the agent's /summaries endpoint wants it. */
export function toSummaryRequest(input: {
  domain: Domain;
  difficulty: Difficulty;
  results: QuestionResult[];
  metrics: SpeechMetrics;
}): SummaryRequest {
  const { metrics: m } = input;
  return {
    domain: input.domain,
    difficulty: input.difficulty,
    questions: input.results.map((r) => ({
      question: r.question.text,
      skipped: r.skipped,
      answer: r.answer ? turn(r.answer) : undefined,
      followups: r.followUps.map((f) => ({ question: f.question, answer: f.answer ? turn(f.answer) : undefined })),
      score: r.evaluation?.score,
      feedback: r.evaluation?.feedback,
    })),
    metrics: { wpm: m.wpm, fillers_total: m.fillerTotal, fillers_per_min: m.fillersPerMin, hedges: m.hedges },
  };
}

const level = (n: number) => Math.round(Math.min(5, Math.max(1, n)));

export function toNarrative(s: AgentSummary): ReportNarrative {
  return {
    summary: s.summary.trim(),
    strengths: s.strengths.slice(0, 3),
    improvements: s.improvements.slice(0, 3),
    clarity: { level: level(s.clarity.level), label: s.clarity.label },
    confidence: { level: level(s.confidence.level), label: s.confidence.label },
  };
}
