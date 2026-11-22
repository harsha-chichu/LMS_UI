/** Alert thresholds, editable on /admin/alerts (lms_app_settings key "alerts"). */
export type AlertSettings = {
  enabled: boolean;
  /** Share of failed AI calls in the last 30 minutes that raises an alert (0–1). */
  aiErrorRate: number;
  /** Ignore the error rate below this many calls (too little traffic to judge). */
  aiMinCalls: number;
  /** Sessions in progress for over 2 hours. */
  stuckSessions: number;
  /** Error groups seen for the first time in the last hour. */
  newErrorGroups: number;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  aiErrorRate: 0.1,
  aiMinCalls: 20,
  stuckSessions: 5,
  newErrorGroups: 3,
};

export function alertSettings(value: unknown): AlertSettings {
  const v = (value ?? {}) as Partial<AlertSettings>;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : d);
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_ALERT_SETTINGS.enabled,
    aiErrorRate: Math.min(1, num(v.aiErrorRate, DEFAULT_ALERT_SETTINGS.aiErrorRate)),
    aiMinCalls: num(v.aiMinCalls, DEFAULT_ALERT_SETTINGS.aiMinCalls),
    stuckSessions: num(v.stuckSessions, DEFAULT_ALERT_SETTINGS.stuckSessions),
    newErrorGroups: num(v.newErrorGroups, DEFAULT_ALERT_SETTINGS.newErrorGroups),
  };
}

export type AlertKind = "ai_errors" | "agent_down" | "stuck_sessions" | "new_errors" | "budget_80" | "budget_100";

export interface Check {
  kind: AlertKind;
  firing: boolean;
  severity: "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

export interface Measurements {
  aiCalls: number;
  aiErrors: number;
  agent: { configured: boolean; reachable: boolean; error?: string };
  stuckSessions: number;
  newErrorGroups: number;
  budget: { dailyUsd: number; spentUsd: number } | null;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Turns measurements into one check per alert kind (firing or not). */
export function evaluate(m: Measurements, s: AlertSettings): Check[] {
  const rate = m.aiCalls ? m.aiErrors / m.aiCalls : 0;
  const spentShare = m.budget ? m.budget.spentUsd / m.budget.dailyUsd : 0;
  return [
    {
      kind: "ai_errors",
      firing: m.aiCalls >= s.aiMinCalls && rate >= s.aiErrorRate,
      severity: rate >= 0.5 ? "critical" : "warning",
      message: `${pct(rate)} of AI calls failed in the last 30 minutes (${m.aiErrors} of ${m.aiCalls}).`,
      details: { calls: m.aiCalls, errors: m.aiErrors },
    },
    {
      kind: "agent_down",
      firing: m.agent.configured && !m.agent.reachable,
      severity: "critical",
      message: `The eval agent isn't reachable${m.agent.error ? ` (${m.agent.error})` : ""}. Scoring falls back to Claude.`,
    },
    {
      kind: "stuck_sessions",
      firing: s.stuckSessions > 0 && m.stuckSessions >= s.stuckSessions,
      severity: "warning",
      message: `${m.stuckSessions} sessions have been in progress for more than 2 hours.`,
      details: { stuck: m.stuckSessions },
    },
    {
      kind: "new_errors",
      firing: s.newErrorGroups > 0 && m.newErrorGroups >= s.newErrorGroups,
      severity: "warning",
      message: `${m.newErrorGroups} new kinds of server error appeared in the last hour.`,
      details: { groups: m.newErrorGroups },
    },
    {
      kind: "budget_80",
      firing: Boolean(m.budget) && spentShare >= 0.8 && spentShare < 1,
      severity: "warning",
      message: m.budget ? `AI spend today is ${pct(spentShare)} of the $${m.budget.dailyUsd} daily budget.` : "",
    },
    {
      kind: "budget_100",
      firing: Boolean(m.budget) && spentShare >= 1,
      severity: "critical",
      message: m.budget ? `The $${m.budget.dailyUsd} daily AI budget is used up; new sessions are paused until midnight UTC.` : "",
    },
  ];
}

/** What changes: checks that start firing (open an alert) and open alerts whose check cleared. */
export function planAlertChanges(checks: Check[], openKinds: string[]) {
  const open = new Set(openKinds);
  return {
    toOpen: checks.filter((c) => c.firing && !open.has(c.kind)),
    toResolve: checks.filter((c) => !c.firing && open.has(c.kind)).map((c) => c.kind),
  };
}
