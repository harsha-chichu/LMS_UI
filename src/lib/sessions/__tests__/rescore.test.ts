import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionResult, SessionConfig } from "@/types";

// Eval agent configured; each test scripts its responses.
const agent = vi.hoisted(() => ({
  enabled: true,
  startEvaluation: vi.fn(),
  answerFollowUp: vi.fn(),
  skipFollowUp: vi.fn(),
  getEvaluation: vi.fn(),
}));
vi.mock("@/lib/agent/client", () => ({
  AgentError: class extends Error {},
  agentEnabled: () => agent.enabled,
  startEvaluation: agent.startEvaluation,
  answerFollowUp: agent.answerFollowUp,
  skipFollowUp: agent.skipFollowUp,
  getEvaluation: agent.getEvaluation,
  summarize: vi.fn(),
}));

const llm = vi.hoisted(() => ({ decideFollowUp: vi.fn(), evaluateAnswer: vi.fn(), writeNarrative: vi.fn() }));
vi.mock("@/lib/llm/service", () => llm);

const { rescoreAnswer } = await import("@/lib/sessions/engine");

const config: SessionConfig = { domain: "backend", difficulty: "medium", count: 1, mode: "text" };
const result = { score: 6.5, is_correct: true, feedback: "decent.", strengths: ["clear"], weaknesses: ["Missed eviction."], followup_evaluation: null };
const run = (status: string, extra: object = {}) => ({
  thread_id: "t1",
  status,
  followup_question: null,
  transcript: null,
  communication: null,
  result: null,
  error: null,
  ...extra,
});

function unscored(followUpAnswer?: string): QuestionResult {
  return {
    question: { id: "q1", text: "how would you cache a product catalogue?" },
    skipped: false,
    answer: { text: "write-through with TTLs", mode: "text", durationSec: 0 },
    followUps: followUpAnswer ? [{ question: "what about stampedes?", skipped: false, answer: { text: followUpAnswer, mode: "text", durationSec: 0 } }] : [],
    scoring: { engine: "claude", status: "failed", error: "claude: 401" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  agent.enabled = true;
});

describe("rescoreAnswer", () => {
  it("scores with the eval agent and never calls Claude when the agent works", async () => {
    agent.startEvaluation.mockResolvedValue(run("completed", { result }));
    const r = await rescoreAnswer(config, unscored(), "u1");
    expect(agent.startEvaluation).toHaveBeenCalledWith(expect.objectContaining({ answer: "write-through with TTLs", user_id: "u1" }));
    expect(r.evaluation?.score).toBe(6.5);
    expect(r.scoring).toMatchObject({ engine: "agent", status: "done" });
    expect(llm.evaluateAnswer).not.toHaveBeenCalled();
  });

  it("replays the recorded follow-up answer when the agent asks one", async () => {
    agent.startEvaluation.mockResolvedValue(run("pending_followup", { followup_question: "and stampedes?" }));
    agent.answerFollowUp.mockResolvedValue(run("scoring"));
    agent.getEvaluation.mockResolvedValue(run("completed", { result }));
    const r = await rescoreAnswer(config, unscored("request coalescing"), "u1");
    expect(agent.answerFollowUp).toHaveBeenCalledWith("t1", expect.objectContaining({ answer: "request coalescing" }));
    expect(agent.skipFollowUp).not.toHaveBeenCalled();
    expect(r.scoring?.status).toBe("done");
  });

  it("skips the agent's follow-up when there's no recorded answer for it", async () => {
    agent.startEvaluation.mockResolvedValue(run("pending_followup", { followup_question: "and stampedes?" }));
    agent.skipFollowUp.mockResolvedValue(run("completed", { result }));
    const r = await rescoreAnswer(config, unscored(), "u1");
    expect(agent.skipFollowUp).toHaveBeenCalledWith("t1");
    expect(r.evaluation?.score).toBe(6.5);
  });

  it("falls back to Claude when the agent fails, and keeps both reasons if Claude fails too", async () => {
    agent.startEvaluation.mockRejectedValue(new Error("eval agent /evaluations → 502"));
    llm.evaluateAnswer.mockRejectedValue(new Error("401 invalid x-api-key"));
    const r = await rescoreAnswer(config, unscored(), "u1");
    expect(llm.evaluateAnswer).toHaveBeenCalledOnce();
    expect(r.evaluation).toBeUndefined();
    expect(r.scoring?.status).toBe("failed");
    expect(r.scoring?.error).toContain("agent: eval agent /evaluations → 502");
    expect(r.scoring?.error).toContain("claude: 401 invalid x-api-key");
  });

  it("uses Claude directly when the eval agent isn't configured", async () => {
    agent.enabled = false;
    llm.evaluateAnswer.mockResolvedValue({ score: 8, feedback: "good", nextTime: "", needsFollowUp: false, followUp: null });
    const r = await rescoreAnswer(config, unscored(), "u1");
    expect(agent.startEvaluation).not.toHaveBeenCalled();
    expect(r.scoring).toMatchObject({ engine: "claude", status: "done" });
  });
});
