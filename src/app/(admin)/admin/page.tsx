import type { Metadata } from "next";
import { Suspense } from "react";
import { ColumnChart, FunnelBars, ShareBars } from "@/components/admin/charts";
import { KpiGrid, KpiTile, PageHeader, Panel, RangeTabs, Skeleton, Status, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { domainShort } from "@/lib/constants";
import { db, rpc } from "@/lib/admin/data";
import { fmtNum, fmtPct } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs, parseRange } from "@/lib/admin/range";
import type { Domain } from "@/types";

export const metadata: Metadata = { title: "overview" };

type Overview = {
  users_total: number;
  users_new: number;
  users_suspended: number;
  active_users: number;
  dau: number;
  mau: number;
  sessions_started: number;
  sessions_completed: number;
  sessions_abandoned: number;
  sessions_in_progress: number;
  stuck_sessions: number;
  avg_total: number | null;
  feedback_new: number;
  questions_active: number;
};

type Daily = {
  day: string;
  signups: number;
  sessions_started: number;
  sessions_completed: number;
  active_users: number;
  avg_total: number | null;
};

type DomainRow = { domain: string; difficulty: string; sessions: number; completed: number; avg_total: number | null };
type Retention = { week: string; signups: number; d1: number; d7: number; d30: number };
type UsageOp = { kind: string; operation: string; calls: number; errors: number };
type Funnel = { signed_up: number; started: number; completed: number; returned: number };

export default function OverviewPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

