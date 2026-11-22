import { describe, expect, it } from "vitest";
import { aalFromJwt, accessFor, mfaRequired, mfaStep } from "@/lib/admin/access";
import { DEFAULT_ALERT_SETTINGS, type Measurements, alertSettings, evaluate, planAlertChanges } from "@/lib/admin/alert-rules";
import { parseCsv, questionsFromCsv } from "@/lib/admin/csv";
import { errorFingerprint, normalizeMessage } from "@/lib/admin/fingerprint";
import { webhookPayload } from "@/lib/admin/notify";
import { unscoredIndexes } from "@/lib/admin/rescore";
import { BUDGET_SESSION_MESSAGE, MAINTENANCE_SESSION_MESSAGE, activeBudget, newSessionBlock } from "@/lib/admin/session-block";
import { LIMITS, resolveLimit } from "@/lib/limits";
import type { QuestionResult } from "@/types";

describe("access", () => {
  it("ADMIN_EMAILS wins, then role, and suspension removes access", () => {
    expect(accessFor("boss@x.io", { role: "user" }, "boss@x.io")).toBe("admin");
    expect(accessFor("a@x.io", { role: "admin" }, "")).toBe("admin");
    expect(accessFor("a@x.io", { role: "support" }, "")).toBe("support");
    expect(accessFor("a@x.io", { role: "user" }, "")).toBeNull();
    expect(accessFor("a@x.io", { role: "admin", suspended_at: "2026-01-01" }, "")).toBeNull();
    expect(accessFor("a@x.io", null, "")).toBeNull();
  });

  it("works out the two-factor step", () => {
    const verified = [{ status: "verified", factor_type: "totp" }];
    expect(mfaStep(true, "aal2", verified)).toBe("ok");
    expect(mfaStep(true, "aal1", verified)).toBe("verify");
    expect(mfaStep(true, "aal1", [{ status: "unverified" }])).toBe("enroll");
    expect(mfaStep(true, null, [])).toBe("enroll");
    expect(mfaStep(false, "aal1", [])).toBe("ok");
  });

  it("2FA is required unless explicitly turned off", () => {
    expect(mfaRequired(undefined)).toBe(true);
    expect(mfaRequired("true")).toBe(true);
    expect(mfaRequired("FALSE")).toBe(false);
  });

  it("reads the aal claim and survives junk", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "x", aal: "aal2" })).toString("base64url");
    expect(aalFromJwt(`h.${payload}.s`)).toBe("aal2");
    expect(aalFromJwt("not-a-jwt")).toBeNull();
    expect(aalFromJwt(undefined)).toBeNull();
  });
});

describe("csv import", () => {
  it("parses quotes, escaped quotes, commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
    expect(parseCsv("﻿a\n\n")).toEqual([["a"]]);
  });

  it("validates rows and reports problems with line numbers", () => {
    const csv = [
      "Domain,Difficulty,Text,Topics",
      "backend,Medium,What is an index and when would you add one?,databases;Indexes",
      "frontend,easy,short,",
      "nope,easy,What does a load balancer actually do?,",
      "backend,medium,What is an index and when would you add one?!,",
    ].join("\n");
    const { rows, problems } = questionsFromCsv(csv);
    expect(rows).toEqual([
      { domain: "backend", difficulty: "medium", text: "What is an index and when would you add one?", topics: ["databases", "indexes"] },
    ]);
    expect(problems.map((p) => p.line)).toEqual([3, 4, 5]);
    expect(problems[2].error).toContain("duplicate");
  });

  it("needs the required columns", () => {
    expect(questionsFromCsv("domain,text\nbackend,hello there friend").problems[0].error).toContain("difficulty");
  });
});

describe("error fingerprints", () => {
  it("groups the same error with different ids and numbers", () => {
    const a = errorFingerprint("api", "/x", 'session 3f2a1b4c-1111-4222-8333-444455556666 failed after 1200ms: "boom"');
    const b = errorFingerprint("api", "/x", 'session 9d8c7b6a-1111-4222-8333-444455556666 failed after 87ms: "bang"');
    expect(a).toBe(b);
    expect(errorFingerprint("api", "/y", "x")).not.toBe(errorFingerprint("api", "/x", "x"));
    expect(normalizeMessage("eval agent /evaluations → 502")).toBe("eval agent /evaluations → <n>");
  });
});

