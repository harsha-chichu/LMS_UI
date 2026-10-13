import "server-only";
import {
  type AgentRun,
  agentEnabled,
  answerFollowUp,
  getEvaluation,
  skipFollowUp,
  startEvaluation,
} from "@/lib/agent/client";
import { agentDomain, toEvaluation } from "@/lib/agent/map";
import { evaluateAnswer, writeNarrative } from "@/lib/llm/service";
import { emptyResult as blank, pendingFollowUp } from "@/lib/sessions/progress";
import { buildReport, plainNarrative } from "@/lib/scoring";
import { computeSpeechMetrics } from "@/lib/speech-metrics";
import type { QuestionResult, Report, SessionConfig, SessionRow, Turn } from "@/types";

/**
 * Per-question scoring. The eval agent is used when configured; any agent
 * failure falls back to the built-in Claude evaluator. If Claude fails too,
 * the answer is kept unscored and retried when the session finishes.
 */

export type Target = "main" | "followup";

export class SessionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MAX_FOLLOW_UPS = 2;

function emptyResult(row: SessionRow, index: number): QuestionResult {
  return row.results[index] ?? blank(row.questions[index]);
}

function warn(label: string, err: unknown) {
  console.warn(`[agent:${label}] falling back to claude:`, err instanceof Error ? err.message : err);
}

/**
 * Score with Claude using the main answer plus the latest answered follow-up,
 * and record the outcome on `r`. Returns the evaluation, or null if Claude failed.
 */
async function claudeScore(config: SessionConfig, r: QuestionResult, allowFollowUp: boolean) {
  const answered = [...r.followUps].reverse().find((f) => f.answer);
  try {
    const data = await evaluateAnswer({
      domain: config.domain,
      difficulty: config.difficulty,
      question: r.question.text,
      answer: r.answer!.text,
      followUp: answered ? { question: answered.question, answer: answered.answer!.text } : undefined,
    });
    r.evaluation = allowFollowUp ? data : { ...data, needsFollowUp: false, followUp: null };
    r.scoring = { engine: "claude", status: "done" };
    return r.evaluation;
  } catch (err) {
    console.warn("[claude:evaluate] scoring failed:", err instanceof Error ? err.message : err);
    // A score Claude already gave the main answer still stands; otherwise it's unscored for now.
    if (!(r.evaluation && r.scoring?.engine === "claude")) {
      r.evaluation = undefined;
      r.scoring = { engine: "claude", status: "failed" };
    }
    return null;
  }
}

/** Fold an agent response into the result (transcript, follow-up, scoring state). */
function applyAgentRun(r: QuestionResult, run: AgentRun, turn: Turn, target: Target): QuestionResult {
  const answered: Turn = {
    ...turn,
    // The agent's Gemini transcript is more faithful than the browser's live one.
    text: run.transcript?.trim() || turn.text,
    communication: target === "main" ? run.communication : turn.communication,
  };
  const next: QuestionResult =
    target === "main"
      ? { ...r, answer: answered }
      : { ...r, followUps: r.followUps.map((f, i, all) => (i === all.length - 1 ? { ...f, answer: answered } : f)) };

  next.scoring = { engine: "agent", status: "pending", threadId: run.thread_id };
  if (run.status === "pending_followup" && run.followup_question) {
    next.followUps = [...next.followUps, { question: run.followup_question, skipped: false }];
  }
  if (run.status === "completed" && run.result) {
    next.evaluation = toEvaluation(run.result);
    next.scoring.status = "done";
  }
  return next;
}

