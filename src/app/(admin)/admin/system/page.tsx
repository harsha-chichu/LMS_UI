import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingToggle } from "@/components/admin/SettingToggle";
import { KpiGrid, KpiTile, PageHeader, Panel, Skeleton, Status, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { pingAgent } from "@/lib/agent/client";
import { getAppSettings, rpc } from "@/lib/admin/data";
import { parseAdminEmails } from "@/lib/admin/emails";
import { fmtBytes, fmtDateTime, fmtNum } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/range";
import { LIMITS } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "system" };

type DbStats = { db_bytes: number; tables: Record<string, number> };
type RateRow = { user_id: string; email: string | null; bucket: string; window_start: string; count: number };

const ENV_VARS = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["SUPABASE_SERVICE_ROLE_KEY", "server writes and this dashboard (or SUPABASE_SECRET_KEY)"],
  ["ANTHROPIC_API_KEY", "question generation, fallback scoring, reports"],
  ["EVAL_AGENT_URL", "eval agent"],
  ["EVAL_AGENT_TOKEN", "eval agent auth"],
  ["DEEPGRAM_API_KEY", "live transcription"],
  ["ADMIN_EMAILS", "who can open this dashboard"],
] as const;

export default function SystemPage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <System />
    </Suspense>
  );
}

async function System() {
  await requireAdminPage();
  const started = nowMs();
  const [dbStats, agent, settings, rate] = await Promise.all([
    rpc<DbStats>("lms_admin_db_stats").catch((e: Error) => ({ error: e.message }) as const),
    pingAgent(),
    getAppSettings(),
    rpc<RateRow[]>("lms_admin_rate_limit_top", { p_limit: 20 }).catch(() => [] as RateRow[]),
  ]);
  const dbMs = nowMs() - started;
  const dbOk = !("error" in dbStats);
  const isSet = (name: string) =>
    name === "SUPABASE_SERVICE_ROLE_KEY"
      ? Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
      : Boolean(process.env[name]);
  const atLimit = rate.filter((r) => r.count >= (LIMITS[r.bucket as keyof typeof LIMITS]?.limit ?? Infinity));

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
          <KpiTile label="claude" value={isSet("ANTHROPIC_API_KEY") ? "key set" : "no key"} tone={isSet("ANTHROPIC_API_KEY") ? "good" : "critical"} sub={<TextLink href="/admin/ai">error rates →</TextLink>} />
          <KpiTile label="deepgram" value={isSet("DEEPGRAM_API_KEY") ? "key set" : "off"} tone={isSet("DEEPGRAM_API_KEY") ? "good" : "neutral"} sub={isSet("DEEPGRAM_API_KEY") ? undefined : "browser speech recognition"} />
          <KpiTile label="env admins" value={fmtNum(parseAdminEmails(process.env.ADMIN_EMAILS).size)} sub="from ADMIN_EMAILS" />
          <KpiTile label="deploy" value={process.env.VERCEL_ENV ?? "local"} sub={process.env.VERCEL_GIT_COMMIT_SHA ? `commit ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : undefined} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="switches" note="apply to every user immediately">
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
                title="maintenance banner"
                help="shows a banner across the app with your message."
                enabled={settings.maintenance.enabled}
                message={settings.maintenance.message}
              />
            </div>
          </Panel>

          <Panel title="configuration" note="names only — values are never shown">
            <ul className="flex flex-col gap-2.5">
              {ENV_VARS.map(([name, what]) => (
                <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <Status tone={isSet(name) ? "good" : name === "DEEPGRAM_API_KEY" || name.startsWith("EVAL_AGENT") ? "neutral" : "critical"}>
                    <code className="text-[12px]">{name}</code>
                  </Status>
                  <span className="text-[12px] text-subtle">{what}</span>
                </li>
              ))}
            </ul>
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
                const limit = LIMITS[r.bucket as keyof typeof LIMITS]?.limit;
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
