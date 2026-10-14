"use client";

import { ArrowUpRight, Check, Lightbulb } from "lucide-react";
import { useState } from "react";
import type { Report } from "@/types";
import { cn } from "@/lib/utils";

type ReportQuestion = Report["questions"][number];

/**
 * One question's feedback, skimmable first: the next-time tip, then short
 * strengths / weaknesses, then the user's answer and the suggested answer
 * behind a toggle (side by side on wide screens), each clamped with "show more".
 * Reports from before the bullets were stored fall back to the feedback paragraph.
 */
export function QuestionDetail({ q }: { q: ReportQuestion }) {
  const strengths = q.strengths ?? [];
  const weaknesses = q.weaknesses ?? [];
  const hasBullets = strengths.length + weaknesses.length > 0;

  return (
    <div className="space-y-4">
      {q.nextTime && (
        <p className="flex gap-2.5 rounded-xl bg-bubble px-3.5 py-3 leading-relaxed text-white/95">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} />
          <span>
            <span className="font-medium text-brand">next time · </span>
            {q.nextTime}
          </span>
        </p>
      )}

      {hasBullets ? (
        <ul className="space-y-1.5">
          {strengths.map((s) => (
            <li key={`s-${s}`} className="flex gap-2.5 leading-snug text-white/90">
              <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
              {s}
            </li>
          ))}
          {weaknesses.map((w) => (
            <li key={`w-${w}`} className="flex gap-2.5 leading-snug text-white/75">
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-subtle" strokeWidth={1.75} />
              {w}
            </li>
          ))}
        </ul>
      ) : (
        q.feedback && <Clamp text={q.feedback} className="text-white/90" />
      )}

      <Answers q={q} />
    </div>
  );
}

type Side = "yours" | "suggested";

/** Your answer (with follow-ups) and the suggested answer: a toggle on phones, two columns on md+. */
function Answers({ q }: { q: ReportQuestion }) {
  const [side, setSide] = useState<Side>("yours");
  const followUps = q.followUps ?? [];
  const hasYours = Boolean(q.answer) || followUps.length > 0;
  const points = q.suggestedPoints ?? [];
  const hasSuggested = Boolean(q.suggestedAnswer) || points.length > 0;
  if (!hasYours && !hasSuggested) return null;

  const yours = hasYours && (
    <div className="space-y-3">
      {q.answer && <Clamp text={q.answer} className="text-white/75" />}
      {followUps.map((f, j) => (
        <div key={j} className="border-l border-line pl-3">
          <p className="text-[12px] text-subtle">follow-up</p>
          <p className="mt-1 leading-relaxed text-white/90">{f.question}</p>
          <Clamp text={f.answer ?? "skipped"} className="mt-1.5 text-white/75" />
        </div>
      ))}
    </div>
  );
  const suggested = hasSuggested && <Suggested points={points} full={q.suggestedAnswer ?? null} />;

  // Only one of the two: no toggle needed.
  if (!hasYours || !hasSuggested) {
    return (
      <div>
        <p className="text-[12px] text-subtle">{hasYours ? "your answer" : "suggested answer"}</p>
        <div className="mt-1.5">{yours || suggested}</div>
      </div>
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="answers" className="inline-flex rounded-full bg-surface-2 p-0.5 md:hidden">
        {(["yours", "suggested"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={side === s}
            onClick={() => setSide(s)}
            className={cn(
              "h-8 rounded-full px-3.5 text-[13px] transition-colors",
              side === s ? "bg-white/10 font-medium text-white" : "text-subtle hover:text-white/80",
            )}
          >
            {s === "yours" ? "your answer" : "suggested answer"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-5 md:mt-0 md:grid-cols-2">
        <div className={cn(side !== "yours" && "hidden md:block")}>
          <p className="mb-1.5 hidden text-[12px] text-subtle md:block">your answer</p>
          {yours}
        </div>
        <div className={cn(side !== "suggested" && "hidden md:block")}>
          <p className="mb-1.5 hidden text-[12px] text-subtle md:block">suggested answer</p>
          {suggested}
        </div>
      </div>
    </div>
  );
}

/** Key points first (quick to remember); the full model answer one tap away. */
function Suggested({ points, full }: { points: string[]; full: string | null }) {
  const [open, setOpen] = useState(false);
  if (!points.length) return full ? <Clamp text={full} className="text-white/90" /> : null;
  return (
    <div>
      <ol className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5 leading-snug text-white/90">
            <span className="w-4 shrink-0 text-right text-[12px] leading-[1.6] text-brand tabular-nums">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
      {full && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-2 text-[13px] text-brand hover:brightness-110"
          >
            {open ? "hide the full answer" : "read it as a full answer"}
          </button>
          {open && <p className="mt-2 leading-relaxed whitespace-pre-line text-white/80">{full}</p>}
        </>
      )}
    </div>
  );
}

/** Long text shows its first few lines with a "show more" toggle. */
const CLAMP_CHARS = 260;

function Clamp({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_CHARS;
  return (
    <div className={className}>
      <p className={cn("leading-relaxed whitespace-pre-line", long && !open && "line-clamp-4")}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[13px] text-brand hover:brightness-110"
        >
          {open ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}
