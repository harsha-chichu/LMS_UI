import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Evaluation, SessionConfig, SessionRow, Turn } from "@/types";

// Claude only: the eval agent isn't configured.
vi.mock("@/lib/agent/client", () => ({
  agentEnabled: () => false,
  answerFollowUp: vi.fn(),
  getEvaluation: vi.fn(),
  skipFollowUp: vi.fn(),
  startEvaluation: vi.fn(),
  summarize: vi.fn(),
}));

const llm = vi.hoisted(() => ({
  decideFollowUp: vi.fn(),
  evaluateAnswer: vi.fn(),
  writeNarrative: vi.fn(),
}));
vi.mock("@/lib/llm/service", () => llm);

const { scoreLater, scoresLater, skip, submitAnswer } = await import("@/lib/sessions/engine");

const evaluation: Evaluation = {
  score: 7,
  feedback: "solid.",
  nextTime: "add an example.",
  needsFollowUp: false,
  followUp: null,
  strengths: [],
  weaknesses: [],
};

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

beforeEach(() => {
  vi.clearAllMocks();
  llm.evaluateAnswer.mockResolvedValue(evaluation);
});

describe("submitting a main answer (Claude)", () => {
  it("waits only on the follow-up decision, not the full evaluation", async () => {
    llm.decideFollowUp.mockResolvedValue("what happens across regions?");
    const r = await submitAnswer(session("medium"), 0, "main", typed("token bucket in redis"), null);

    expect(llm.decideFollowUp).toHaveBeenCalledOnce();
    expect(llm.evaluateAnswer).not.toHaveBeenCalled();
    expect(r.followUps).toEqual([{ question: "what happens across regions?", skipped: false }]);
    // Scored later, together with the follow-up's answer.
    expect(r.scoring).toBeUndefined();
    expect(scoresLater(r)).toBe(false);
  });

  it("leaves scoring for after the response when no follow-up is needed", async () => {
    llm.decideFollowUp.mockResolvedValue(null);
    const r = await submitAnswer(session("medium"), 0, "main", typed("a thorough answer"), null);

    expect(r.followUps).toEqual([]);
    expect(scoresLater(r)).toBe(true);
    expect(llm.evaluateAnswer).not.toHaveBeenCalled();

    const scored = await scoreLater(session("medium").config, r);
    expect(llm.evaluateAnswer).toHaveBeenCalledOnce();
    expect(scored.evaluation?.score).toBe(7);
    expect(scored.scoring).toEqual({ engine: "claude", status: "done" });
  });

  it("moves on without a follow-up if the decision fails", async () => {
    llm.decideFollowUp.mockRejectedValue(new Error("overloaded"));
    const r = await submitAnswer(session("hard"), 0, "main", typed("an answer"), null);

    expect(r.followUps).toEqual([]);
    expect(scoresLater(r)).toBe(true);
  });

  it("never asks for a follow-up on easy", async () => {
    const r = await submitAnswer(session("easy"), 0, "main", typed("an answer"), null);

    expect(llm.decideFollowUp).not.toHaveBeenCalled();
    expect(scoresLater(r)).toBe(true);
  });

  it("rejects an answer with no text", async () => {
    await expect(submitAnswer(session("medium"), 0, "main", typed(""), null)).rejects.toMatchObject({ status: 422 });
  });
});

describe("after a follow-up is asked", () => {
  async function withFollowUp() {
    llm.decideFollowUp.mockResolvedValue("what happens across regions?");
    const row = session("medium");
    row.results = [await submitAnswer(row, 0, "main", typed("token bucket in redis"), null)];
    vi.clearAllMocks();
    return row;
  }

  it("answering it scores the main answer and follow-up together, after the response", async () => {
    const row = await withFollowUp();
    const r = await submitAnswer(row, 0, "followup", typed("shard by user id"), null);

    expect(llm.decideFollowUp).not.toHaveBeenCalled();
    expect(r.followUps[0].answer?.text).toBe("shard by user id");
    expect(scoresLater(r)).toBe(true);

    await scoreLater(row.config, r);
    expect(llm.evaluateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "token bucket in redis",
        followUps: [{ question: "what happens across regions?", answer: "shard by user id" }],
      }),
    );
  });

  it("skipping it scores the main answer after the response", async () => {
    const row = await withFollowUp();
    const r = await skip(row, 0, "followup");

    expect(r.followUps[0].skipped).toBe(true);
    expect(llm.evaluateAnswer).not.toHaveBeenCalled();
    expect(scoresLater(r)).toBe(true);
  });

  it("tells the scorer a skipped follow-up was asked but not answered", async () => {
    const row = await withFollowUp();
    const r = await skip(row, 0, "followup");

    await scoreLater(row.config, r);
    expect(llm.evaluateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ followUps: [{ question: "what happens across regions?", answer: null }] }),
    );
  });

  it("rejects an audio-only follow-up answer when only Claude is available", async () => {
    const row = await withFollowUp();
    const audio = new Blob(["x"], { type: "audio/webm" });
    await expect(
      submitAnswer(row, 0, "followup", { text: "", mode: "voice", durationSec: 5 }, audio),
    ).rejects.toMatchObject({ status: 422 });
  });
});
