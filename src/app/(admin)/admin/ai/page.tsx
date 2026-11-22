import type { Metadata } from "next";
import { Suspense } from "react";
import { ColumnChart, ShareBars } from "@/components/admin/charts";
import { KpiGrid, KpiTile, PageHeader, Panel, RangeTabs, Skeleton, Table, Td, Tr } from "@/components/admin/ui";
import { rpc } from "@/lib/admin/data";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { estimateCostUsd } from "@/lib/admin/pricing";
import { parseRange } from "@/lib/admin/range";

export const metadata: Metadata = { title: "ai & scoring" };

type UsageDay = {
  day: string;
  kind: string;
  model: string | null;
  calls: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  p50_ms: number | null;
  p95_ms: number | null;
};
type Op = { kind: string; operation: string; calls: number; errors: number; p50_ms: number | null; p95_ms: number | null; last_error: string | null };
type Scoring = { engine: string; status: string; answers: number };
type Bucket = { bucket: number; sessions: number };

export default function AiPage({ searchParams }: PageProps<"/admin/ai">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Ai searchParams={searchParams} />
    </Suspense>
  );
}

const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

async function Ai({ searchParams }: { searchParams: PageProps<"/admin/ai">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const { days, from, to } = parseRange(sp.range);
  const range = { p_from: from.toISOString(), p_to: to.toISOString() };

  const [usage, ops, scoring, hist] = await Promise.all([
    rpc<UsageDay[]>("lms_admin_usage", range),
    rpc<Op[]>("lms_admin_usage_ops", range),
    rpc<Scoring[]>("lms_admin_scoring_health", range),
    rpc<Bucket[]>("lms_admin_score_histogram", range),
  ]);

  const sum = (kind: string, f: (u: UsageDay) => number) => usage.filter((u) => u.kind === kind).reduce((s, u) => s + f(u), 0);
  const claudeCalls = sum("claude", (u) => Number(u.calls));
  const claudeErrors = sum("claude", (u) => Number(u.errors));
  const agentCalls = sum("agent", (u) => Number(u.calls));
  const agentErrors = sum("agent", (u) => Number(u.errors));
  const dgGrants = sum("deepgram", (u) => Number(u.calls));
  const dgErrors = sum("deepgram", (u) => Number(u.errors));
  const tokensIn = sum("claude", (u) => Number(u.input_tokens));
  const tokensOut = sum("claude", (u) => Number(u.output_tokens));
  const cost = usage.filter((u) => u.kind === "claude").reduce((s, u) => s + estimateCostUsd(u.model, Number(u.input_tokens), Number(u.output_tokens)), 0);

  // Per-day series across the whole range (days with no calls show as 0).
  const dayKeys: string[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += 86_400_000) dayKeys.push(new Date(t).toISOString().slice(0, 10));
  const perDay = (f: (u: UsageDay) => number, kind?: string) =>
    dayKeys.map((d) => ({
      label: shortDay(d),
      value: usage.filter((u) => u.day === d && (!kind || u.kind === kind)).reduce((s, u) => s + f(u), 0),
    }));

  const answers = scoring.reduce((s, r) => s + Number(r.answers), 0);
  const by = (pred: (r: Scoring) => boolean) => scoring.filter(pred).reduce((s, r) => s + Number(r.answers), 0);
  const byAgent = by((r) => r.engine === "agent");
  const byClaude = by((r) => r.engine === "claude");
  const failed = by((r) => r.status === "failed");

  return (
    <>
      <PageHeader title="ai & scoring" description={`last ${days} days. costs are estimates from token counts.`} actions={<RangeTabs path="/admin/ai" params={{}} days={days} />} />

      <div className="flex flex-col gap-4">
        <KpiGrid>
          <KpiTile label="claude calls" value={fmtNum(claudeCalls)} sub={`${fmtPct(claudeErrors, claudeCalls)} failed`} tone={claudeCalls ? (claudeErrors / claudeCalls > 0.05 ? "critical" : "good") : undefined} />
          <KpiTile label="est. claude cost" value={fmtUsd(cost)} sub={`${fmtNum(tokensIn)} in · ${fmtNum(tokensOut)} out tokens`} />
          <KpiTile label="eval agent calls" value={fmtNum(agentCalls)} sub={`${fmtPct(agentErrors, agentCalls)} failed`} tone={agentCalls ? (agentErrors / agentCalls > 0.05 ? "critical" : "good") : undefined} />
          <KpiTile label="deepgram tokens" value={fmtNum(dgGrants)} sub={`${fmtNum(dgErrors)} failed — fell back to browser`} />
          <KpiTile label="answers scored by agent" value={fmtPct(byAgent, answers)} sub={`${fmtNum(byClaude)} by claude fallback`} />
          <KpiTile label="not scored" value={fmtNum(failed)} sub={`of ${fmtNum(answers)} answers`} tone={answers ? (failed / answers > 0.02 ? "warning" : "good") : undefined} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="est. claude cost per day">
            <ColumnChart label="USD" unit="usd" data={dayKeys.map((d) => ({
              label: shortDay(d),
              value: usage.filter((u) => u.day === d && u.kind === "claude").reduce((s, u) => s + estimateCostUsd(u.model, Number(u.input_tokens), Number(u.output_tokens)), 0),
            }))} />
          </Panel>
          <Panel title="failed calls per day" note="claude, agent and deepgram">
            <ColumnChart label="failures" data={perDay((u) => Number(u.errors))} />
          </Panel>
          <Panel title="claude calls per day">
            <ColumnChart label="calls" data={perDay((u) => Number(u.calls), "claude")} />
          </Panel>
          <Panel title="session score distribution" note="completed sessions, /100">
            <ShareBars rows={Array.from({ length: 10 }, (_, i) => ({
              label: `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`,
              value: Number(hist.find((h) => Number(h.bucket) === i * 10)?.sessions ?? 0),
            }))} />
          </Panel>
        </div>

        <Panel title="by operation" note="latency in ms (median / slowest 5%)">
          <Table head={["service", "operation", "calls", "failed", "median", "p95", "last error"]} empty={!ops.length}>
            {ops.map((o) => (
              <Tr key={`${o.kind}-${o.operation}`}>
                <Td>{o.kind}</Td>
                <Td className="whitespace-nowrap">{o.operation}</Td>
                <Td className="tabular-nums">{fmtNum(o.calls)}</Td>
                <Td className="tabular-nums">{fmtPct(Number(o.errors), Number(o.calls))}</Td>
                <Td className="tabular-nums">{fmtNum(o.p50_ms)}</Td>
                <Td className="tabular-nums">{fmtNum(o.p95_ms)}</Td>
                <Td className="max-w-[24rem] text-[12px] break-words text-subtle">{o.last_error ?? "—"}</Td>
              </Tr>
            ))}
          </Table>
        </Panel>

        <Panel title="who scored answers" note="from session results">
          <Table head={["engine", "status", "answers", "share"]} empty={!scoring.length}>
            {scoring.map((r) => (
              <Tr key={`${r.engine}-${r.status}`}>
                <Td>{r.engine}</Td>
                <Td>{r.status}</Td>
                <Td className="tabular-nums">{fmtNum(r.answers)}</Td>
                <Td className="tabular-nums">{fmtPct(Number(r.answers), answers)}</Td>
              </Tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
