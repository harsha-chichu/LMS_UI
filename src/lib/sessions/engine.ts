import "server-only";
import {
  AgentError,
  type AgentRun,
  agentEnabled,
  answerFollowUp,
  getEvaluation,
  skipFollowUp,
  startEvaluation,
  summarize,
} from "@/lib/agent/client";
import { agentDomain, toEvaluation, toNarrative, toSummaryRequest } from "@/lib/agent/map";
import { decideFollowUp, evaluateAnswer, writeNarrative } from "@/lib/llm/service";
import { emptyResult as blank, pendingFollowUp } from "@/lib/sessions/progress";
import { buildReport, plainNarrative, type ReportHistory, type ReportNarrative } from "@/lib/scoring";
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

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function warn(label: string, err: unknown) {
  console.warn(`[agent:${label}] falling back to claude:`, errorText(err));
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
    console.warn("[claude:evaluate] scoring failed:", errorText(err));
    // A score Claude already gave the main answer still stands; otherwise it's unscored for now.
    if (!(r.evaluation && r.scoring?.engine === "claude")) {
      // Keep why the agent didn't score it too, so the row says why it's "not scored".
      const agentError = r.scoring?.engine === "agent" ? r.scoring.error : undefined;
      r.evaluation = undefined;
      r.scoring = {
        engine: "claude",
        status: "failed",
        error: [agentError && `agent: ${agentError}`, `claude: ${errorText(err)}`].filter(Boolean).join("; "),
      };
    }
    return null;
  }
}

/** Fold an agent response into the result (transcript, follow-up, scoring state). */
function applyAgentRun(r: QuestionResult, run: AgentRun, turn: Turn, target: Target): QuestionResult {
  const answered: Turn = {
    ...turn,
    // The user reviewed (and maybe edited) the text before sending, so it stands;
    // the agent's transcript only fills in when no text was sent.
    text: turn.text.trim() || run.transcript?.trim() || "",
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
  userId?: string,
): Promise<QuestionResult> {
  const r = emptyResult(row, index);
  const { config } = row;
  const effectiveUserId = userId ?? row.user_id;

  if (target === "main" && (r.answer || r.skipped)) throw new SessionError("question already answered", 409);
  const followUp = pendingFollowUp(r);
  if (target === "followup" && (!r.answer || !followUp)) throw new SessionError("no follow-up waiting", 409);
  // The agent continues a thread it started; anything else is scored by Claude.
  const useAgent = agentEnabled() && (target === "main" || r.scoring?.engine === "agent");
  // A recording with no text only works when the agent transcribes it.
  if (!turn.text && !(audio && useAgent)) {
    throw new SessionError("we didn't catch an answer — try again or type it", 422);
  }

  // ---- eval agent ----
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
              user_id: effectiveUserId,
            })
          : await answerFollowUp(r.scoring!.threadId!, {
              answer: turn.text,
              audio,
              user_id: effectiveUserId,
            });
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

  // The user never waits for the score: the route scores it after responding
  // (scoreLater), and finalize picks it up if that hasn't landed by the end.
  // The only thing they wait on is whether to ask a follow-up, which is a much
  // shorter call than a full evaluation.
  const canFollowUp = target === "main" && config.difficulty !== "easy" && next.followUps.length < MAX_FOLLOW_UPS;
  const nextQuestion = canFollowUp
    ? await decideFollowUp({
        domain: config.domain,
        difficulty: config.difficulty,
        question: next.question.text,
        answer: turn.text,
      }).catch((err) => {
        console.warn("[claude:follow-up] deciding failed, moving on:", err instanceof Error ? err.message : err);
        return null;
      })
    : null;

  if (nextQuestion) {
    // Scored once the follow-up is answered or skipped, together with its answer.
    next.followUps = [...next.followUps, { question: nextQuestion, skipped: false }];
    next.scoring = undefined;
  } else {
    next.scoring = { engine: "claude", status: "pending" };
  }
  return next;
}

/** True when submitAnswer or skip left Claude scoring for after the response. */
export function scoresLater(r: QuestionResult) {
  return r.scoring?.engine === "claude" && r.scoring.status === "pending";
}

