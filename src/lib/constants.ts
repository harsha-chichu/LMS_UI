import type { Difficulty, Domain, Preferences } from "@/types";

export const DOMAINS: { value: Domain; label: string; short: string }[] = [
  { value: "ai-ml", label: "AI / ML", short: "ai/ml" },
  { value: "data-science", label: "Data science", short: "data science" },
  { value: "backend", label: "Backend", short: "backend" },
  { value: "frontend", label: "Frontend", short: "frontend" },
  { value: "system-design", label: "System design", short: "system design" },
  { value: "behavioral", label: "Behavioral", short: "behavioral" },
];

/** Curated topics per domain. The fallback question bank is tagged with these. */
export const TOPICS = {
  "ai-ml": ["ml fundamentals", "deep learning", "llms & rag", "evaluation", "mlops & production", "responsible ai"],
  "data-science": ["statistics", "experimentation", "product analytics", "modeling", "causal inference"],
  backend: ["apis", "databases", "reliability", "performance", "distributed systems", "security"],
  frontend: ["javascript", "css & layout", "react & state", "performance", "accessibility", "architecture"],
  "system-design": ["fundamentals", "data & storage", "messaging & real-time", "reliability", "large-scale products"],
  behavioral: ["about you", "conflict", "failure & mistakes", "leadership & influence", "prioritization", "growth & feedback"],
} as const satisfies Record<Domain, readonly string[]>;

export type Topic<D extends Domain> = (typeof TOPICS)[D][number];

export const MAX_TOPICS = 5;
export const MAX_TOPIC_LENGTH = 40;

/** "rag, evaluation +1" — short enough for a one-line summary. */
export function topicsShort(topics: string[] | undefined, max = 2) {
  if (!topics?.length) return null;
  const shown = topics.slice(0, max).join(", ");
  return topics.length > max ? `${shown} +${topics.length - max}` : shown;
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: "fundamentals, no follow-ups",
  medium: "follow-ups when an answer is thin",
  hard: "a follow-up on every answer",
};

export const QUESTION_COUNTS = [3, 5, 8, 10];

export const DEFAULT_PREFERENCES: Preferences = {
  mode: "voice",
  difficulty: "medium",
  domain: "ai-ml",
  count: 5,
};

/** Answer content vs. delivery weighting for the final score. */
export const ANSWER_WEIGHT = 0.7;
export const COMMUNICATION_WEIGHT = 0.3;

export function domainShort(domain: Domain) {
  return DOMAINS.find((d) => d.value === domain)?.short ?? domain;
}

export function domainLabel(domain: Domain) {
  return DOMAINS.find((d) => d.value === domain)?.label ?? domain;
}