async function Overview({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const { days, from, to } = parseRange(sp.range);
  const range = { p_from: from.toISOString(), p_to: to.toISOString() };

  const supabase = db();
  const [o, daily, domains, retention, ops, funnel, openAlerts, unscored, newErrors] = await Promise.all([
    rpc<Overview>("lms_admin_overview", range),
    rpc<Daily[]>("lms_admin_daily", range),
    rpc<DomainRow[]>("lms_admin_domain_breakdown", range),
    rpc<Retention[]>("lms_admin_retention", { p_weeks: 8 }),
    rpc<UsageOp[]>("lms_admin_usage_ops", {
      p_from: new Date(nowMs() - 86_400_000).toISOString(),
      p_to: new Date(nowMs() + 60_000).toISOString(),
    }),
    rpc<Funnel>("lms_admin_funnel", range),
    supabase.from("lms_alerts").select("id, kind, severity, message").is("resolved_at", null),
    supabase
      .from("lms_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", from.toISOString())
      .contains("results", [{ scoring: { status: "failed" } }]),
    rpc<number>("lms_admin_new_error_groups", { p_since: new Date(nowMs() - 86_400_000).toISOString() }),
  ]);

  const byDomain = new Map<string, { sessions: number; completed: number }>();
  for (const r of domains) {
    const cur = byDomain.get(r.domain) ?? { sessions: 0, completed: 0 };
    cur.sessions += Number(r.sessions);
    cur.completed += Number(r.completed);
    byDomain.set(r.domain, cur);
  }

  const calls24 = ops.reduce((s, r) => s + Number(r.calls), 0);
  const errors24 = ops.reduce((s, r) => s + Number(r.errors), 0);
  const errorRate = calls24 ? errors24 / calls24 : 0;
  const completion = o.sessions_started ? o.sessions_completed / o.sessions_started : 0;

  const attention = [
    ...(openAlerts.data ?? []).map((a) => ({ href: "/admin/alerts", text: a.message, tone: a.severity === "critical" ? ("critical" as const) : ("warning" as const) })),
    (unscored.count ?? 0) > 0 && {
      href: "/admin/sessions?status=unscored",
      text: `${unscored.count} completed sessions have answers that couldn't be scored`,
      tone: "warning" as const,
    },
    Number(newErrors) > 0 && { href: "/admin/errors", text: `${newErrors} new kinds of server error in the last 24h`, tone: "warning" as const },
    o.feedback_new > 0 && { href: "/admin/feedback?status=new", text: `${o.feedback_new} new feedback`, tone: "warning" as const },
    o.stuck_sessions > 0 && { href: "/admin/sessions?status=stuck", text: `${o.stuck_sessions} stuck sessions (in progress > 2h)`, tone: "warning" as const },
    errorRate > 0.05 && { href: "/admin/ai", text: `${fmtPct(errors24, calls24)} of AI calls failed in the last 24h`, tone: "critical" as const },
  ].filter(Boolean) as { href: string; text: string; tone: "warning" | "critical" }[];

  return (
    <>
      <PageHeader
        title="overview"
        description={`last ${days} days, UTC`}
        actions={<RangeTabs path="/admin" params={{}} days={days} />}
      />

      <div className="flex flex-col gap-4">
        {attention.length > 0 ? (
          <Panel title="needs attention">
            <ul className="flex flex-col gap-2">
              {attention.map((a) => (
                <li key={a.href}>
                  <Status tone={a.tone}>
                    <TextLink href={a.href}>{a.text}</TextLink>
                  </Status>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel>
            <Status tone="good">nothing needs attention right now.</Status>
          </Panel>
        )}

        <KpiGrid>
          <KpiTile label="users" value={fmtNum(o.users_total)} sub={`+${fmtNum(o.users_new)} in range`} href="/admin/users" />
          <KpiTile label="active (24h / 30d)" value={`${fmtNum(o.dau)} / ${fmtNum(o.mau)}`} sub={`${fmtNum(o.active_users)} active in range`} />
          <KpiTile label="sessions started" value={fmtNum(o.sessions_started)} sub={`${fmtNum(o.sessions_in_progress)} in progress`} href="/admin/sessions" />
          <KpiTile label="completion rate" value={fmtPct(o.sessions_completed, o.sessions_started)} sub={`${fmtNum(o.sessions_abandoned)} abandoned`} tone={o.sessions_started ? (completion >= 0.5 ? "good" : "warning") : undefined} />
          <KpiTile label="avg score" value={fmtNum(o.avg_total, 1)} sub="completed sessions, /100" />
          <KpiTile label="AI error rate (24h)" value={calls24 ? fmtPct(errors24, calls24) : "—"} sub={`${fmtNum(calls24)} calls`} href="/admin/ai" tone={calls24 ? (errorRate > 0.05 ? "critical" : errorRate > 0.01 ? "warning" : "good") : undefined} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="sessions started per day">
            <ColumnChart label="sessions" data={daily.map((d) => ({ label: shortDay(d.day), value: Number(d.sessions_started) }))} />
          </Panel>
          <Panel title="sign-ups per day">
            <ColumnChart label="sign-ups" data={daily.map((d) => ({ label: shortDay(d.day), value: Number(d.signups) }))} />
          </Panel>
          <Panel title="active users per day">
            <ColumnChart label="users" data={daily.map((d) => ({ label: shortDay(d.day), value: Number(d.active_users) }))} />
          </Panel>
          <Panel title="average score per day" note="completed sessions">
            <ColumnChart
              label="avg score"
              unit="score"
              data={daily.map((d) => ({ label: shortDay(d.day), value: d.avg_total == null ? null : Number(d.avg_total) }))}
            />
          </Panel>
        </div>

        <Panel title="funnel" note={`people who signed up in the last ${days} days`}>
          <FunnelBars
            steps={[
              { label: "signed up", value: Number(funnel.signed_up) },
              { label: "started a session", value: Number(funnel.started) },
              { label: "finished a session", value: Number(funnel.completed) },
              { label: "came back another day", value: Number(funnel.returned) },
            ]}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="sessions by domain" note="completed in brackets">
            {byDomain.size ? (
              <ShareBars
                rows={[...byDomain.entries()]
                  .sort((a, b) => b[1].sessions - a[1].sessions)
                  .map(([d, v]) => ({ label: domainShort(d as Domain), value: v.sessions, note: `(${v.completed})` }))}
              />
            ) : (
              <p className="text-[13px] text-subtle">no sessions in this range.</p>
            )}
          </Panel>
          <Panel title="retention by sign-up week" note="came back for a session after…">
            <Table head={["week", "sign-ups", "1 day", "7 days", "30 days"]} empty={!retention.length}>
              {retention.map((r) => (
                <Tr key={r.week}>
                  <Td>{shortDay(r.week)}</Td>
                  <Td className="tabular-nums">{r.signups}</Td>
                  <Td className="tabular-nums">{fmtPct(Number(r.d1), Number(r.signups))}</Td>
                  <Td className="tabular-nums">{fmtPct(Number(r.d7), Number(r.signups))}</Td>
                  <Td className="tabular-nums">{fmtPct(Number(r.d30), Number(r.signups))}</Td>
                </Tr>
              ))}
            </Table>
          </Panel>
        </div>

        <KpiGrid>
          <KpiTile label="active questions" value={fmtNum(o.questions_active)} href="/admin/questions" />
          <KpiTile label="new feedback" value={fmtNum(o.feedback_new)} href="/admin/feedback?status=new" />
          <KpiTile label="suspended users" value={fmtNum(o.users_suspended)} href="/admin/users?sort=joined" />
          <KpiTile label="stuck sessions" value={fmtNum(o.stuck_sessions)} href="/admin/sessions?status=stuck" />
        </KpiGrid>
      </div>
    </>
  );
}
