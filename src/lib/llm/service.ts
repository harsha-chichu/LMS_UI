import "server-only";
import { TOPICS } from "@/lib/constants";
import { generateStructured } from "@/lib/llm/client";
import { INTERVIEWER_SYSTEM, questionsPrompt } from "@/lib/llm/prompts";
import { questionsOutput } from "@/lib/llm/schemas";
import type { Difficulty, Domain } from "@/types";

/*
 * Claude writes new interview questions. Scoring, follow-ups and the session
 * summary are the eval agent's (see sessions/engine.ts). Throws if Claude is
 * unavailable or replies with something unusable; questions/pick.ts degrades.
 */

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
    operation: "generate_questions",
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
