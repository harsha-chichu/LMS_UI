import type { AgentEvaluationResult } from "@/lib/agent/client";
import type { Domain, Evaluation } from "@/types";

/**
 * The agent's rubric registry knows "ai", "ml", "ai system design",
 * "ml system design" and "general". Everything else uses "general" until
 * the agent grows rubrics for those domains.
 */
const AGENT_DOMAIN: Record<Domain, string> = {
  "ai-ml": "ai",
  "data-science": "general",
  backend: "general",
  frontend: "general",
  "system-design": "general",
  behavioral: "general",
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
    strengths: result.strengths,
    weaknesses: result.weaknesses,
  };
}
