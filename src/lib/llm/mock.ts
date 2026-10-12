import { FALLBACK_FOLLOW_UPS, QUESTION_BANK } from "@/data/questions";
import type { ReportNarrative } from "@/lib/scoring";
import { wordCount } from "@/lib/speech-metrics";
import type { Difficulty, Domain, Evaluation, QuestionResult, SpeechMetrics } from "@/types";

/**
 * Deterministic stand-in for the LLM so the app works offline or without a key.
 * Heuristics only — good enough to exercise every screen.
 */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(items: T[]) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function mockQuestions(domain: Domain, difficulty: Difficulty, count: number, topics: string[] = []): string[] {
  // Shuffle with a fresh seed each call so repeat sessions vary.
  const pool = shuffle(QUESTION_BANK[domain][difficulty]);
  // Custom topics have no tags to match, so they're ignored here. Questions on
  // the chosen topics come first; the rest of the domain tops up the count.
  const wanted = new Set(topics.map((t) => t.toLowerCase()));
  const onTopic = pool.filter((q) => q.topics.some((t) => wanted.has(t)));
  const rest = pool.filter((q) => !onTopic.includes(q));
  return [...onTopic, ...rest].slice(0, count).map((q) => q.text);
}

const EXAMPLE_MARKERS = /\b(for example|for instance|in my (last )?(project|team|job|role)|we (built|shipped|used)|i (built|shipped|led|used)|\d+ ?(%|ms|x|users|k|m)\b)/;
const STRUCTURE_MARKERS = /\b(first|second|then|finally|trade-?off|because|so that|the reason)\b/g;

export function mockEvaluate(input: {
  difficulty: Difficulty;
  question: string;
  answer: string;
  followUp?: { question: string; answer: string };
}): Evaluation {
  const text = [input.answer, input.followUp?.answer ?? ""].join(" ").toLowerCase();
  const words = wordCount(text);
  const hasExample = EXAMPLE_MARKERS.test(text);
  const structure = Math.min((text.match(STRUCTURE_MARKERS) ?? []).length, 4);

  let score = 2 + Math.min(words / 25, 4) + structure * 0.5 + (hasExample ? 1.5 : 0);
  if (input.followUp) score += 0.5;
  score = Math.max(1, Math.min(9.6, Math.round(score * 10) / 10));

  const thin = score < 7 || !hasExample;
  const needsFollowUp =
    !input.followUp && (input.difficulty === "hard" || (input.difficulty === "medium" && thin));

  const feedback = hasExample
    ? score >= 7
      ? "clear and grounded in a real example. tighten the opening so the main point comes first."
      : "the example helps, but the core idea needs more depth and a clearer structure."
    : words < 40
      ? "too brief to show depth. name the core idea, then back it with one concrete case."
      : "the reasoning is there but stays abstract. anchor it in something you actually built.";

  const nextTime = hasExample
    ? "lead with the result, then explain how you got there."
    : "add one number or outcome from your own work to make it memorable.";

  return {
    score,
    feedback,
    nextTime,
    needsFollowUp,
    followUp: needsFollowUp ? FALLBACK_FOLLOW_UPS[hash(input.question) % FALLBACK_FOLLOW_UPS.length] : null,
  };
}

export function mockNarrative(results: QuestionResult[], metrics: SpeechMetrics): ReportNarrative {
  const scored = results.filter((r) => r.evaluation && !r.skipped);
  const avg = scored.length ? scored.reduce((s, r) => s + r.evaluation!.score, 0) / scored.length : 0;
  const skipped = results.filter((r) => r.skipped).length;

  const summary = [
    avg >= 7
      ? "you have a solid grasp of the core concepts and usually lead with the idea before the detail."
      : "you know the vocabulary, but most answers stay at the surface level.",
    "points drop when answers stay abstract — most follow-ups asked for a concrete example.",
    skipped > 0 ? `you skipped ${skipped} question${skipped === 1 ? "" : "s"}, which counted as zero.` : "",
    metrics.fillerTotal > 0 ? "filler words cluster at the start of answers." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const clarityLevel = Math.max(1, Math.min(5, Math.round(avg / 2)));
  const confidenceLevel = Math.max(1, Math.min(5, 5 - Math.floor(metrics.hedges / 2)));

  return {
    summary,
    strengths: [
      "structured answers with a clear opening",
      "correct fundamentals on the core topics",
      metrics.wpm !== null ? "comfortable pace, rarely rushed" : "concise written answers",
    ],
    improvements: [
      "anchor each answer in a real example",
      "name the trade-off before picking an option",
      "aim for a tighter close",
    ],
    clarity: { level: clarityLevel, label: clarityLevel >= 4 ? "clear" : "a bit scattered" },
    confidence: { level: confidenceLevel, label: confidenceLevel >= 4 ? "steady" : "some hedging" },
  };
}
