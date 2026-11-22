import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, FilterBar, FilterSearch, FilterSelect, PageHeader, Pager, Panel, Skeleton, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { DOMAINS, DIFFICULTIES, domainShort } from "@/lib/constants";
import { db, emailsFor, isUuid } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { UNSCORED_RESULTS_FILTER, missingSuggestionIndexes } from "@/lib/admin/rescore";
import { nowMs, pageParam, param } from "@/lib/admin/range";
import type { QuestionResult, SessionConfig } from "@/types";

export const metadata: Metadata = { title: "sessions" };

const PAGE_SIZE = 50;
const STUCK_MS = 2 * 60 * 60 * 1000;
/** How many recent completed sessions the "missing suggested answers" filter checks. */
const SCAN_LIMIT = 500;

export default function SessionsPage({ searchParams }: PageProps<"/admin/sessions">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Sessions searchParams={searchParams} />
    </Suspense>
  );
}

async function Sessions({ searchParams }: { searchParams: PageProps<"/admin/sessions">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = param(sp.status);
  const domain = param(sp.domain);
  const difficulty = param(sp.difficulty);
  const user = param(sp.user);
  const page = pageParam(sp.page);

  // "Missing suggested answers" can't be a database filter (it's a key that's
  // absent), so it scans the most recent completed sessions here instead.
  const scanMissing = status === "nosuggest";
  let query = db()
    .from("lms_sessions")
    .select("id, user_id, config, status, total, results, created_at, completed_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(scanMissing ? 0 : (page - 1) * PAGE_SIZE, scanMissing ? SCAN_LIMIT - 1 : page * PAGE_SIZE - 1);
  if (scanMissing) {
    query = query.eq("status", "completed");
  } else if (status === "stuck") {
    query = query.eq("status", "in_progress").lt("created_at", new Date(nowMs() - STUCK_MS).toISOString());
  } else if (status === "unscored") {
    query = query.neq("status", "abandoned").filter("results", "cs", UNSCORED_RESULTS_FILTER);
  } else if (["in_progress", "completed", "abandoned"].includes(status)) {
    query = query.eq("status", status);
  }
  if (DOMAINS.some((d) => d.value === domain)) query = query.eq("config->>domain", domain);
  if ((DIFFICULTIES as string[]).includes(difficulty)) query = query.eq("config->>difficulty", difficulty);
  if (user && isUuid(user)) query = query.eq("user_id", user);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const fetched = (data ?? []) as {
    id: string;
    user_id: string;
    config: SessionConfig;
    status: string;
    total: number | null;
    results: QuestionResult[];
    created_at: string;
    completed_at: string | null;
  }[];
  const matching = scanMissing ? fetched.filter((r) => missingSuggestionIndexes(r.results ?? []).length > 0) : fetched;
  const rows = scanMissing ? matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : matching;
  const total = scanMissing ? matching.length : (count ?? 0);
  const people = await emailsFor(rows.map((r) => r.user_id));
  const now = nowMs();

  return (
    <>
      <PageHeader title="sessions" description="every practice session, newest first." />
      <Panel>
        <FilterBar action="/admin/sessions">
          <FilterSearch name="user" defaultValue={user} placeholder="user id" />
          <FilterSelect
            name="status"
            label="status"
            value={status}
            options={[
              { value: "in_progress", label: "in progress" },
              { value: "stuck", label: "stuck (> 2h)" },
              { value: "unscored", label: "has unscored answers" },
              { value: "nosuggest", label: "missing suggested answers" },
              { value: "completed", label: "completed" },
              { value: "abandoned", label: "abandoned" },
            ]}
          />
          <FilterSelect name="domain" label="domain" value={domain} options={DOMAINS.map((d) => ({ value: d.value, label: d.short }))} />
          <FilterSelect name="difficulty" label="level" value={difficulty} options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} />
        </FilterBar>
        <Table head={["started", "user", "domain", "level", "answers", "status", "score"]} empty={!rows.length}>
          {rows.map((s) => {
            const answered = s.results.filter((r) => r?.answer && !r.skipped).length;
            const notScored = s.results.filter((r) => r?.scoring?.status === "failed").length;
            const noSuggestion = missingSuggestionIndexes(s.results ?? []).length;
            const stuck = s.status === "in_progress" && now - new Date(s.created_at).getTime() > STUCK_MS;
            const who = people.get(s.user_id);
            return (
              <Tr key={s.id}>
                <Td className="whitespace-nowrap">
                  <TextLink href={`/admin/sessions/${s.id}`}>{fmtDateTime(s.created_at)}</TextLink>
                </Td>
                <Td className="min-w-[12rem]">
                  <TextLink href={`/admin/users/${s.user_id}`}>{who?.name || who?.email || s.user_id.slice(0, 8)}</TextLink>
                  {who?.email && <div className="text-[12px] text-subtle">{who.email}</div>}
                </Td>
                <Td>{domainShort(s.config.domain)}</Td>
                <Td>{s.config.difficulty}</Td>
                <Td className="tabular-nums whitespace-nowrap">
                  {answered}/{s.config.count ?? s.results.length}
                  {notScored > 0 && <span className="ml-1.5 text-[12px] text-[#fab219]">{notScored} not scored</span>}
                  {noSuggestion > 0 && <span className="ml-1.5 text-[12px] text-subtle">{noSuggestion} no suggestion</span>}
                </Td>
                <Td>{stuck ? <Badge>stuck</Badge> : s.status.replace("_", " ")}</Td>
                <Td className="tabular-nums">{s.total ?? "—"}</Td>
              </Tr>
            );
          })}
        </Table>
        {scanMissing && (
          <p className="mt-3 text-[12px] text-faint">checked the {SCAN_LIMIT} most recent completed sessions.</p>
        )}
        <Pager path="/admin/sessions" params={{ status, domain, difficulty, user }} page={page} pageSize={PAGE_SIZE} total={total} />
      </Panel>
    </>
  );
}
