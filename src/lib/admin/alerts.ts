import "server-only";
import { type Measurements, alertSettings, evaluate, planAlertChanges } from "@/lib/admin/alert-rules";
import { appUrl, notifyAdmins } from "@/lib/admin/notify";
import { activeBudget } from "@/lib/admin/session-block";
import { getSpendToday } from "@/lib/admin/spend";
import { pingAgent } from "@/lib/agent/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function measure(settingsRows: { key: string; value: unknown }[]): Promise<Measurements> {
  const db = getSupabaseAdmin();
  const now = Date.now();
  const [ops, agent, stuck, newGroups] = await Promise.all([
    db.rpc("lms_admin_usage_ops", {
      p_from: new Date(now - 30 * 60_000).toISOString(),
      p_to: new Date(now + 60_000).toISOString(),
    }),
    pingAgent(),
    db
      .from("lms_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress")
      .lt("created_at", new Date(now - 2 * 3_600_000).toISOString()),
    db.rpc("lms_admin_new_error_groups", { p_since: new Date(now - 3_600_000).toISOString() }),
  ]);
  const rows = (ops.data ?? []) as { kind: string; calls: number; errors: number }[];
  const ai = rows.filter((r) => r.kind !== "deepgram");
  const budget = activeBudget(settingsRows);
  return {
    aiCalls: ai.reduce((s, r) => s + Number(r.calls), 0),
    aiErrors: ai.reduce((s, r) => s + Number(r.errors), 0),
    agent,
    stuckSessions: stuck.count ?? 0,
    newErrorGroups: Number(newGroups.data ?? 0),
    budget: budget ? { dailyUsd: budget.dailyUsd, spentUsd: await getSpendToday().catch(() => 0) } : null,
  };
}

/**
 * The scheduled health check: measures, opens an alert (and notifies) for
 * anything newly wrong, resolves (and notifies) anything that recovered.
 * One open alert per kind, so a long outage sends one message, not one per run.
 */
export async function runHealthCheck() {
  const db = getSupabaseAdmin();
  const { data: settingsRows } = await db.from("lms_app_settings").select("key, value").in("key", ["alerts", "budget"]);
  const settings = alertSettings(settingsRows?.find((r) => r.key === "alerts")?.value);
  if (!settings.enabled) return { enabled: false as const };

  const measurements = await measure(settingsRows ?? []);
  const checks = evaluate(measurements, settings);
  const { data: open } = await db.from("lms_alerts").select("kind").is("resolved_at", null);
  const { toOpen, toResolve } = planAlertChanges(checks, (open ?? []).map((a) => a.kind));

  const link = appUrl("/admin/alerts");
  for (const c of toOpen) {
    // The unique index (one open alert per kind) stops a parallel run from double-sending.
    const { error } = await db.from("lms_alerts").insert({ kind: c.kind, severity: c.severity, message: c.message, details: c.details ?? {} });
    if (error) continue;
    await notifyAdmins(`${c.severity === "critical" ? "🔴" : "🟠"} ${c.message.split(".")[0]}`, `${c.message}\n\n${link}`);
  }
  if (toResolve.length) {
    await db.from("lms_alerts").update({ resolved_at: new Date().toISOString() }).in("kind", toResolve).is("resolved_at", null);
    for (const kind of toResolve) {
      await notifyAdmins(`✅ resolved: ${kind.replace("_", " ")}`, `This alert cleared on its own.\n\n${link}`);
    }
  }
  return { enabled: true as const, measurements, opened: toOpen.map((c) => c.kind), resolved: toResolve };
}
