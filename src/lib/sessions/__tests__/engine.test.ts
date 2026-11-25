import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRun } from "@/lib/agent/client";
import type { SessionConfig, SessionRow, Turn } from "@/types";

// Scoring is the eval agent's alone; each test scripts its responses.
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

const { skip, submitAnswer } = await import("@/lib/sessions/engine");

function run(status: AgentRun["status"], extra: Partial<AgentRun> = {}): AgentRun {
  return { thread_id: "t1", status, followup_question: null, transcript: null, communication: null, result: null, error: null, ...extra };
}

function session(difficulty: SessionConfig["difficulty"]): SessionRow {
  return {
    id: "s1",
    user_id: "u1",
    config: { domain: "backend", difficulty, count: 1, mode: "text" },
    questions: [{ id: "q1", text: "how do you design a rate limiter?" }],
    results: [],
    status: "in_progress",
    report: null,
    total: null,
    created_at: "",
    completed_at: null,
  };
}

const typed = (text: string): Turn => ({ text, mode: "text", durationSec: 0 });
const audio = () => new Blob(["x"], { type: "audio/webm" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  agent.enabled = true;
});

describe("submitting a main answer", () => {
  it("starts an agent run and records the follow-up it asks", async () => {
    agent.startEvaluation.mockResolvedValue(run("pending_followup", { followup_question: "what happens across regions?" }));
    const r = await submitAnswer(session("medium"), 0, "main", typed("token bucket in redis"), null);

    expect(agent.startEvaluation).toHaveBeenCalledWith(expect.objectContaining({ answer: "token bucket in redis", user_id: "u1" }));
    expect(r.followUps).toEqual([{ question: "what happens across regions?", skipped: false }]);
    expect(r.scoring).toEqual({ engine: "agent", status: "pending", threadId: "t1" });
  });

  it("keeps the answer, marked unscored, when the agent is down", async () => {
    agent.startEvaluation.mockRejectedValue(new Error("eval agent /evaluations → 502"));
    const r = await submitAnswer(session("medium"), 0, "main", typed("token bucket in redis"), null);

    expect(r.answer?.text).toBe("token bucket in redis");
    expect(r.followUps).toEqual([]);
    expect(r.scoring).toEqual({ engine: "agent", status: "failed", error: "eval agent /evaluations → 502" });
  });

  it("rejects a recording without text when the agent is down (nothing can transcribe it)", async () => {
    agent.startEvaluation.mockRejectedValue(new Error("502"));
    await expect(
      submitAnswer(session("medium"), 0, "main", { text: "", mode: "voice", durationSec: 5 }, audio()),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("keeps the answer unscored when the agent isn't configured", async () => {
    agent.enabled = false;
    const r = await submitAnswer(session("medium"), 0, "main", typed("an answer"), null);

    expect(agent.startEvaluation).not.toHaveBeenCalled();
    expect(r.scoring?.status).toBe("failed");
    expect(r.scoring?.error).toMatch(/not configured/);
  });

  it("rejects an answer with no text and no recording", async () => {
    await expect(submitAnswer(session("medium"), 0, "main", typed(""), null)).rejects.toMatchObject({ status: 422 });
  });
});

describe("after a follow-up is asked", () => {
  async function withFollowUp() {
    agent.startEvaluation.mockResolvedValue(run("pending_followup", { followup_question: "what happens across regions?" }));
    const row = session("medium");
    row.results = [await submitAnswer(row, 0, "main", typed("token bucket in redis"), null)];
    vi.clearAllMocks();
    return row;
  }

  it("answering it continues the same agent thread", async () => {
    const row = await withFollowUp();
    agent.answerFollowUp.mockResolvedValue(run("scoring"));
    const r = await submitAnswer(row, 0, "followup", typed("shard by user id"), null);

    expect(agent.answerFollowUp).toHaveBeenCalledWith("t1", expect.objectContaining({ answer: "shard by user id" }));
    expect(r.followUps[0].answer?.text).toBe("shard by user id");
    expect(r.scoring).toEqual({ engine: "agent", status: "pending", threadId: "t1" });
  });

  it("keeps the follow-up answer, marked unscored, when the agent is down", async () => {
    const row = await withFollowUp();
    agent.answerFollowUp.mockRejectedValue(new Error("timeout"));
    const r = await submitAnswer(row, 0, "followup", typed("shard by user id"), null);

    expect(r.followUps[0].answer?.text).toBe("shard by user id");
    expect(r.scoring).toEqual({ engine: "agent", status: "failed", error: "timeout" });
  });

  it("skipping it tells the agent, which scores the main answer", async () => {
    const row = await withFollowUp();
    agent.skipFollowUp.mockResolvedValue(run("scoring"));
    const r = await skip(row, 0, "followup");

    expect(agent.skipFollowUp).toHaveBeenCalledWith("t1");
    expect(r.followUps[0].skipped).toBe(true);
    expect(r.scoring).toEqual({ engine: "agent", status: "pending", threadId: "t1" });
  });
});
