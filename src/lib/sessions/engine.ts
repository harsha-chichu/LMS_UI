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
import { emptyResult as blank, pendingFollowUp } from "@/lib/sessions/progress";
import { buildReport, plainNarrative, type ReportHistory, type ReportNarrative } from "@/lib/scoring";
import { computeSpeechMetrics } from "@/lib/speech-metrics";
import type { QuestionResult, Report, SessionConfig, SessionRow, Turn } from "@/types";

/**
 * Per-question scoring, done by the eval agent only. If the agent can't be
 * reached when an answer comes in, the answer is kept and marked unscored; the
 * session carries on, and finishing it tries the agent once more. Anything still
 * unscored can be re-scored from the admin session page.
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

function emptyResult(row: SessionRow, index: number): QuestionResult {
  return row.results[index] ?? blank(row.questions[index]);
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function warn(label: string, err: unknown) {
  console.warn(`[agent:${label}]`, errorText(err));
}

const NOT_CONFIGURED = "eval agent is not configured (EVAL_AGENT_URL / EVAL_AGENT_TOKEN)";

/** Fold an agent response into the result (transcript, follow-up, scoring state). */
function applyAgentRun(r: QuestionResult, run: AgentRun, turn: Turn, target: Target): QuestionResult {
  const answered: Turn = {
    ...turn,
    // The user reviewed (and maybe edited) the text before sending, so it stands;
    // the agent's transcript only fills in when no text was sent.
    text: turn.text.trim() || run.transcript?.trim() || "",
    communication: target === "main" ? run.communication : turn.communication,
  };
  const next = withAnswer(r, answered, target);

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

/** `r` with `turn` as the main answer or as the answer to the waiting follow-up. */
function withAnswer(r: QuestionResult, turn: Turn, target: Target): QuestionResult {
  return target === "main"
    ? { ...r, answer: turn }
    : { ...r, followUps: r.followUps.map((f, i, all) => (i === all.length - 1 ? { ...f, answer: turn } : f)) };
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
  if (!turn.text && !audio) throw new SessionError("we didn't catch an answer — try again or type it", 422);

  // A follow-up continues the agent thread the main answer started; without one
  // (the agent failed on the main answer) it is only recorded, for the replay at the end.
  const threadId = r.scoring?.threadId;
  const canCall = agentEnabled() && (target === "main" || Boolean(threadId));

  let error = agentEnabled() ? "the eval agent wasn't reached for the main answer" : NOT_CONFIGURED;
  if (canCall) {
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
          : await answerFollowUp(threadId!, { answer: turn.text, audio, user_id: effectiveUserId });
      return applyAgentRun(r, run, turn, target);
    } catch (err) {
      warn("answer", err);
      error = errorText(err);
    }
  }

  // Only the agent can transcribe, so a recording without text can't be kept.
  if (!turn.text) throw new SessionError("the evaluator couldn't process your recording — try again or type it", 502);
  // Keep the answer and move on; finalize tries the agent again.
  return { ...withAnswer(r, turn, target), scoring: { engine: "agent", status: "failed", error } };
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
      // finalize polls this thread; if the follow-up is still open there it closes it.
    }
  }
  return next;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long finishing a session waits for the agent's background scoring. A voice
 * answer takes several Gemini calls after the follow-up decision (delivery, plan,
 * scoring, up to two re-checks), and the last answers start just before the end.
 * The complete route's maxDuration leaves room for this, one replay and the summary.
 */
export const SETTLE_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2000;

/**
 * Wait for background agent scoring. Answers the agent never got (it was down when
 * they came in) or whose run failed outright are replayed once with a fresh run;
 * answers that only ran out of time are not, as a replay would take as long again.
 */
async function settleScores(row: SessionRow, results: QuestionResult[], replayFailed: boolean, timeoutMs = SETTLE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  const answered = results.filter((r) => !r.skipped && r.answer);
  let pending = answered.filter((r) => r.scoring?.engine === "agent" && r.scoring.status === "pending" && r.scoring.threadId);
  // Unscored with no live thread: an older session, or the agent failed on submit.
  const replay = new Set(answered.filter((r) => !pending.includes(r) && !(r.evaluation && r.scoring?.status === "done")));
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
            // waiting out the deadline.
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
          replay.add(r);
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

  if (!replayFailed) return;
  // Side by side, so several replays don't outlast the request.
  await Promise.all(
    [...replay].map(async (r) => {
      const fresh = await rescoreAnswer(row.config, r, row.user_id);
      r.evaluation = fresh.evaluation;
      r.scoring = fresh.scoring;
    }),
  );
}

/** Session summary from the eval agent; a plain one if it fails. */
async function writeSummary(input: Parameters<typeof toSummaryRequest>[0]): Promise<ReportNarrative> {
  if (agentEnabled()) {
    try {
      return toNarrative(await summarize(toSummaryRequest(input)));
    } catch (err) {
      warn("summary", err);
    }
  }
  return plainNarrative();
}

/** How long re-scoring one answer waits for the eval agent. */
export const RESCORE_AGENT_TIMEOUT_MS = 90_000;

/**
 * Scores an already-answered question again with a fresh agent run (admin
 * "re-score", and the replay when a session finishes): the recorded answer is
 * replayed, with the recorded follow-up answers, in order, if the agent asks
 * follow-ups (skipped if there are none). Text only: the original audio isn't
 * kept, so delivery scores already on the answer stay as they are. On failure
 * the result is marked failed with the reason; a score it already had is kept.
 */
export async function rescoreAnswer(config: SessionConfig, r: QuestionResult, userId?: string): Promise<QuestionResult> {
  const next = structuredClone(r);
  const text = next.answer?.text?.trim();
  if (!text) return next;

  try {
    if (!agentEnabled()) throw new Error(NOT_CONFIGURED);
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
    const previous = r.scoring?.status === "failed" && r.scoring.error;
    next.scoring = {
      engine: "agent",
      status: "failed",
      error: previous && previous !== errorText(err) ? `${previous}; retry: ${errorText(err)}` : errorText(err),
    };
    return next;
  }
}

export async function finalize(
  row: SessionRow,
  history?: ReportHistory,
  { replay = true }: { replay?: boolean } = {},
): Promise<{ results: QuestionResult[]; report: Report }> {
  // Unanswered questions at the end count as skipped.
  const results = row.questions.map((_, i) => {
    const r = structuredClone(emptyResult(row, i));
    if (!r.answer && !r.skipped) r.skipped = true;
    r.followUps = r.followUps.map((f) => (f.answer || f.skipped ? f : { ...f, skipped: true }));
    return r;
  });

  await settleScores(row, results, replay);

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
