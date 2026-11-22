import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ScoreReview } from "@/components/admin/ScoreReview";
import { EmptyState, PageHeader, Panel, RangeTabs, Skeleton, Table, Td, TextLink, Tr, withParams } from "@/components/admin/ui";
import { domainShort } from "@/lib/constants";
import { rpc } from "@/lib/admin/data";
import { fmtNum, fmtPct } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { parseRange } from "@/lib/admin/range";
import type { Domain } from "@/types";

export const metadata: Metadata = { title: "quality" };

type Sample = {
  session_id: string;
  question_index: number;
  domain: string;
  difficulty: string;
  engine: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
};
type Summary = { domain: string; engine: string; fair: number; too_high: number; too_low: number };
type Topic = { topic: string; domain: string; attempts: number; avg_score: number | null; skip_rate: number | null; active_questions: number };

export default function QualityPage({ searchParams }: PageProps<"/admin/quality">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Quality searchParams={searchParams} />
    </Suspense>
  );
}

async function Quality({ searchParams }: { searchParams: PageProps<"/admin/quality">["searchParams"] }) {
  const { access } = await requireAdminPage();
  const sp = await searchParams;
  const { days, from, to } = parseRange(sp.range);
  const range = { p_from: from.toISOString(), p_to: to.toISOString() };
  const [sample, summary, topics] = await Promise.all([
    rpc<Sample[]>("lms_admin_score_sample", { p_n: 6 }),
    rpc<Summary[]>("lms_admin_review_summary", range),
    rpc<Topic[]>("lms_admin_topic_weakness", { ...range, p_min: 5 }),
  ]);
  const weakest = topics.filter((t) => t.avg_score != null).slice(0, 12);
  const strongest = [...topics].filter((t) => t.avg_score != null).reverse().slice(0, 6);
  const reviewed = summary.reduce((s, r) => s + Number(r.fair) + Number(r.too_high) + Number(r.too_low), 0);

  return (
    <>
      <PageHeader
        title="quality"
        description="check that scores are fair, and see which topics people struggle with."
        actions={<RangeTabs path="/admin/quality" params={{}} days={days} />}
      />
      <div className="flex flex-col gap-4">
        <Panel
          title="spot-check scores"
          note={
            <Link href={withParams("/admin/quality", { range: String(days) })} className="underline underline-offset-4">
              new sample
            </Link>
          }
        >
          {sample.length ? (
            <ul className="flex flex-col gap-5">
              {sample.map((s) => (
                <li key={`${s.session_id}-${s.question_index}`} className="grid grid-cols-1 gap-4 border-t border-line pt-4 first:border-0 first:pt-0 lg:grid-cols-[1fr_16rem]">
                  <div className="min-w-0 text-[14px]">
                    <div className="text-[12px] text-subtle">
                      {domainShort(s.domain as Domain)} · {s.difficulty} · scored by {s.engine} ·{" "}
                      <TextLink href={`/admin/sessions/${s.session_id}`}>session</TextLink>
                    </div>
                    <p className="mt-1 font-medium">{s.question}</p>
                    <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-foreground/85">{s.answer}</p>
                    <p className="mt-2 text-[13px] text-subtle">
                      <span className="text-foreground tabular-nums">{s.score}/10</span> — {s.feedback}
                    </p>
                  </div>
                  <ScoreReview sessionId={s.session_id} questionIndex={s.question_index} readOnly={access !== "admin"} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>nothing left to review from the last 90 days.</EmptyState>
          )}
        </Panel>

        <Panel title="verdicts" note={`${reviewed} reviewed in range`}>
          {summary.length ? (
            <Table head={["domain", "scored by", "fair", "too high", "too low", "fair rate"]}>
              {summary.map((r) => {
                const n = Number(r.fair) + Number(r.too_high) + Number(r.too_low);
                return (
                  <Tr key={`${r.domain}-${r.engine}`}>
                    <Td>{domainShort(r.domain as Domain)}</Td>
                    <Td>{r.engine}</Td>
                    <Td className="tabular-nums">{r.fair}</Td>
                    <Td className="tabular-nums">{r.too_high}</Td>
                    <Td className="tabular-nums">{r.too_low}</Td>
                    <Td className="tabular-nums">{fmtPct(Number(r.fair), n)}</Td>
                  </Tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState>no reviews yet — mark a few answers above.</EmptyState>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
          <Panel title="weakest topics" note="avg /10 across everyone, 5+ attempts">
            {weakest.length ? (
              <Table head={["topic", "domain", "attempts", "avg", "skipped", "questions", ""]}>
                {weakest.map((t) => (
                  <Tr key={`${t.domain}-${t.topic}`}>
                    <Td>{t.topic}</Td>
                    <Td>{domainShort(t.domain as Domain)}</Td>
                    <Td className="tabular-nums">{fmtNum(t.attempts)}</Td>
                    <Td className="tabular-nums">{fmtNum(t.avg_score, 1)}</Td>
                    <Td className="tabular-nums">{t.skip_rate == null ? "—" : `${Math.round(Number(t.skip_rate) * 100)}%`}</Td>
                    <Td className="tabular-nums">{t.active_questions}</Td>
                    <Td>
                      {access === "admin" && (
                        <TextLink href={withParams("/admin/questions", { newTopic: t.topic, newDomain: t.domain })} className="whitespace-nowrap text-[12px]">
                          add question
                        </TextLink>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Table>
            ) : (
              <EmptyState>not enough answers in this range yet.</EmptyState>
            )}
          </Panel>
          <Panel title="strongest topics">
            {strongest.length ? (
              <Table head={["topic", "domain", "avg"]}>
                {strongest.map((t) => (
                  <Tr key={`${t.domain}-${t.topic}`}>
                    <Td>{t.topic}</Td>
                    <Td>{domainShort(t.domain as Domain)}</Td>
                    <Td className="tabular-nums">{fmtNum(t.avg_score, 1)}</Td>
                  </Tr>
                ))}
              </Table>
            ) : (
              <EmptyState>not enough answers in this range yet.</EmptyState>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
