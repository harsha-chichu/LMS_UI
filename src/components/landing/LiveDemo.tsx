"use client";

import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { AnswerBubble, FollowUpBlock, ProgressBars, QuestionMeta } from "@/components/session/parts";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const ANSWER = "i'd check whether the right passage is even in the top-k, then look at chunking and the embedding model.".split(" ");
const FOLLOW_UP = "using only logs, how would you tell a retrieval failure from a generation failure?";
const REPLY = "log the retrieved ids with every response. if the right one is there, it's generation.".split(" ");

const SCORE = 68;

/** The loop's timeline, in ticks. */
const TICK_MS = 100;
const TICKS_PER_WORD = 2;
const ANSWER_AT = 12;
const ANSWER_END = ANSWER_AT + ANSWER.length * TICKS_PER_WORD;
const FOLLOW_UP_AT = ANSWER_END + 8;
const REPLY_AT = FOLLOW_UP_AT + 20;
const REPLY_END = REPLY_AT + REPLY.length * TICKS_PER_WORD;
const REPORT_AT = REPLY_END + 12;
const LOOP_END = REPORT_AT + 62;

const wordsAt = (tick: number, start: number, words: string[]) =>
  Math.max(0, Math.min(words.length, Math.floor((tick - start) / TICKS_PER_WORD)));

/**
 * A session playing on a loop in the landing hero: the answer is "spoken",
 * a follow-up arrives, then the report. With reduced motion it holds on the
 * finished session instead.
 */
export function LiveDemo() {
  const still = useReducedMotion();
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setTicks((t) => (t + 1) % LOOP_END), TICK_MS);
    return () => clearInterval(timer);
  }, [still]);

  // Reduced motion: everything said, no report takeover.
  const tick = still ? REPORT_AT - 1 : ticks;
  const answered = wordsAt(tick, ANSWER_AT, ANSWER);
  const replied = wordsAt(tick, REPLY_AT, REPLY);
  const followUp = tick >= FOLLOW_UP_AT;
  const report = tick >= REPORT_AT;
  const listening = !still && ((tick >= ANSWER_AT && tick < ANSWER_END) || (tick >= REPLY_AT && tick < REPLY_END));
  const status = listening ? "listening…" : tick < ANSWER_AT ? "your turn" : tick < REPLY_END ? "follow-up" : "scoring…";
  const score = still ? SCORE : Math.max(0, Math.min(SCORE, (tick - REPORT_AT - 3) * 4));

  return (
    <figure
      aria-label="Example of a practice session: a question, a spoken answer, a follow-up, then a score of 68 out of 100"
      className="relative w-full rounded-[28px] border border-foreground/10 bg-surface p-5 shadow-[0_30px_80px_-30px_color-mix(in_srgb,var(--brand)_45%,transparent)]"
    >
      {/* Both screens share one grid cell, so the card keeps the taller one's height. */}
      <div className="grid [&>*]:col-start-1 [&>*]:row-start-1" aria-hidden>
        <div className={cn("transition-opacity duration-500", report && "opacity-0")}>
          <div className="flex items-center justify-between gap-4">
            <QuestionMeta>question 3 · ai/ml · medium</QuestionMeta>
            <ProgressBars total={5} current={2} className="[&>span]:w-5" />
          </div>
          <p className="mt-3 text-[15px] leading-snug font-medium md:text-[16px]">
            a retrieval-augmented chatbot keeps citing the wrong document. how do you debug it?
          </p>

          <Typed words={ANSWER} shown={answered} typing={listening && answered < ANSWER.length} className="mt-4" />

          <FollowUpBlock
            className={cn(
              "mt-4 transition-[opacity,transform] duration-500 [&>p:last-child]:text-[14px] md:[&>p:last-child]:text-[15px]",
              !followUp && "translate-y-2 opacity-0",
            )}
          >
            {FOLLOW_UP}
          </FollowUpBlock>

          <Typed words={REPLY} shown={replied} typing={listening && replied < REPLY.length} className="mt-4" />

          <div className="mt-5 flex flex-col items-center gap-2">
            <span className="relative inline-flex size-12 items-center justify-center">
              {listening && <span className="absolute inset-0 animate-ring-pulse rounded-full border border-brand" />}
              <span className="relative inline-flex size-full items-center justify-center rounded-full bg-brand text-primary-foreground">
                <Mic className="size-5" strokeWidth={1.75} />
              </span>
            </span>
            <span className="text-[13px] text-subtle">{status}</span>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col items-center justify-center text-center transition-[opacity,transform] duration-500",
            !report && "pointer-events-none translate-y-3 opacity-0",
          )}
        >
          <p className="text-[13px] text-subtle">your report</p>
          <Ring score={score} />
          <p className="mt-5 text-[15px]">
            <span className="text-subtle">52 → </span>
            <span className="font-medium">68</span>
            <span className="text-brand"> · +16 vs the last try</span>
          </p>
          <dl className="mt-6 grid w-full max-w-[300px] grid-cols-3 gap-2 border-t border-line pt-5 text-[12px]">
            {[
              ["answers", "70"],
              ["communication", "64"],
              ["follow-ups", "3"],
            ].map(([label, value]) => (
              <div key={label}>
                <dd className="text-[20px] font-medium tabular-nums">{value}</dd>
                <dt className="mt-1 text-subtle">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-[300px] text-[13px] leading-relaxed text-foreground/70">
            <span className="text-brand">next time · </span>
            name the metric you&apos;d watch before you change anything.
          </p>
        </div>
      </div>
    </figure>
  );
}

/** An answer bubble that fills in word by word. The unsaid words still take up space, so nothing shifts. */
function Typed({ words, shown, typing, className }: { words: string[]; shown: number; typing: boolean; className?: string }) {
  return (
    <AnswerBubble className={cn("max-w-[85%] px-4 py-3 text-[13px] transition-opacity md:text-[14px] duration-300", shown === 0 && "opacity-0", className)}>
      {words.slice(0, shown).join(" ")}
      {typing && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret bg-brand" />}
      <span className="invisible"> {words.slice(shown).join(" ")}</span>
    </AnswerBubble>
  );
}

function Ring({ score }: { score: number }) {
  const size = 132;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative mt-5" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] leading-none font-medium tabular-nums">{score}</span>
        <span className="mt-1.5 text-[12px] text-foreground/70">out of 100</span>
      </div>
    </div>
  );
}
