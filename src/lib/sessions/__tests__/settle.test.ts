import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRun } from "@/lib/agent/client";
import type { SessionRow } from "@/types";

// Eval agent on: finishing a session polls it for each answer's score.
const agent = vi.hoisted(() => ({
  getEvaluation: vi.fn(),
  skipFollowUp: vi.fn(),
  summarize: vi.fn(),
}));
vi.mock("@/lib/agent/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/client")>();
  return {
    AgentError: actual.AgentError,
    agentEnabled: () => true,
    answerFollowUp: vi.fn(),
    startEvaluation: vi.fn(),
    ...agent,
  };
});
const llm = vi.hoisted(() => ({ decideFollowUp: vi.fn(), evaluateAnswer: vi.fn(), writeNarrative: vi.fn() }));
vi.mock("@/lib/llm/service", () => llm);

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
    expect(llm.evaluateAnswer).not.toHaveBeenCalled();
  });

  it("falls back to Claude at once when the agent's run failed", async () => {
    agent.getEvaluation.mockRejectedValue(new AgentError("eval agent run failed: RateLimitError", true));
    llm.evaluateAnswer.mockResolvedValue({ score: 6, feedback: "ok.", nextTime: "", needsFollowUp: false, followUp: null });

    const { results } = await finish(answeredSession());

    expect(agent.getEvaluation).toHaveBeenCalledTimes(1);
    expect(results[0].evaluation?.score).toBe(6);
    expect(results[0].scoring).toMatchObject({ engine: "claude", status: "done" });
  });

  it("waits out the deadline, then records why the answer isn't scored", async () => {
    agent.getEvaluation.mockResolvedValue(run("scoring"));
    llm.evaluateAnswer.mockRejectedValue(new Error("401 invalid x-api-key"));

    const started = Date.now();
    const { results, report } = await finish(answeredSession());

    expect(Date.now() - started).toBeGreaterThanOrEqual(SETTLE_TIMEOUT_MS);
    expect(results[0].evaluation).toBeUndefined();
    expect(results[0].scoring).toEqual({
      engine: "claude",
      status: "failed",
      error: `agent: no result after ${SETTLE_TIMEOUT_MS / 1000}s; claude: 401 invalid x-api-key`,
    });
    expect(report.questions[0].feedback).toMatch(/couldn't score/);
  });
});