export async function submitAnswer(
  row: SessionRow,
  index: number,
  target: Target,
  turn: Turn,
  audio: Blob | null,
): Promise<QuestionResult> {
  const r = emptyResult(row, index);
  const { config } = row;

  if (target === "main" && (r.answer || r.skipped)) throw new SessionError("question already answered", 409);
  const followUp = pendingFollowUp(r);
  if (target === "followup" && (!r.answer || !followUp)) throw new SessionError("no follow-up waiting", 409);
  if (!turn.text && !(audio && r.scoring?.engine !== "claude" && agentEnabled())) {
    throw new SessionError("we didn't catch an answer — try again or type it", 422);
  }

  // ---- eval agent ----
  const useAgent = agentEnabled() && (target === "main" || r.scoring?.engine === "agent");
  if (useAgent) {
    try {
      const run =
        target === "main"
          ? await startEvaluation({
              question: r.question.text,
              difficulty: config.difficulty,
              domain: agentDomain(config.domain),
              answer: turn.text,
              audio,
            })
          : await answerFollowUp(r.scoring!.threadId!, { answer: turn.text, audio });
      return applyAgentRun(r, run, turn, target);
    } catch (err) {
      warn("answer", err);
      if (!turn.text) throw new SessionError("the evaluator couldn't process your recording — try again or type it", 502);
    }
  }

  // ---- Claude fallback ----
  const next: QuestionResult =
    target === "main"
      ? { ...r, answer: turn }
      : { ...r, followUps: r.followUps.map((f, i, all) => (i === all.length - 1 ? { ...f, answer: turn } : f)) };
  const evaluation = await claudeScore(config, next, target === "main");
  if (target === "main" && evaluation?.needsFollowUp && evaluation.followUp && next.followUps.length < MAX_FOLLOW_UPS) {
    next.followUps = [...next.followUps, { question: evaluation.followUp, skipped: false }];
  }
  return next;
}

export async function skip(row: SessionRow, index: number, target: Target): Promise<QuestionResult> {
  const r = emptyResult(row, index);
  if (target === "main") {
    if (r.answer) throw new SessionError("question already answered", 409);
    return { ...r, skipped: true, scoring: undefined, evaluation: undefined };
  }

  if (!pendingFollowUp(r)) throw new SessionError("no follow-up waiting", 409);
  const next: QuestionResult = {
    ...r,
    followUps: r.followUps.map((f, i, all) => (i === all.length - 1 ? { ...f, skipped: true } : f)),
  };
  if (r.scoring?.engine === "agent" && r.scoring.threadId) {
    try {
      await skipFollowUp(r.scoring.threadId);
      return next; // agent keeps scoring in the background
    } catch (err) {
      warn("skip", err);
    }
  }
  // Claude already scored the main answer; on agent failure, score it now.
  if (r.scoring?.engine !== "claude" || !r.evaluation) await claudeScore(row.config, next, false);
  return next;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for background agent scoring, then fall back to Claude for anything left. */
async function settleScores(row: SessionRow, results: QuestionResult[], timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let pending = results.filter((r) => !r.skipped && r.answer && r.scoring?.engine === "agent" && r.scoring.status !== "done");

  while (pending.length && Date.now() < deadline) {
    await Promise.all(
      pending.map(async (r) => {
        try {
          const run = await getEvaluation(r.scoring!.threadId!);
          if (run.status === "completed" && run.result) {
            r.evaluation = toEvaluation(run.result);
            r.scoring = { ...r.scoring!, status: "done" };
          }
        } catch (err) {
          warn("poll", err);
          r.scoring = { ...r.scoring!, status: "failed" };
        }
      }),
    );
    pending = pending.filter((r) => r.scoring?.status === "pending");
    if (pending.length) await sleep(2000);
  }

  for (const r of results) {
    if (!r.skipped && r.answer && (!r.evaluation || r.scoring?.status !== "done")) {
      await claudeScore(row.config, r, false);
    }
  }
}

export async function finalize(row: SessionRow): Promise<{ results: QuestionResult[]; report: Report }> {
  // Unanswered questions at the end count as skipped.
  const results = row.questions.map((_, i) => {
    const r = structuredClone(emptyResult(row, i));
    if (!r.answer && !r.skipped) r.skipped = true;
    r.followUps = r.followUps.map((f) => (f.answer || f.skipped ? f : { ...f, skipped: true }));
    return r;
  });

  await settleScores(row, results);

  const turns = results.flatMap((r) => [r.answer, ...r.followUps.map((f) => f.answer)]).filter((t): t is Turn => !!t);
  const metrics = computeSpeechMetrics(turns);
  const narrative = await writeNarrative({
    domain: row.config.domain,
    difficulty: row.config.difficulty,
    results,
    metrics,
  }).catch((err) => {
    console.warn("[claude:report] using a plain summary:", err instanceof Error ? err.message : err);
    return plainNarrative();
  });
  const report = buildReport({ id: row.id, config: row.config, results, metrics, narrative });
  return { results, report };
}
