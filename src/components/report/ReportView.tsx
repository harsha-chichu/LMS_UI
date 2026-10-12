"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Lightbulb } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppColumn, BackHeader, Section, SectionLabel, StatRow } from "@/components/common/Layout";
import { PillButton, PillLink } from "@/components/common/PillButton";
import { SaveButton } from "@/components/common/SaveButton";
import { ScoreRing } from "@/components/report/ScoreRing";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ANSWER_WEIGHT, COMMUNICATION_WEIGHT, domainShort } from "@/lib/constants";
import { createSession, useSessionRow } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { MetricReading, Report } from "@/types";

export function ReportView() {
  const { id } = useParams<{ id: string }>();
  const { data: row, error, isLoading } = useSessionRow(id);
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
          <PillLink href="/profile">see your sessions</PillLink>
        )}
      </AppColumn>
    );
  }
  return <ReportBody report={row.report} sessionId={row.id} />;
}

/** A finished report. Friends get a read-only view without save or practice actions. */
export function ReportBody({
  report,
  sessionId,
  friend,
}: {
  report: Report;
  sessionId: string;
  friend?: { id: string; name: string };
}) {
  const { config, communication: comm } = report;

  return (
    <AppColumn className="pb-12">
      <BackHeader
        title={friend ? `${friend.name}’s report` : "session report"}
        href={friend ? `/friends/${friend.id}` : "/profile"}
      />

      <div className="flex flex-col items-center pt-4 pb-7">
        <ScoreRing score={report.total} />
        <p className="mt-5 text-[13px] text-white/70">
          {domainShort(config.domain)} · {config.difficulty} · {report.questions.length} questions
        </p>
        {config.topics?.length ? (
          <p className="mt-1 text-center text-[13px] text-subtle">{config.topics.join(" · ")}</p>
        ) : null}
      </div>

      <StatRow
        items={[
          { value: report.answersScore, label: `answers · ${ANSWER_WEIGHT * 100}%` },
          { value: report.communicationScore, label: `communication · ${COMMUNICATION_WEIGHT * 100}%` },
          { value: report.followUps, label: "follow-ups" },
        ]}
      />

      <Section className="border-t-0">
        <SectionLabel>summary</SectionLabel>
        <p className="mt-3 text-[15px] leading-relaxed text-white/90">{report.summary}</p>
      </Section>

      <Section>
        <SectionLabel>strengths</SectionLabel>
        <ul className="mt-3 space-y-2.5">
          {report.strengths.map((s) => (
            <li key={s} className="flex gap-3 text-[15px]">
              <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2} />
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionLabel>areas to improve</SectionLabel>
        <ul className="mt-3 space-y-2.5">
          {report.improvements.map((s) => (
            <li key={s} className="flex gap-3 text-[15px]">
              <ArrowUpRight className="mt-1 size-4 shrink-0 text-subtle" strokeWidth={1.75} />
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="flex items-center justify-between">
          <SectionLabel>communication</SectionLabel>
          <span className="text-[14px] tabular-nums">{report.communicationScore}/100</span>
        </div>
        <dl className="mt-3 space-y-3">
          <MetricRow name="clarity" reading={comm.clarity} />
          <MetricRow name="pace" reading={comm.pace} />
          <MetricRow name="confidence" reading={comm.confidence} />
          <MetricRow name="filler words" reading={comm.fillers} />
        </dl>
        {comm.tip && (
          <p className="mt-4 flex gap-2 text-[13px] text-white/70">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
            {comm.tip}
          </p>
        )}
      </Section>

      <Section>
        <SectionLabel>per question</SectionLabel>
        <Accordion defaultValue={[0]} className="mt-2">
          {report.questions.map((q, i) => (
            <AccordionItem key={i} value={i} className="border-line">
              <AccordionTrigger className="gap-3 rounded-none py-4 hover:no-underline [&_[data-slot=accordion-trigger-icon]]:mt-1 [&_[data-slot=accordion-trigger-icon]]:size-4">
                <span className="w-6 shrink-0 pt-px text-[13px] text-subtle tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-[15px] leading-snug font-normal">{q.text}</span>
                <span
                  className={cn(
                    "shrink-0 pl-2 text-[15px] font-medium tabular-nums",
                    q.score !== null && q.score >= 8 ? "text-brand" : "text-white",
                  )}
                >
                  {q.score === null ? "–" : q.score.toFixed(1)}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-5 pl-9 text-[14px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-subtle">
                      {q.score === null ? "skipped" : `${q.mode ?? "voice"} · ${q.score.toFixed(1)}/10`}
                    </span>
                    {!friend && (
                      <SaveButton sessionId={sessionId} index={i} text={q.text} config={config} label className="-my-2 -mr-3" />
                    )}
                  </div>
                  {q.feedback && (
                    <div>
                      <p className="text-[12px] text-subtle">feedback</p>
                      <p className="mt-1 leading-relaxed text-white/90">{q.feedback}</p>
                    </div>
                  )}
                  {q.nextTime && (
                    <div>
                      <p className="text-[12px] text-subtle">next time</p>
                      <p className="mt-1 leading-relaxed text-white/90">{q.nextTime}</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      {!friend && (
        <div className="border-t border-line pt-7">
          <PracticeAgain report={report} />
          <nav className="mt-5 flex justify-center gap-6 text-[13px] text-white/70">
            <Link href="/setup" className="hover:text-white">
              new session
            </Link>
            <Link href="/profile" className="hover:text-white">
              view progress
            </Link>
          </nav>
        </div>
      )}
    </AppColumn>
  );
}

function MetricRow({ name, reading }: { name: string; reading: MetricReading }) {
  return (
    <div className="grid grid-cols-[1fr_auto_96px] items-center gap-3">
      <dt className="text-[15px]">{name}</dt>
      <dd className="flex gap-1" aria-label={`${reading.level} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn("h-[3px] w-3.5 rounded-full", i < reading.level ? "bg-brand" : "bg-white/15")} />
        ))}
      </dd>
      <dd className="text-[13px] text-white/70">{reading.label}</dd>
    </div>
  );
}

/** Same settings, fresh questions, straight into the session. */
function PracticeAgain({ report }: { report: Report }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <PillButton
        size="lg"
        arrow={!pending}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setFailed(false);
          try {
            const id = await createSession(report.config);
            router.push(`/session/${id}`);
          } catch {
            setFailed(true);
            setPending(false);
          }
        }}
      >
        {pending ? "preparing your questions…" : "practice again"}
      </PillButton>
      {failed && (
        <p role="alert" className="mt-3 text-center text-[13px] text-brand">
          couldn&apos;t start a session. try again in a moment.
        </p>
      )}
    </>
  );
}
