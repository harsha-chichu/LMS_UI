import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRun } from "@/lib/agent/client";
import type { SessionRow } from "@/types";

// Eval agent on: finishing a session polls it for each answer's score.
const agent = vi.hoisted(() => ({
  getEvaluation: vi.fn(),
  skipFollowUp: vi.fn(),
  summarize: vi.fn(),
  startEvaluation: vi.fn(),
}));
vi.mock("@/lib/agent/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/client")>();
  return {
    AgentError: actual.AgentError,
    agentEnabled: () => true,
    answerFollowUp: vi.fn(),
    ...agent,
  };
});

const { AgentError } = await import("@/lib/agent/client");
const { finalize, SETTLE_TIMEOUT_MS } = await import("@/lib/sessions/engine");

function run(status: AgentRun["status"], score?: number): AgentRun {
  return {
    thread_id: "t1",
    status,
    followup_question: null,
    transcript: null,
    communication: null,
    error: null,
    result:
      score === undefined
        ? null
        : { score, is_correct: true, feedback: "ok.", strengths: [], weaknesses: [], followup_evaluation: null },
  };
}

function answeredSession(): SessionRow {
  const question = { id: "q1", text: "how do you design a rate limiter?" };
  return {
    id: "s1",
    user_id: "u1",
    config: { domain: "backend", difficulty: "medium", count: 1, mode: "voice" },
    questions: [question],
    results: [
      {
        question,
        skipped: false,
        followUps: [],
        answer: { text: "token bucket in redis", mode: "voice", durationSec: 30 },
        scoring: { engine: "agent", status: "pending", threadId: "t1" },
      },
    ],
    status: "in_progress",
    report: null,
    total: null,
    created_at: "",
    completed_at: null,
  };
}

/** Runs finalize to the end with fake timers, so polling waits take no real time. */
async function finish(row: SessionRow) {
  const done = finalize(row);
  await vi.runAllTimersAsync();
  return done;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  agent.summarize.mockResolvedValue({
    summary: "fine.",
    strengths: [],
    improvements: [],
    clarity: { level: 3, label: "ok" },
    confidence: { level: 3, label: "ok" },
  });
});
afterEach(() => vi.useRealTimers());

describe("finishing a session with the eval agent", () => {
  it("keeps polling through a timeout and uses the agent's score", async () => {
    agent.getEvaluation
      .mockRejectedValueOnce(new AgentError("eval agent /evaluations/t1: The operation was aborted due to timeout", false))
      .mockResolvedValueOnce(run("scoring"))
      .mockResolvedValueOnce(run("completed", 8));

    const { results } = await finish(answeredSession());

    expect(agent.getEvaluation).toHaveBeenCalledTimes(3);
    expect(results[0].evaluation?.score).toBe(8);
    expect(results[0].scoring).toMatchObject({ engine: "agent", status: "done" });
    expect(agent.startEvaluation).not.toHaveBeenCalled();
  });

  it("replays an answer once with a fresh agent run when its run failed", async () => {
    agent.getEvaluation.mockRejectedValueOnce(new AgentError("eval agent run failed: RateLimitError", true));
    agent.startEvaluation.mockResolvedValue({ ...run("completed", 6), thread_id: "t2" });

    const { results } = await finish(answeredSession());

    expect(agent.getEvaluation).toHaveBeenCalledTimes(1);
    expect(agent.startEvaluation).toHaveBeenCalledOnce();
    expect(results[0].evaluation?.score).toBe(6);
    expect(results[0].scoring).toEqual({ engine: "agent", status: "done", threadId: "t2" });
  });

  it("replays an answer the agent never got (it was down on submit)", async () => {
    const row = answeredSession();
    row.results[0].scoring = { engine: "agent", status: "failed", error: "eval agent /evaluations → 502" };
    agent.startEvaluation.mockResolvedValue(run("completed", 7));

    const { results } = await finish(row);

    expect(agent.getEvaluation).not.toHaveBeenCalled();
    expect(results[0].evaluation?.score).toBe(7);
    expect(results[0].scoring?.status).toBe("done");
  });

  it("doesn't replay when asked not to (admin re-score already retried)", async () => {
    const row = answeredSession();
    row.results[0].scoring = { engine: "agent", status: "failed", error: "502" };

    const done = finalize(row, undefined, { replay: false });
    await vi.runAllTimersAsync();
    const { results } = await done;

    expect(agent.startEvaluation).not.toHaveBeenCalled();
    expect(results[0].scoring).toEqual({ engine: "agent", status: "failed", error: "502" });
  });

  it("waits out the deadline, then records why the answer isn't scored (no replay)", async () => {
    agent.getEvaluation.mockResolvedValue(run("scoring"));

    const started = Date.now();
    const { results, report } = await finish(answeredSession());

    expect(Date.now() - started).toBeGreaterThanOrEqual(SETTLE_TIMEOUT_MS);
    expect(agent.startEvaluation).not.toHaveBeenCalled();
    expect(results[0].evaluation).toBeUndefined();
    expect(results[0].scoring).toEqual({
      engine: "agent",
      status: "failed",
      threadId: "t1",
      error: `no result after ${SETTLE_TIMEOUT_MS / 1000}s`,
    });
    expect(report.questions[0].feedback).toMatch(/couldn't score/);
  });

  it("uses a plain summary when the agent can't write one", async () => {
    agent.getEvaluation.mockResolvedValue(run("completed", 8));
    agent.summarize.mockRejectedValue(new Error("502"));

    const { report } = await finish(answeredSession());

    expect(report.summary).toMatch(/couldn.t write a summary/);
  });
});
