"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, Check, ListChecks } from "lucide-react";
import { useState } from "react";
import { PillButton } from "@/components/common/PillButton";
import { SaveButton } from "@/components/common/SaveButton";
import { Arc, Tag } from "@/components/profile/parts";
import { QuestionDetail } from "@/components/report/QuestionDetail";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { useStartSession } from "@/hooks/useStartSession";
import { domainShort, MAX_SAVED_TEST } from "@/lib/constants";
import { type CompletedSession, useProfile, useSavedQuestions } from "@/lib/data";
import { relativeDay } from "@/lib/dates";
import { SOLVED_SCORE } from "@/lib/mastery";
import { cn } from "@/lib/utils";
import type { SavedQuestion } from "@/types";

const levelOf = (q: Pick<SavedQuestion, "domain" | "difficulty">) => `${q.domain}/${q.difficulty}`;

/**
 * Bookmarked questions, newest first. Each opens in place to show just that
 * question: your answer, its feedback and the suggested answer. "take a test"
 * lets you pick up to 10 at one level and answer them again as a new session.
 */
export function SavedTab({ sessions }: { sessions: CompletedSession[] }) {
  const { data: saved } = useSavedQuestions();
  const { data: profile } = useProfile();
  const speechSupported = useSpeechSupported();
  const { fromSaved, pending, error } = useStartSession();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  if (!saved) return null;

  if (saved.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[18px] bg-surface px-5 py-10 text-center">
        <Bookmark className="size-5 text-subtle" strokeWidth={1.75} />
        <p className="text-[15px] text-foreground/85">tap the bookmark on any question to save it here.</p>
      </div>
    );
  }

  const completed = new Map(sessions.map((s) => [s.id, s]));
  // Saves still being written have no real id yet, so they can't join a test.
  const selectable = (q: SavedQuestion) => !q.id.startsWith("pending:");
  const pickedRows = picked.map((id) => saved.find((q) => q.id === id)).filter((q) => q !== undefined);
  const level = pickedRows[0];
  const full = pickedRows.length >= MAX_SAVED_TEST;
  const mode = speechSupported ? (profile?.preferences.mode ?? "voice") : "text";

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
  };

  return (
    <div className="pb-2">
      <div className="mb-3 flex min-h-9 items-center justify-between gap-3 px-1">
        <p className="text-[13px] text-subtle">
          {selecting
            ? level
              ? `only ${domainShort(level.domain)} · ${level.difficulty} questions can join this test`
              : `pick up to ${MAX_SAVED_TEST} questions from the same level`
            : "tap a question to see your answer and feedback"}
        </p>
        <button
          type="button"
          onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-brand",
            selecting ? "text-subtle hover:text-foreground" : "bg-brand/15 font-medium text-brand hover:bg-brand/20",
          )}
        >
          {!selecting && <ListChecks className="size-4" strokeWidth={1.9} aria-hidden />}
          {selecting ? "cancel" : "take a test"}
        </button>
      </div>

      <Accordion className="gap-3">
        {saved.map((q) => {
          const session = completed.get(q.session_id);
          const detail = session?.report.questions[q.question_index];
          const score = detail?.score ?? null;
          const checked = picked.includes(q.id);
          const blocked = !checked && (!selectable(q) || full || (level != null && levelOf(level) !== levelOf(q)));

          return (
            <AccordionItem
              key={q.id}
              value={q.id}
              className={cn(
                "rounded-[18px] border-0 bg-surface transition-opacity not-last:border-b-0",
                selecting && blocked && "opacity-45",
              )}
            >
              {/* The trigger's header has to stretch for the chevron to sit at the far right. */}
              <div className="flex items-center [&>h3]:min-w-0 [&>h3]:flex-1">
                {selecting && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`${checked ? "remove from" : "add to"} test: ${q.text}`}
                    disabled={blocked}
                    onClick={() => toggle(q.id)}
                    className="ml-2 grid size-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed sm:ml-3"
                  >
                    <span
                      className={cn(
                        "grid size-[22px] place-items-center rounded-md border-[1.5px] transition-colors",
                        checked ? "border-brand bg-brand text-primary-foreground" : "border-foreground/30",
                      )}
                    >
                      {checked && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                )}
                <AccordionTrigger
                  className={cn(
                    "min-w-0 items-center gap-3.5 rounded-[18px] px-4 py-4 hover:no-underline sm:px-5 [&_[data-slot=accordion-trigger-icon]]:ml-0 [&_[data-slot=accordion-trigger-icon]]:size-4",
                    selecting && "pl-1 sm:pl-1",
                  )}
                >
                  {detail && (
                    <Arc
                      size={46}
                      stroke={3.5}
                      fraction={(score ?? 0) / 10}
                      color={score !== null && score >= SOLVED_SCORE ? "var(--brand)" : "var(--brand-deep)"}
                    >
                      <span className="text-[14px] font-medium tabular-nums">{score === null ? "–" : score.toFixed(1)}</span>
                    </Arc>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-normal text-pretty">{q.text}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] font-normal text-subtle">
                      <Tag>{domainShort(q.domain)}</Tag>
                      <Tag>{q.difficulty}</Tag>
                      <span>saved {relativeDay(q.created_at)}</span>
                    </span>
                  </span>
                </AccordionTrigger>
              </div>
              <AccordionContent className="px-4 pb-5 sm:px-5">
                {detail ? (
                  <QuestionDetail
                    q={detail}
                    save={
                      <SaveButton
                        sessionId={q.session_id}
                        index={q.question_index}
                        text={q.text}
                        config={q}
                        label
                        className="-mr-2"
                      />
                    }
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                    <p className="text-[14px] text-subtle">the feedback for this question isn&rsquo;t available.</p>
                    <SaveButton
                      sessionId={q.session_id}
                      index={q.question_index}
                      text={q.text}
                      config={q}
                      label
                      className="-mr-2"
                    />
                  </div>
                )}
                {session && (
                  <Link
                    href={`/report/${q.session_id}?from=saved`}
                    className="group mt-4 inline-flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    from your session {relativeDay(session.completed_at)} · full report
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.9} />
                  </Link>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {selecting && (
        <div className="sticky bottom-4 z-10 mt-4 rounded-[18px] border border-line bg-surface-2 p-3 shadow-lg sm:p-3.5">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 pl-1 text-[14px]">
              <span className="font-medium tabular-nums">
                {pickedRows.length} of {MAX_SAVED_TEST}
              </span>
              <span className="text-subtle"> selected</span>
              {level && (
                <span className="block truncate text-[12px] text-subtle sm:ml-1.5 sm:inline">
                  {domainShort(level.domain)} · {level.difficulty} · {mode}
                </span>
              )}
            </p>
            <PillButton
              size="sm"
              arrow={!pending}
              disabled={pending || pickedRows.length === 0}
              onClick={() => fromSaved(pickedRows.map((q) => q.id), mode)}
            >
              {pending ? "loading…" : "start test"}
            </PillButton>
          </div>
          {error && (
            <p role="alert" className="mt-2 px-1 text-[13px] text-brand">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