describe("alerts", () => {
  const healthy: Measurements = {
    aiCalls: 100,
    aiErrors: 1,
    agent: { configured: true, reachable: true },
    stuckSessions: 0,
    newErrorGroups: 0,
    budget: null,
  };

  it("fires nothing when healthy", () => {
    expect(evaluate(healthy, DEFAULT_ALERT_SETTINGS).filter((c) => c.firing)).toEqual([]);
  });

  it("fires on each problem", () => {
    const firing = evaluate(
      {
        aiCalls: 40,
        aiErrors: 10,
        agent: { configured: true, reachable: false, error: "timeout" },
        stuckSessions: 7,
        newErrorGroups: 4,
        budget: { dailyUsd: 10, spentUsd: 12 },
      },
      DEFAULT_ALERT_SETTINGS,
    )
      .filter((c) => c.firing)
      .map((c) => c.kind);
    expect(firing).toEqual(["ai_errors", "agent_down", "stuck_sessions", "new_errors", "budget_100"]);
  });

  it("ignores the error rate on too little traffic and when the agent is off", () => {
    const c = evaluate({ ...healthy, aiCalls: 5, aiErrors: 5, agent: { configured: false, reachable: false } }, DEFAULT_ALERT_SETTINGS);
    expect(c.filter((x) => x.firing)).toEqual([]);
  });

  it("warns at 80% of the budget", () => {
    const c = evaluate({ ...healthy, budget: { dailyUsd: 10, spentUsd: 8.5 } }, DEFAULT_ALERT_SETTINGS);
    expect(c.filter((x) => x.firing).map((x) => x.kind)).toEqual(["budget_80"]);
  });

  it("opens new alerts once and resolves cleared ones", () => {
    const checks = evaluate({ ...healthy, stuckSessions: 9 }, DEFAULT_ALERT_SETTINGS);
    expect(planAlertChanges(checks, []).toOpen.map((c) => c.kind)).toEqual(["stuck_sessions"]);
    expect(planAlertChanges(checks, ["stuck_sessions"]).toOpen).toEqual([]);
    expect(planAlertChanges(evaluate(healthy, DEFAULT_ALERT_SETTINGS), ["stuck_sessions"]).toResolve).toEqual(["stuck_sessions"]);
  });

  it("fills in missing or bad threshold settings", () => {
    expect(alertSettings({ aiErrorRate: -1, stuckSessions: 2 })).toEqual({ ...DEFAULT_ALERT_SETTINGS, stuckSessions: 2 });
    expect(alertSettings(null)).toEqual(DEFAULT_ALERT_SETTINGS);
  });
});

describe("rate limits", () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 1000).toISOString();

  it("uses override, then admin setting, then default", () => {
    expect(resolveLimit("session", "u1", {}, [])).toBe(LIMITS.session.limit);
    expect(resolveLimit("session", "u1", { session: 50 }, [])).toBe(50);
    expect(resolveLimit("session", "u1", { session: 50 }, [{ user_id: "u1", bucket: "session", max_count: 500, expires_at: future }])).toBe(500);
  });

  it("ignores expired overrides, other users and bad settings", () => {
    expect(resolveLimit("session", "u1", {}, [{ user_id: "u1", bucket: "session", max_count: 500, expires_at: past }])).toBe(LIMITS.session.limit);
    expect(resolveLimit("session", "u2", {}, [{ user_id: "u1", bucket: "session", max_count: 500, expires_at: future }])).toBe(LIMITS.session.limit);
    expect(resolveLimit("answer", "u1", { answer: -3 }, [])).toBe(LIMITS.answer.limit);
  });
});

describe("daily budget", () => {
  const budget = (enabled: boolean, daily_usd: number) => ({ key: "budget", value: { enabled, daily_usd } });

  it("blocks new sessions once spend reaches the budget", () => {
    expect(newSessionBlock([budget(true, 10)], 9.99)).toBeNull();
    expect(newSessionBlock([budget(true, 10)], 10)).toBe(BUDGET_SESSION_MESSAGE);
    expect(newSessionBlock([budget(false, 10)], 50)).toBeNull();
    expect(newSessionBlock([budget(true, 10)], null)).toBeNull();
  });

  it("only counts a switched-on, positive budget", () => {
    expect(activeBudget([budget(true, 0)])).toBeNull();
    expect(activeBudget([budget(true, 5)])).toEqual({ dailyUsd: 5 });
  });

  it("maintenance still takes priority", () => {
    expect(newSessionBlock([budget(true, 1), { key: "maintenance", value: { enabled: true } }], 5)).toBe(MAINTENANCE_SESSION_MESSAGE);
  });
});

describe("webhook payload", () => {
  it("formats for Slack and Discord", () => {
    expect(webhookPayload("https://hooks.slack.com/services/x", "hi")).toEqual({ text: "hi" });
    expect(webhookPayload("https://discord.com/api/webhooks/x", "hi")).toEqual({ content: "hi" });
    expect(webhookPayload("https://example.com/hook", "hi")).toEqual({ text: "hi", content: "hi" });
  });
});

describe("unscoredIndexes", () => {
  const q = { id: "q", text: "t" };
  const answer = { text: "a", mode: "text" as const, durationSec: 0 };
  it("finds answered questions without a score", () => {
    const results: QuestionResult[] = [
      { question: q, skipped: false, answer, followUps: [], evaluation: { score: 7 } as QuestionResult["evaluation"], scoring: { engine: "agent", status: "done" } },
      { question: q, skipped: false, answer, followUps: [], scoring: { engine: "claude", status: "failed" } },
      { question: q, skipped: true, followUps: [] },
      { question: q, skipped: false, answer, followUps: [] },
    ];
    expect(unscoredIndexes(results)).toEqual([1, 3]);
  });
});
