"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Lightbulb, TrendingUp } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { AppColumn, BackHeader, Card, CardHead, ProfileColumn, SectionLabel } from "@/components/common/Layout";
import { PillButton, PillLink } from "@/components/common/PillButton";
import { SaveButton } from "@/components/common/SaveButton";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { Arc, Bar, Tag } from "@/components/profile/parts";
import { QuestionDetail } from "@/components/report/QuestionDetail";
import { ScoreRing } from "@/components/report/ScoreRing";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ANSWER_WEIGHT, COMMUNICATION_WEIGHT, domainShort } from "@/lib/constants";
import { useStartSession } from "@/hooks/useStartSession";
import { useSessionRow } from "@/lib/data";
import { SOLVED_SCORE } from "@/lib/mastery";
import { cn } from "@/lib/utils";
import type { MetricReading, Report } from "@/types";

export function ReportView() {
  const { id } = useParams<{ id: string }>();
  const { data: row, error, isLoading } = useSessionRow(id);
  // Opened from a profile tab: go back to that tab rather than the dashboard.
  const from = useSearchParams().get("from");
  const backHref = from === "sessions" || from === "saved" ? `/profile?tab=${from}` : "/profile";
  if (isLoading) return null;

  if (error || !row?.report) {
    return (
      <AppColumn className="flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
        <p className="text-[17px]">
          {row?.status === "in_progress" ? "this session isn't finished yet." : "we couldn't find that report."}
        </p>
        {row?.status === "in_progress" ? (
          <PillLink href={`/session/${row.id}`}>continue the session</PillLink>
        ) : (
          <PillLink href="/profile?tab=sessions">see your sessions</PillLink>
        )}
      </AppColumn>
    );
  }
  return <ReportBody report={row.report} sessionId={row.id} backHref={backHref} />;
}

