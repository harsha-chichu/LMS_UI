import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetForm, RateLimitsForm } from "@/components/admin/ConfigForms";
import { SettingToggle } from "@/components/admin/SettingToggle";
import { KpiGrid, KpiTile, PageHeader, Panel, Skeleton, Status, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { pingAgent } from "@/lib/agent/client";
import { mfaRequired } from "@/lib/admin/access";
import { db, getAppSettings, rpc } from "@/lib/admin/data";
import { parseAdminEmails } from "@/lib/admin/emails";
import { fmtBytes, fmtDateTime, fmtNum, fmtUsd } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/range";
import type { BudgetSetting } from "@/lib/admin/session-block";
import { getSpendToday } from "@/lib/admin/spend";
import { LIMIT_LABELS, LIMIT_NAMES, type LimitName, resolveLimit } from "@/lib/limits";

export const metadata: Metadata = { title: "system" };

type DbStats = { db_bytes: number; tables: Record<string, number> };
type RateRow = { user_id: string; email: string | null; bucket: string; window_start: string; count: number };

/** Env settings by name; `required` ones show red when missing, the rest grey (the feature is just off). */
const ENV_VARS = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL", true],
  ["SUPABASE_SERVICE_ROLE_KEY", "server writes and this dashboard (or SUPABASE_SECRET_KEY)", true],
  ["ANTHROPIC_API_KEY", "question generation, fallback scoring, reports", true],
  ["ADMIN_EMAILS", "who can open this dashboard", true],
  ["CRON_SECRET", "scheduled health checks: alerts and the budget alert", true],
  ["EVAL_AGENT_URL", "eval agent", false],
  ["EVAL_AGENT_TOKEN", "eval agent auth", false],
  ["DEEPGRAM_API_KEY", "live transcription", false],
  ["RESEND_API_KEY", "sending email (alerts, /admin/email)", false],
  ["EMAIL_FROM", "sender address for emails", false],
  ["ALERT_EMAILS", "who gets alert emails (else ADMIN_EMAILS)", false],
  ["ALERT_WEBHOOK_URL", "Slack or Discord channel for alerts", false],
  ["NEXT_PUBLIC_APP_URL", "links in emails and alerts", false],
] as const;

export default function SystemPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <System />
    </Suspense>
  );
}

