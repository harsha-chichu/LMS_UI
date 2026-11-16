"use client";

import { ArrowUpRight, Check, Lightbulb } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toParagraphs } from "@/lib/text";
import type { Report } from "@/types";
import { cn } from "@/lib/utils";

type ReportQuestion = Report["questions"][number];

/**
 * One question's feedback, skimmable first: the next-time tip, then what
 * worked and what to improve side by side, then the user's answer and the
 * suggested answer (tabs on smaller screens, two columns on desktop). Long
 * answers are broken into short paragraphs. Reports from before the bullets
 * were stored fall back to the feedback paragraph.
 */
export function QuestionDetail({ q, save }: { q: ReportQuestion; save?: ReactNode }) {
  const strengths = q.strengths ?? [];
  const weaknesses = q.weaknesses ?? [];
  const hasBullets = strengths.length + weaknesses.length > 0;

  return (
    <div className="space-y-5 border-t border-line pt-5 text-[15px]">
      {q.nextTime && (
        <div className="flex gap-3 rounded-[14px] bg-brand/15 px-4 py-3.5">
          <Lightbulb className="mt-0.5 size-[18px] shrink-0 text-brand" strokeWidth={1.75} />
          <div>
            <p className="text-[12px] font-medium text-brand">next time</p>
            <p className="mt-0.5 leading-relaxed text-foreground/95">{q.nextTime}</p>
          </div>
        </div>
      )}

      {hasBullets ? (
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {strengths.length > 0 && (
            <Bullets
              label="what worked"
              items={strengths}
              icon={<Check className="mt-[3px] size-4 shrink-0 text-brand" strokeWidth={2} />}
            />
          )}
          {weaknesses.length > 0 && (
            <Bullets
              label="to improve"
              items={weaknesses}
              icon={<ArrowUpRight className="mt-[3px] size-4 shrink-0 text-subtle" strokeWidth={1.75} />}
            />
          )}
        </div>
      ) : (
        q.feedback && <Prose text={q.feedback} className="text-foreground/90" />
      )}

      <Answers q={q} save={save} />
    </div>
  );
}

function Bullets({ label, items, icon }: { label: string; items: string[]; icon: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-subtle">{label}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 leading-snug text-foreground/90">
            {icon}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Side = "yours" | "suggested";

/** Your answer (with follow-ups) and the suggested answer: tabs below desktop width, two columns on it. */
function Answers({ q, save }: { q: ReportQuestion; save?: ReactNode }) {
  const [side, setSide] = useState<Side>("yours");
  const followUps = q.followUps ?? [];
  const hasYours = Boolean(q.answer) || followUps.length > 0;
  const points = q.suggestedPoints ?? [];
  const hasSuggested = Boolean(q.suggestedAnswer) || points.length > 0;
  if (!hasYours && !hasSuggested) return save ? <div className="flex justify-end">{save}</div> : null;

  const yours = hasYours && (
    <div className="space-y-3">
      {q.answer && <Prose text={q.answer} clamp className="text-foreground/80" />}
      {followUps.map((f, j) => (
        <div key={j} className="rounded-[14px] bg-surface-2 px-4 py-3.5">
          <p className="text-[12px] text-subtle">follow-up</p>
          <p className="mt-1 leading-relaxed text-foreground/95">{f.question}</p>
          {f.answer ? (
            <Prose text={f.answer} clamp className="mt-2 text-foreground/80" />
          ) : (
            <p className="mt-2 text-subtle">skipped</p>
          )}
        </div>
      ))}
    </div>
  );
  const suggested = hasSuggested && <Suggested points={points} full={q.suggestedAnswer ?? null} />;
  const both = hasYours && hasSuggested;

  return (
    <div className="border-t border-line pt-4">
      <div className="flex min-h-9 items-center justify-between gap-3">
        {both ? (
          <>
            <div role="tablist" aria-label="answers" className="inline-flex rounded-full bg-surface-2 p-0.5 lg:hidden">
              {(["yours", "suggested"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={side === s}
                  onClick={() => setSide(s)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                    side === s ? "bg-foreground/10 font-medium text-foreground" : "text-subtle hover:text-foreground/80",
                  )}
                >
                  {s === "yours" ? "your answer" : "suggested answer"}
                </button>
              ))}
            </div>
            <p className="hidden text-[12px] text-subtle lg:block">your answer, next to a suggested one</p>
          </>
        ) : (
          <p className="text-[12px] text-subtle">{hasYours ? "your answer" : "suggested answer"}</p>
        )}
        {save}
      </div>

      {both ? (
        <div className="mt-3.5 grid gap-x-8 lg:grid-cols-2">
          <div className={cn(side !== "yours" && "hidden lg:block")}>
            <p className="mb-2 hidden text-[12px] text-subtle lg:block">your answer</p>
            {yours}
          </div>
          <div className={cn(side !== "suggested" && "hidden lg:block")}>
            <p className="mb-2 hidden text-[12px] text-subtle lg:block">suggested answer</p>
            {suggested}
          </div>
        </div>
      ) : (
        <div className="mt-2.5">{yours || suggested}</div>
      )}
    </div>
  );
}

/** Key points first (quick to remember), then the full model answer in short paragraphs. */
function Suggested({ points, full }: { points: string[]; full: string | null }) {
  return (
    <div className="space-y-4">
      {points.length > 0 && (
        <div className="rounded-[14px] bg-surface-2 px-4 py-3.5">
          <p className="text-[12px] text-subtle">key points</p>
          <ol className="mt-2 space-y-2">
            {points.map((p, i) => (
              <li key={i} className="flex gap-3 leading-snug text-foreground/95">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-medium text-brand tabular-nums">
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </div>
      )}
      {full && (
        <div>
          {points.length > 0 && <p className="mb-2 text-[12px] text-subtle">said out loud</p>}
          <Prose text={full} clamp={points.length > 0} className="text-foreground/90" />
        </div>
      )}
    </div>
  );
}

/** Paragraphs shown before "show more" when a long text is clamped. */
const CLAMP_PARAGRAPHS = 1;

/** Running text as short paragraphs at a readable width; optionally only the first until expanded. */
function Prose({ text, clamp = false, className }: { text: string; clamp?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = toParagraphs(text);
  const long = clamp && paragraphs.length > CLAMP_PARAGRAPHS;
  const shown = long && !open ? paragraphs.slice(0, CLAMP_PARAGRAPHS) : paragraphs;
  return (
    <div className={cn("max-w-[62ch]", className)}>
      <div className="space-y-3">
        {shown.map((p, i) => (
          <p key={i} className="leading-[1.65]">
            {p}
          </p>
        ))}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-2 text-[13px] text-brand hover:brightness-110 focus-visible:outline-2 focus-visible:outline-brand"
        >
          {open ? "show less" : "read the rest"}
        </button>
      )}
    </div>
  );
}
