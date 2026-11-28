import { describe, expect, it } from "vitest";
import { alignFollowUpAnswers } from "@/lib/sessions/followUps";

const fu = (...qs: string[]) => qs.map((question) => ({ question }));

describe("alignFollowUpAnswers", () => {
  it("matches by question text, ignoring case and punctuation", () => {
    expect(
      alignFollowUpAnswers(fu("How do you shard it?", "what about hot keys?"), [
        { question: "what about hot keys", answer: "b" },
        { question: "how do you shard it", answer: "a" },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("falls back to position when the text differs", () => {
    expect(alignFollowUpAnswers(fu("q1?", "q2?"), [{ answer: " a " }, { answer: "b" }])).toEqual(["a", "b"]);
  });

  it("leaves a gap when there are fewer suggestions than follow-ups", () => {
    expect(alignFollowUpAnswers(fu("q1?", "q2?"), [{ question: "q2?", answer: "b" }])).toEqual(["", "b"]);
  });

  it("is undefined with no follow-ups or no usable suggestions", () => {
    expect(alignFollowUpAnswers([], [{ answer: "a" }])).toBeUndefined();
    expect(alignFollowUpAnswers(fu("q1?"), [])).toBeUndefined();
    expect(alignFollowUpAnswers(fu("q1?"), [{ answer: "  " }])).toBeUndefined();
  });
});
