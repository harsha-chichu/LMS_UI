import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/actions";
import { QuestionForm } from "@/components/admin/QuestionForm";
import {
  Badge,
  FilterBar,
  FilterSearch,
  FilterSelect,
  PageHeader,
  Pager,
  Panel,
  Skeleton,
  Status,
  Table,
  Td,
  TextLink,
  Tr,
  withParams,
} from "@/components/admin/ui";
import { DIFFICULTIES, DOMAINS, domainShort } from "@/lib/constants";
import { db, isUuid, rpc } from "@/lib/admin/data";
import { fmtNum, fmtPct } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { pageParam, param } from "@/lib/admin/range";
import type { Domain } from "@/types";

export const metadata: Metadata = { title: "questions" };

const PAGE_SIZE = 50;
/** Fewer active questions than this at one domain + level gets flagged. */
const THIN = 15;

type Row = {
  id: string;
  domain: string;
  difficulty: string;
  text: string;
  topics: string[];
  source: string;
  status: string;
  times_asked: number;
  times_skipped: number;
  avg_score: number | null;
  created_at: string;
  total_count: number;
};
type Coverage = { domain: string; difficulty: string; active: number; retired: number; generated: number };

export default function QuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Questions searchParams={searchParams} />
    </Suspense>
  );
}

async function Questions({ searchParams }: { searchParams: PageProps<"/admin/questions">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const f = {
    domain: param(sp.domain),
    difficulty: param(sp.difficulty),
    status: param(sp.status),
    source: param(sp.source),
    q: param(sp.q),
    sort: param(sp.sort),
  };
  const page = pageParam(sp.page);
  const edit = param(sp.edit);

  const [rows, coverage, editRes] = await Promise.all([
    rpc<Row[]>("lms_admin_questions", {
      p_domain: f.domain || null,
      p_difficulty: f.difficulty || null,
      p_status: f.status || null,
      p_source: f.source || null,
      p_q: f.q || null,
      p_sort: f.sort || "recent",
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    rpc<Coverage[]>("lms_admin_bank_coverage"),
    edit && isUuid(edit)
      ? db().from("lms_questions").select("id, domain, difficulty, text, topics, status").eq("id", edit).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const total = Number(rows[0]?.total_count ?? 0);
  const editing = (editRes.data ?? undefined) as { id: string; domain: string; difficulty: string; text: string; topics: string[]; status: string } | undefined;
  const thin = coverage.filter((c) => Number(c.active) < THIN);
  const keep = { ...f, page: page > 1 ? String(page) : undefined };

  return (
    <>
      <PageHeader
        title="question bank"
        description="questions sessions are picked from. generated ones were written by Claude when the bank ran short."
        actions={
          <a href={withParams("/api/admin/questions/export", f)} className="inline-flex h-9 items-center rounded-full bg-surface-3 px-4 text-[13px] hover:bg-surface-2">
            export CSV
          </a>
        }
      />

      <div className="flex flex-col gap-4">
        {editing ? (
          <Panel title="edit question" note={<TextLink href={withParams("/admin/questions", keep)}>close</TextLink>}>
            <QuestionForm question={editing} />
          </Panel>
        ) : (
          <Panel>
            <details>
              <summary className="cursor-pointer text-[13px] text-subtle hover:text-foreground">add a question</summary>
              <div className="mt-4">
                <QuestionForm />
              </div>
            </details>
          </Panel>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <Panel title="coverage" note="active questions per domain and level">
            <Table head={["domain", "easy", "medium", "hard"]}>
              {DOMAINS.map((d) => (
                <Tr key={d.value}>
                  <Td>{d.short}</Td>
                  {DIFFICULTIES.map((lvl) => {
                    const c = coverage.find((x) => x.domain === d.value && x.difficulty === lvl);
                    const n = Number(c?.active ?? 0);
                    return (
                      <Td key={lvl} className="tabular-nums">
                        <TextLink href={withParams("/admin/questions", { domain: d.value, difficulty: lvl })}>{n}</TextLink>
                        {Number(c?.generated ?? 0) > 0 && <span className="ml-1.5 text-[12px] text-subtle">({c!.generated} gen)</span>}
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </Table>
          </Panel>
          <Panel title="running thin" note={`< ${THIN} active`}>
            {thin.length ? (
              <ul className="flex flex-col gap-2">
                {thin.map((c) => (
                  <li key={`${c.domain}-${c.difficulty}`}>
                    <Status tone="warning">
                      {domainShort(c.domain as Domain)} · {c.difficulty}: {c.active} active
                    </Status>
                  </li>
                ))}
              </ul>
            ) : (
              <Status tone="good">every domain and level has enough questions.</Status>
            )}
            <p className="mt-4 text-[12px] text-faint">
              <TextLink href="/admin/questions?source=generated&status=active">review generated questions</TextLink>
              {" · "}
              <TextLink href="/admin/questions?sort=skip">most skipped</TextLink>
              {" · "}
              <TextLink href="/admin/questions?sort=score_low">lowest scores</TextLink>
            </p>
          </Panel>
        </div>

        <Panel>
          <FilterBar action="/admin/questions">
            <FilterSearch name="q" defaultValue={f.q} placeholder="text or topic" />
            <FilterSelect name="domain" label="domain" value={f.domain} options={DOMAINS.map((d) => ({ value: d.value, label: d.short }))} />
            <FilterSelect name="difficulty" label="level" value={f.difficulty} options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} />
            <FilterSelect name="status" label="status" value={f.status} options={[{ value: "active", label: "active" }, { value: "retired", label: "retired" }]} />
            <FilterSelect name="source" label="source" value={f.source} options={[{ value: "seed", label: "seed" }, { value: "generated", label: "generated" }]} />
            <FilterSelect
              name="sort"
              label="sort"
              value={f.sort}
              options={[
                { value: "asked", label: "most asked" },
                { value: "skip", label: "highest skip rate" },
                { value: "score_low", label: "lowest avg score" },
              ]}
            />
          </FilterBar>
          <Table head={["question", "domain", "level", "asked", "skip rate", "avg /10", ""]} empty={!rows.length}>
            {rows.map((q) => (
              <Tr key={q.id} className={q.status === "retired" ? "opacity-55" : undefined}>
                <Td className="min-w-[20rem] max-w-[36rem]">
                  <div className="leading-snug">{q.text}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.source === "generated" && <Badge tone="brand">generated</Badge>}
                    {q.status === "retired" && <Badge>retired</Badge>}
                    {q.topics.map((t) => (
                      <Badge key={t} tone="muted">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td>{domainShort(q.domain as Domain)}</Td>
                <Td>{q.difficulty}</Td>
                <Td className="tabular-nums">{fmtNum(q.times_asked)}</Td>
                <Td className="tabular-nums">{fmtPct(q.times_skipped, q.times_asked)}</Td>
                <Td className="tabular-nums">{fmtNum(q.avg_score, 1)}</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    <TextLink href={withParams("/admin/questions", { ...keep, edit: q.id })}>edit</TextLink>
                    <ActionButton url={`/api/admin/questions/${q.id}`} method="PATCH" body={{ status: q.status === "active" ? "retired" : "active" }}>
                      {q.status === "active" ? "retire" : "restore"}
                    </ActionButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
          <Pager path="/admin/questions" params={f} page={page} pageSize={PAGE_SIZE} total={total} />
        </Panel>
      </div>
    </>
  );
}
