import "server-only";
import type { AgentCommunication, Difficulty } from "@/types";

/**
 * HTTP client for the Python eval agent (agents/eval_agent/server.py).
 * Every call throws on network or HTTP failure so callers can fall back to
 * the built-in Claude evaluator.
 */

export interface AgentEvaluationResult {
  score: number;
  is_correct: boolean;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  followup_evaluation: string | null;
  /** Older agent builds don't send this. */
  suggested_answer?: string | null;
}

export interface AgentRun {
  thread_id: string;
  status: "running" | "pending_followup" | "scoring" | "completed" | "failed";
  followup_question: string | null;
  transcript: string | null;
  communication: AgentCommunication | null;
  result: AgentEvaluationResult | null;
  error: string | null;
}

const BASE = process.env.EVAL_AGENT_URL?.replace(/\/$/, "");
const TOKEN = process.env.EVAL_AGENT_TOKEN;

export function agentEnabled() {
  return Boolean(BASE && TOKEN);
}

async function call(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<AgentRun> {
  if (!BASE || !TOKEN) throw new Error("eval agent not configured");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init.headers, "x-agent-token": TOKEN },
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs ?? 120_000),
  });
  if (!res.ok) throw new Error(`eval agent ${path} → ${res.status} ${await res.text().catch(() => "")}`);
  const run = (await res.json()) as AgentRun;
  if (run.status === "failed") throw new Error(`eval agent run failed: ${run.error ?? "unknown"}`);
  return run;
}

function form(fields: Record<string, string | undefined>, audio?: Blob | null) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value) body.set(key, value);
  if (audio) body.set("audio", audio, `answer.${audio.type.includes("mp4") ? "m4a" : "webm"}`);
  return body;
}

export function startEvaluation(input: {
  question: string;
  difficulty: Difficulty;
  domain: string;
  answer?: string;
  audio?: Blob | null;
}) {
  const { audio, ...fields } = input;
  return call("/evaluations", { method: "POST", body: form(fields, audio) });
}

export function answerFollowUp(threadId: string, input: { answer?: string; audio?: Blob | null }) {
  return call(`/evaluations/${threadId}/followup`, {
    method: "POST",
    body: form({ answer: input.answer }, input.audio),
  });
}

export function skipFollowUp(threadId: string) {
  return call(`/evaluations/${threadId}/skip-followup`, { method: "POST" });
}

export function getEvaluation(threadId: string) {
  return call(`/evaluations/${threadId}`, { timeoutMs: 10_000 });
}