/** A finished report. Friends get a read-only view without save or practice actions. */
export function ReportBody({
  report,
  sessionId,
  friend,
  backHref = "/profile",
}: {
  report: Report;
  sessionId: string;
  friend?: { id: string; name: string };
  backHref?: string;
}) {
  const { config, communication: comm } = report;

  return (
    <ProfileColumn className="pb-12">
      <BackHeader
        title={friend ? `${friend.name}’s report` : "session report"}
        href={friend ? `/friends/${friend.id}` : backHref}
      />

      {/* Two columns on desktop. On phones the cards flow as one list: score, summary, strengths, improvements, communication. */}
      <div className="grid gap-3.5 pt-2 lg:grid-cols-2 lg:items-start">
        <div className="contents lg:grid lg:min-w-0 lg:gap-3.5">
          <Card className="order-1 lg:order-none">
            <div className="flex items-center gap-5 sm:gap-7">
              <ScoreRing score={report.total} />
              <dl className="min-w-0 flex-1 space-y-3.5">
                <ScoreLine label="answers" note={`${ANSWER_WEIGHT * 100}% of the total`} value={report.answersScore} />
                <ScoreLine
                  label="communication"
                  note={`${COMMUNICATION_WEIGHT * 100}% of the total`}
                  value={report.communicationScore}
                />
              </dl>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-4 text-[13px] text-subtle">
              <Tag>{domainShort(config.domain)}</Tag>
              <Tag>{config.difficulty}</Tag>
              <span className="tabular-nums">
                {report.questions.length} question{report.questions.length === 1 ? "" : "s"} · {report.followUps} follow-up
                {report.followUps === 1 ? "" : "s"}
              </span>
            </div>
            {config.topics?.length ? <p className="mt-2 text-[13px] text-subtle">{config.topics.join(" · ")}</p> : null}
            {report.previous && (
              <PreviousTotal previous={report.previous} total={report.total} friend={Boolean(friend)} />
            )}
          </Card>

          <Card className="order-5 lg:order-none">
            <CardHead label="communication">
              <span className="tabular-nums">
                {report.communicationScore === null ? "not rated" : `${report.communicationScore}/100`}
              </span>
            </CardHead>
            <dl className="mt-4 space-y-3.5">
              <MetricRow name="clarity" reading={comm.clarity} />
              <MetricRow name="pace" reading={comm.pace} />
              <MetricRow name="confidence" reading={comm.confidence} />
              <MetricRow name="filler words" reading={comm.fillers} />
            </dl>
            {comm.tip && (
              <p className="mt-4 flex gap-2.5 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[14px] leading-relaxed text-foreground/85">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} />
                {comm.tip}
              </p>
            )}
          </Card>
        </div>

        <div className="contents lg:grid lg:min-w-0 lg:gap-3.5">
          <Card className="order-2 lg:order-none">
            <CardHead label="summary" />
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">{report.summary}</p>
          </Card>

          {report.strengths.length > 0 && (
            <Card className="order-3 lg:order-none">
              <CardHead label="strengths" />
              <ul className="mt-3 space-y-3">
                {report.strengths.map((s) => (
                  <li key={s} className="flex gap-3 text-[15px] leading-snug">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {report.improvements.length > 0 && (
            <Card className="order-4 lg:order-none">
              <CardHead label="areas to improve" />
              <ul className="mt-3 space-y-3">
                {report.improvements.map((s) => (
                  <li key={s} className="flex gap-3 text-[15px] leading-snug">
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-subtle" strokeWidth={1.75} />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-8 mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <SectionLabel>question by question</SectionLabel>
        <p className="text-[13px] text-subtle">scores out of 10</p>
      </div>
      <Accordion defaultValue={[0]} className="gap-3">
        {report.questions.map((q, i) => (
          <AccordionItem key={i} value={i} className="rounded-[18px] border-0 bg-surface not-last:border-b-0">
            <AccordionTrigger className="items-center gap-3.5 rounded-[18px] px-4 py-4 hover:no-underline sm:px-5 [&_[data-slot=accordion-trigger-icon]]:ml-0 [&_[data-slot=accordion-trigger-icon]]:size-4">
              <Arc
                size={46}
                stroke={3.5}
                fraction={(q.score ?? 0) / 10}
                color={q.score !== null && q.score >= SOLVED_SCORE ? "var(--brand)" : "var(--brand-deep)"}
              >
                <span className="text-[14px] font-medium tabular-nums">{q.score === null ? "–" : q.score.toFixed(1)}</span>
              </Arc>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug font-normal text-pretty">{q.text}</span>
                <span className="mt-1 block text-[12px] font-normal text-subtle tabular-nums">
                  question {i + 1} · {q.score === null ? (q.mode ? "not scored" : "skipped") : (q.mode ?? "voice")}
                  <ScoreDelta now={q.score} before={q.previousScore} />
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-5 sm:px-5">
              {friend ? (
                <p className="border-t border-line pt-4 text-[14px] text-subtle">answers and feedback stay private.</p>
              ) : (
                <QuestionDetail
                  q={q}
                  save={<SaveButton sessionId={sessionId} index={i} text={q.text} config={config} label className="-mr-2" />}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {!friend && (
        <div className="mx-auto mt-8 max-w-[520px]">
          <NextSteps sessionId={sessionId} />
          <Link
            href="/profile"
            className="group mt-3 flex items-center gap-3 rounded-[18px] bg-surface px-5 py-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
              <TrendingUp className="size-[18px]" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">view your progress</span>
              <span className="block text-[13px] text-subtle">your scores across sessions</span>
            </span>
            <ArrowRight
              className="size-[18px] shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              strokeWidth={1.8}
              aria-hidden
            />
          </Link>
          <FeedbackForm sessionId={sessionId} reportContext collapsible className="mt-3" />
        </div>
      )}
    </ProfileColumn>
  );
}

/** One of the two scores behind the total, as a labelled bar out of 100. */
function ScoreLine({ label, note, value }: { label: string; note: string; value: number | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5">
      <dt className="min-w-0 text-[14px]">
        {label}
        <span className="block text-[12px] text-subtle sm:ml-1.5 sm:inline">{value === null ? "not rated" : note}</span>
      </dt>
      <dd className="text-[17px] font-medium tabular-nums">{value ?? "–"}</dd>
      <dd className="col-span-2" aria-hidden>
        <Bar fraction={(value ?? 0) / 100} className="h-1.5" />
      </dd>
    </div>
  );
}

/** "52 → 68 · +16 vs your last try", linking to the earlier report. */
function PreviousTotal({
  previous,
  total,
  friend,
}: {
  previous: NonNullable<Report["previous"]>;
  total: number;
  friend: boolean;
}) {
  const delta = total - previous.total;
  const body = (
    <>
      <span className="tabular-nums text-foreground/70">{previous.total}</span>
      <span className="text-subtle"> → </span>
      <span className="tabular-nums">{total}</span>
      <span className={cn("ml-2 tabular-nums", delta > 0 ? "text-brand" : "text-subtle")}>
        {delta > 0 ? `+${delta}` : delta === 0 ? "same" : delta}
      </span>
      <span className="text-subtle"> vs the last try</span>
    </>
  );
  return friend ? (
    <p className="mt-3 text-[14px]">{body}</p>
  ) : (
    <Link href={`/report/${previous.sessionId}`} className="mt-3 block text-[14px] hover:brightness-125">
      {body}
    </Link>
  );
}

/** " · +1.2 vs last time", after a question's meta line. */
function ScoreDelta({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (before === undefined || now === null) return null;
  const delta = Math.round((now - (before ?? 0)) * 10) / 10;
  return (
    <>
      {" · "}
      <span className={cn(delta > 0 && "text-brand")}>
        {delta === 0 ? "same as" : delta > 0 ? `+${delta.toFixed(1)} vs` : `${delta.toFixed(1)} vs`} last time
      </span>
    </>
  );
}

function MetricRow({ name, reading }: { name: string; reading: MetricReading }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
      <dt className="text-[14px]">{name}</dt>
      <dd className="text-[13px] text-foreground/70">{reading.label}</dd>
      <dd className="col-span-2 grid grid-cols-5 gap-1" aria-label={`${reading.level} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn("h-1.5 rounded-full", i < reading.level ? "bg-brand" : "bg-track")} />
        ))}
      </dd>
    </div>
  );
}

/** Retry the same questions, or pick new settings on the setup page. */
function NextSteps({ sessionId }: { sessionId: string }) {
  const { retry, pending, error } = useStartSession();

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <PillButton size="lg" arrow={!pending} disabled={pending} onClick={() => retry(sessionId)} className="sm:flex-1">
          {pending ? "loading your questions…" : "try again"}
        </PillButton>
        <PillLink
          href="/setup"
          size="lg"
          className="border border-foreground/15 bg-transparent text-foreground hover:bg-foreground/5 hover:brightness-100 sm:flex-1"
        >
          new session
        </PillLink>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] text-brand">
          {error}
        </p>
      )}
    </>
  );
}
