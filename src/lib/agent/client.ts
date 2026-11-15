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
  suggested_points?: string[];
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

/**
 * Calls the user waits on. The agent answers once its follow-up gate decides
 * (one LLM call, plus transcription for a recording sent without text) and
 * gives up at 40s itself, so this only trips when the agent is down or stuck -
 * then we fall back to Claude instead of leaving the user waiting.
 */
const INTERACTIVE_TIMEOUT_MS = 45_000;

/** One short LLM call; if the agent is slow, Claude is the better use of the wait. */
const SUMMARY_TIMEOUT_MS = 30_000;
const TOKEN = process.env.EVAL_AGENT_TOKEN;

export function agentEnabled() {
  return Boolean(BASE && TOKEN);
}

export interface AgentSummary {
  summary: string;
  strengths: string[];
  improvements: string[];
  clarity: { level: number; label: string };
  confidence: { level: number; label: string };
}

export interface SummaryRequest {
  domain: string;
  difficulty: Difficulty;
  questions: {
    question: string;
    skipped: boolean;
    answer?: { text: string; mode: string };
    followups: { question: string; answer?: { text: string; mode: string } }[];
    score?: number;
    feedback?: string;
  }[];
  metrics: { wpm: number | null; fillers_total: number; fillers_per_min: number | null; hedges: number };
}

/** End-of-session summary from the agent. Throws on failure so the caller can fall back to Claude. */
export async function summarize(input: SummaryRequest): Promise<AgentSummary> {
  if (!BASE || !TOKEN) throw new Error("eval agent not configured");
  const res = await fetch(`${BASE}/summaries`, {
    method: "POST",
    headers: { "x-agent-token": TOKEN, "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`eval agent /summaries → ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()) as AgentSummary;
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
  user_id?: string;
  userId?: string;
}) {
  const { audio, userId, user_id, ...fields } = input;
  const uid = user_id ?? userId;
  return call("/evaluations", {
    method: "POST",
    timeoutMs: INTERACTIVE_TIMEOUT_MS,
    body: form({ ...fields, ...(uid ? { user_id: uid } : {}) }, audio),
  });
}

export function answerFollowUp(
  threadId: string,
  input: { answer?: string; audio?: Blob | null; user_id?: string; userId?: string }
) {
  const uid = input.user_id ?? input.userId;
  return call(`/evaluations/${threadId}/followup`, {
    method: "POST",
    timeoutMs: INTERACTIVE_TIMEOUT_MS,
    body: form({ answer: input.answer, ...(uid ? { user_id: uid } : {}) }, input.audio),
  });
}

export function skipFollowUp(threadId: string) {
  return call(`/evaluations/${threadId}/skip-followup`, { method: "POST", timeoutMs: INTERACTIVE_TIMEOUT_MS });
}

export function getEvaluation(threadId: string) {
  return call(`/evaluations/${threadId}`, { timeoutMs: 10_000 });
}