/** Score a result submitAnswer left pending. Runs after the response is sent. */
export async function scoreLater(config: SessionConfig, r: QuestionResult): Promise<QuestionResult> {
  const next = structuredClone(r);
  await claudeScore(config, next, false);
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
  // Claude path (or the agent failed): score after the response, like an answer.
  if (!(r.scoring?.engine === "claude" && r.evaluation)) next.scoring = { engine: "claude", status: "pending" };
  return next;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long finishing a session waits for the agent's background scoring. A voice
 * answer takes several Gemini calls after the follow-up decision (delivery, plan,
 * scoring, up to two re-checks), and the last answers start just before the end.
 * The complete route's maxDuration leaves room for this plus the summary.
 */
export const SETTLE_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2000;

/** Wait for background agent scoring, then fall back to Claude for anything left. */
async function settleScores(row: SessionRow, results: QuestionResult[], timeoutMs = SETTLE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let pending = results.filter((r) => !r.skipped && r.answer && r.scoring?.engine === "agent" && r.scoring.status !== "done");
  // The last error per answer, if polling it hasn't succeeded since.
  const lastError = new Map<QuestionResult, string>();

  while (pending.length && Date.now() < deadline) {
    await Promise.all(
      pending.map(async (r) => {
        try {
          const run = await getEvaluation(r.scoring!.threadId!);
          // Delivery scores land after the follow-up decision, so they're usually not
          // on the answer yet; take them from the run.
          if (r.answer && !r.answer.communication && run.communication) {
            r.answer = { ...r.answer, communication: run.communication };
          }
          if (run.status === "completed" && run.result) {
            r.evaluation = toEvaluation(run.result);
            r.scoring = { ...r.scoring!, status: "done" };
          } else if (run.status === "pending_followup") {
            // A follow-up nobody will answer (left unanswered, or asked after the agent's
            // decision timed out). Close it so the agent scores now instead of us
            // waiting out the deadline and re-scoring with Claude.
            await skipFollowUp(r.scoring!.threadId!);
          }
          lastError.delete(r);
        } catch (err) {
          // A timeout or a 5xx is often a blip (the agent busy with another request):
          // keep asking until the deadline. Give up now only if retrying can't help.
          lastError.set(r, errorText(err));
          if (err instanceof AgentError && !err.final) return;
          warn("poll", err);
          r.scoring = { ...r.scoring!, status: "failed", error: errorText(err) };
        }
      }),
    );
    pending = pending.filter((r) => r.scoring?.status === "pending");
    if (pending.length) await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
  }

  for (const r of pending) {
    const error = `no result after ${Math.round(timeoutMs / 1000)}s${lastError.has(r) ? ` (last error: ${lastError.get(r)})` : ""}`;
    warn("poll", error);
    r.scoring = { ...r.scoring!, status: "failed", error };
  }

  // Side by side: one at a time, a few slow Claude calls could outlast the request.
  await Promise.all(
    results
      .filter((r) => !r.skipped && r.answer && (!r.evaluation || r.scoring?.status !== "done"))
      .map((r) => claudeScore(row.config, r, false)),
  );
}

/** Session summary: the eval agent first, then Claude; a plain one if both fail. */
async function writeSummary(input: Parameters<typeof writeNarrative>[0]): Promise<ReportNarrative> {
  if (agentEnabled()) {
    try {
      return toNarrative(await summarize(toSummaryRequest(input)));
    } catch (err) {
      warn("summary", err);
    }
  }
  return writeNarrative(input).catch((err) => {
    console.warn("[claude:report] using a plain summary:", err instanceof Error ? err.message : err);
    return plainNarrative();
  });
}

/** How long re-scoring one answer waits for the eval agent before falling back. */
export const RESCORE_AGENT_TIMEOUT_MS = 90_000;

/**
 * Scores an already-answered question again (admin "re-score"), the same way a
 * live session does: the eval agent first, with the recorded answer replayed
 * (and the recorded follow-up answers, in order, if the agent asks follow-ups;
 * skipped if there are none), then Claude if the agent fails. Text only: the
 * original audio isn't kept, so delivery scores already on the answer stay as they are.
 */
export async function rescoreAnswer(config: SessionConfig, r: QuestionResult, userId?: string): Promise<QuestionResult> {
  const next = structuredClone(r);
  const text = next.answer?.text?.trim();
  if (!text) return next;

  if (agentEnabled()) {
    try {
      const followUpAnswers = next.followUps.map((f) => f.answer?.text?.trim()).filter((t): t is string => Boolean(t));
      let run = await startEvaluation({
        question: next.question.text,
        difficulty: config.difficulty,
        domain: agentDomain(config.domain),
        answer: text,
        user_id: userId,
      });
      const deadline = Date.now() + RESCORE_AGENT_TIMEOUT_MS;
      while (true) {
        if (run.status === "completed" && run.result) {
          next.evaluation = toEvaluation(run.result);
          next.scoring = { engine: "agent", status: "done", threadId: run.thread_id };
          return next;
        }
        if (Date.now() >= deadline) throw new Error(`no result after ${RESCORE_AGENT_TIMEOUT_MS / 1000}s`);
        if (run.status === "pending_followup") {
          const reply = followUpAnswers.shift();
          run = reply ? await answerFollowUp(run.thread_id, { answer: reply, user_id: userId }) : await skipFollowUp(run.thread_id);
          continue;
        }
        await sleep(POLL_INTERVAL_MS);
        run = await getEvaluation(run.thread_id);
      }
    } catch (err) {
      warn("rescore", err);
      // claudeScore keeps this so a row still failing says why for both scorers.
      next.scoring = { engine: "agent", status: "failed", error: errorText(err) };
    }
  }

  await claudeScore(config, next, false);
  return next;
}

export async function finalize(
  row: SessionRow,
  history?: ReportHistory,
): Promise<{ results: QuestionResult[]; report: Report }> {
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
  const narrative = await writeSummary({
    domain: row.config.domain,
    difficulty: row.config.difficulty,
    results,
    metrics,
  });
  const report = buildReport({ id: row.id, config: row.config, results, metrics, narrative, history });
  return { results, report };
}
