import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, EmptyState, KpiGrid, KpiTile, PageHeader, Panel, RangeTabs, Skeleton, Table, Td, TextLink, Tr, withParams } from "@/components/admin/ui";
import { db, emailsFor, rpc } from "@/lib/admin/data";
import { fmtDateTime, fmtNum } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs, param, parseRange } from "@/lib/admin/range";

export const metadata: Metadata = { title: "errors" };

type Group = {
  fingerprint: string;
  source: string;
  route: string | null;
  message: string;
  occurrences: number;
  users: number;
  first_seen: string;
  last_seen: string;
  first_seen_ever: string;
};

export default function ErrorsPage({ searchParams }: PageProps<"/admin/errors">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Errors searchParams={searchParams} />
    </Suspense>
  );
}

async function Errors({ searchParams }: { searchParams: PageProps<"/admin/errors">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const { days, from, to } = parseRange(sp.range);
  const fp = param(sp.fp);
  const groups = await rpc<Group[]>("lms_admin_errors", { p_from: from.toISOString(), p_to: to.toISOString() });
  const total = groups.reduce((s, g) => s + Number(g.occurrences), 0);
  const dayAgo = nowMs() - 86_400_000;
  const newToday = groups.filter((g) => new Date(g.first_seen_ever).getTime() >= dayAgo).length;

  const selected = fp ? groups.find((g) => g.fingerprint === fp) : undefined;
  const occurrences = fp
    ? ((
        await db()
          .from("lms_error_events")
          .select("id, route, message, digest, user_id, details, created_at")
          .eq("fingerprint", fp)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [])
    : [];
  const people = await emailsFor(occurrences.map((o) => o.user_id));

  return (
    <>
      <PageHeader
        title="errors"
        description={`server errors, grouped when they're the same problem · last ${days} days`}
        actions={<RangeTabs path="/admin/errors" params={{}} days={days} />}
      />
      <div className="flex flex-col gap-4">
        <KpiGrid>
          <KpiTile label="errors" value={fmtNum(total)} sub={`${groups.length} kinds`} tone={total ? "warning" : "good"} />
          <KpiTile label="new kinds (24h)" value={fmtNum(newToday)} tone={newToday ? "warning" : "good"} />
        </KpiGrid>

        {selected && (
          <Panel title="occurrences" note={<TextLink href={withParams("/admin/errors", { range: String(days) })}>close</TextLink>}>
            <p className="mb-3 text-[14px] break-words">{selected.message}</p>
            <ul className="flex flex-col gap-3">
              {occurrences.map((o) => {
                const who = o.user_id ? people.get(o.user_id) : undefined;
                const stack = (o.details as { stack?: string } | null)?.stack;
                return (
                  <li key={o.id} className="border-t border-line pt-3 text-[13px]">
                    <div className="flex flex-wrap gap-x-3 text-[12px] text-subtle">
                      <span>{fmtDateTime(o.created_at)}</span>
                      {o.route && <code>{o.route}</code>}
                      {o.user_id && <TextLink href={`/admin/users/${o.user_id}`}>{who?.email ?? o.user_id.slice(0, 8)}</TextLink>}
                      {o.digest && <span>digest {o.digest}</span>}
                    </div>
                    {stack && <pre className="mt-2 max-h-40 overflow-auto rounded-[10px] bg-surface-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-subtle">{stack}</pre>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        <Panel>
          {groups.length ? (
            <Table head={["error", "where", "count", "users", "last seen", "first seen"]}>
              {groups.map((g) => (
                <Tr key={g.fingerprint}>
                  <Td className="min-w-[18rem] max-w-[34rem]">
                    <TextLink href={withParams("/admin/errors", { range: String(days), fp: g.fingerprint })} className="break-words">
                      {g.message.length > 160 ? `${g.message.slice(0, 160)}…` : g.message}
                    </TextLink>
                    {new Date(g.first_seen_ever).getTime() >= dayAgo && (
                      <span className="ml-2">
                        <Badge tone="brand">new</Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12px]">
                    <div>{g.source}</div>
                    {g.route && <code className="text-subtle">{g.route}</code>}
                  </Td>
                  <Td className="tabular-nums">{fmtNum(g.occurrences)}</Td>
                  <Td className="tabular-nums">{fmtNum(g.users)}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(g.last_seen)}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(g.first_seen_ever)}</Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <EmptyState>no server errors in this range.</EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}