async function System() {
  const { access } = await requireAdminPage();
  const canWrite = access === "admin";
  const started = nowMs();
  const [dbStats, agent, settings, rate, extra, spent, lastClaude] = await Promise.all([
    rpc<DbStats>("lms_admin_db_stats").catch((e: Error) => ({ error: e.message }) as const),
    pingAgent(),
    getAppSettings(),
    rpc<RateRow[]>("lms_admin_rate_limit_top", { p_limit: 20 }).catch(() => [] as RateRow[]),
    db().from("lms_app_settings").select("key, value").in("key", ["rate_limits", "budget"]),
    getSpendToday().catch(() => null),
    // The newest Claude call says more than "a key is set": it shows whether Claude accepts it.
    db().from("lms_usage_events").select("ok, error, created_at").eq("kind", "claude").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const dbMs = nowMs() - started;
  const dbOk = !("error" in dbStats);
  const isSet = (name: string) =>
    name === "SUPABASE_SERVICE_ROLE_KEY"
      ? Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
      : Boolean(process.env[name]);
  const configured = (extra.data?.find((r) => r.key === "rate_limits")?.value ?? {}) as Partial<Record<string, number>>;
  const budget = (extra.data?.find((r) => r.key === "budget")?.value ?? {}) as BudgetSetting;
  const limitOf = (bucket: string) =>
    (LIMIT_NAMES as string[]).includes(bucket) ? resolveLimit(bucket as LimitName, "", configured, []) : Infinity;
  const atLimit = rate.filter((r) => r.count >= limitOf(r.bucket));
  const dailyUsd = Number(budget.daily_usd) || 0;
  const last = lastClaude.data as { ok: boolean; error: string | null; created_at: string } | null;
  const keyRejected = Boolean(last && !last.ok && /401|authentication_error|x-api-key/i.test(last.error ?? ""));
  const claudeState: { value: string; tone: "good" | "warning" | "critical"; note?: string } = !isSet("ANTHROPIC_API_KEY")
    ? { value: "no key", tone: "warning", note: "backup scoring and new questions are off" }
    : keyRejected
      ? { value: "key rejected", tone: "critical", note: `Claude said the API key is invalid (${fmtDateTime(last!.created_at)}). Replace ANTHROPIC_API_KEY in Vercel and redeploy.` }
      : last && !last.ok
        ? { value: "failing", tone: "warning", note: (last.error ?? "").slice(0, 80) }
        : { value: "key set", tone: "good", note: last ? `last call ok · ${fmtDateTime(last.created_at)}` : "not called yet" };

  return (
    <>
      <PageHeader title="system" description="live checks run when this page loads." />
      <div className="flex flex-col gap-4">
        <KpiGrid>
          <KpiTile label="database" value={dbOk ? "up" : "error"} tone={dbOk ? "good" : "critical"} sub={dbOk ? `${fmtBytes(dbStats.db_bytes)} · ${dbMs} ms` : dbStats.error} />
          <KpiTile
            label="eval agent"
            value={!agent.configured ? "off" : agent.reachable ? "up" : "down"}
            tone={!agent.configured ? "neutral" : agent.reachable ? "good" : "critical"}
            sub={!agent.configured ? "scoring uses claude only" : agent.reachable ? `HTTP ${agent.status} · ${agent.ms} ms` : agent.error}
          />
          <KpiTile
            label="claude (backup scorer)"
            value={claudeState.value}
            tone={claudeState.tone}
            sub={
              <>
                {claudeState.note && <span className="block">{claudeState.note}</span>}
                <TextLink href="/admin/ai">error rates →</TextLink>
              </>
            }
          />
          <KpiTile label="deepgram" value={isSet("DEEPGRAM_API_KEY") ? "key set" : "off"} tone={isSet("DEEPGRAM_API_KEY") ? "good" : "neutral"} sub={isSet("DEEPGRAM_API_KEY") ? undefined : "browser speech recognition"} />
          <KpiTile label="env admins" value={fmtNum(parseAdminEmails(process.env.ADMIN_EMAILS).size)} sub="from ADMIN_EMAILS" />
          <KpiTile label="deploy" value={process.env.VERCEL_ENV ?? "local"} sub={process.env.VERCEL_GIT_COMMIT_SHA ? `commit ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : undefined} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="switches" note="apply to every user immediately">
            {!canWrite ? (
              <ul className="flex flex-col gap-2 text-[13px]">
                <li>
                  <Status tone={settings.maintenance.enabled ? "warning" : "good"}>maintenance mode: {settings.maintenance.enabled ? "on" : "off"}</Status>
                </li>
                <li>
                  <Status tone={settings.sessions_paused.enabled ? "warning" : "good"}>new sessions paused: {settings.sessions_paused.enabled ? "yes" : "no"}</Status>
                </li>
              </ul>
            ) : (
            <div className="flex flex-col gap-5">
              <SettingToggle
                settingKey="sessions_paused"
                title="pause new sessions"
                help="users can finish sessions in progress, but can't start new ones. use during AI outages."
                enabled={settings.sessions_paused.enabled}
                message={settings.sessions_paused.message}
              />
              <SettingToggle
                settingKey="maintenance"
                title="maintenance mode"
                help="shows a banner and stops new sessions. users can still browse their profile, reports and friends, and finish sessions already in progress."
                enabled={settings.maintenance.enabled}
                message={settings.maintenance.message}
              />
            </div>
            )}
          </Panel>

          <Panel title="configuration" note="names only — values are never shown">
            <ul className="flex flex-col gap-2.5">
              {ENV_VARS.map(([name, what, required]) => (
                <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <Status tone={isSet(name) ? "good" : required ? "critical" : "neutral"}>
                    <code className="text-[12px]">{name}</code>
                  </Status>
                  <span className="text-[12px] text-subtle">{what}</span>
                </li>
              ))}
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <Status tone={mfaRequired() ? "good" : "warning"}>
                  <code className="text-[12px]">ADMIN_MFA_REQUIRED</code>
                </Status>
                <span className="text-[12px] text-subtle">two-factor sign-in for admins: {mfaRequired() ? "required" : "OFF"}</span>
              </li>
            </ul>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="daily AI budget" note="estimated Claude spend, resets at midnight UTC">
            <div className="mb-4">
              <div className="flex items-baseline justify-between text-[13px]">
                <span>
                  today: <strong className="tabular-nums">{spent == null ? "—" : fmtUsd(spent)}</strong>
                  {budget.enabled && dailyUsd > 0 && <span className="text-subtle"> of {fmtUsd(dailyUsd)}</span>}
                </span>
                <span className="text-[12px] text-subtle">{budget.enabled && dailyUsd > 0 ? "budget on" : "budget off"}</span>
              </div>
              {budget.enabled && dailyUsd > 0 && spent != null && (
                <div className="mt-2 h-2 rounded-full bg-track" role="meter" aria-valuemin={0} aria-valuemax={dailyUsd} aria-valuenow={spent} aria-label="spend today">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (spent / dailyUsd) * 100)}%` }} />
                </div>
              )}
            </div>
            {canWrite ? (
              <BudgetForm enabled={Boolean(budget.enabled)} dailyUsd={dailyUsd} />
            ) : (
              <p className="text-[12px] text-subtle">read-only</p>
            )}
            <p className="mt-3 text-[12px] text-faint">
              When today&apos;s spend reaches the limit, new sessions pause until midnight UTC (sessions already running finish).
              Alerts go out at 80% and 100%.
            </p>
          </Panel>

          <Panel title="rate limits" note="per user; changes apply within a minute">
            {canWrite ? (
              <RateLimitsForm current={Object.fromEntries(LIMIT_NAMES.map((n) => [n, resolveLimit(n, "", configured, [])]))} />
            ) : (
              <Table head={["limit", "value"]}>
                {LIMIT_NAMES.map((n) => (
                  <Tr key={n}>
                    <Td>{LIMIT_LABELS[n]}</Td>
                    <Td className="tabular-nums">{resolveLimit(n, "", configured, [])}</Td>
                  </Tr>
                ))}
              </Table>
            )}
            <p className="mt-3 text-[12px] text-faint">Give one user a temporary exception from their page in users.</p>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="table sizes" note="rows">
            {dbOk ? (
              <Table head={["table", "rows"]}>
                {Object.entries(dbStats.tables).map(([t, n]) => (
                  <Tr key={t}>
                    <Td>
                      <code className="text-[12px]">{t}</code>
                    </Td>
                    <Td className="tabular-nums">{fmtNum(n)}</Td>
                  </Tr>
                ))}
              </Table>
            ) : (
              <Status tone="critical">{dbStats.error}</Status>
            )}
          </Panel>

          <Panel title="busiest rate-limit buckets" note={`last 24h · ${atLimit.length} at their limit`}>
            <Table head={["user", "bucket", "window", "used"]} empty={!rate.length}>
              {rate.map((r) => {
                const limit = Number.isFinite(limitOf(r.bucket)) ? limitOf(r.bucket) : undefined;
                return (
                  <Tr key={`${r.user_id}-${r.bucket}-${r.window_start}`}>
                    <Td>
                      <TextLink href={`/admin/users/${r.user_id}`}>{r.email ?? r.user_id.slice(0, 8)}</TextLink>
                    </Td>
                    <Td>{r.bucket}</Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(r.window_start)}</Td>
                    <Td className="tabular-nums">
                      {r.count}
                      {limit ? ` / ${limit}` : ""}
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          </Panel>
        </div>

        <Panel title="external dashboards">
          <p className="text-[13px] leading-relaxed text-subtle">
            Server logs and deploys live in Vercel, database metrics and slow queries in the Supabase dashboard, and API spend in the Anthropic and Deepgram
            consoles. The numbers on this dashboard are recorded by the app itself.
          </p>
        </Panel>
      </div>
    </>
  );
}
