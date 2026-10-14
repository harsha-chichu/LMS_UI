"use client";

import Link from "next/link";
import { Section, SectionLabel } from "@/components/common/Layout";
import { SaveButton } from "@/components/common/SaveButton";
import { domainShort } from "@/lib/constants";
import { type CompletedSession, useSavedQuestions } from "@/lib/data";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Bookmarked questions, newest first, each linking back to the report it came from. */
export function SavedTab({ sessions }: { sessions: CompletedSession[] }) {
  const { data: saved } = useSavedQuestions();
  if (!saved) return null;

  const completed = new Map(sessions.map((s) => [s.id, s]));

  return (
    <Section className="border-t-0 pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <SectionLabel>saved questions</SectionLabel>
        {saved.length > 0 && (
          <p className="text-[13px] text-white/85">
            {saved.length} saved
          </p>
        )}
      </div>
      {saved.length === 0 ? (
        <p className="mt-3 text-[15px] text-white/70">tap the bookmark on any question to save it here.</p>
      ) : (
        <ul className="mt-1">
          {saved.map((q) => {
            const session = completed.get(q.session_id);
            const score = session?.report.questions[q.question_index]?.score;
            const body = (
              <>
                <span className="block text-[15px] leading-snug">{q.text}</span>
                <span className="mt-1.5 block text-[13px] text-subtle">
                  {relativeDay(q.created_at)} · {domainShort(q.domain)} · {q.difficulty}
                  {score != null && (
                    <>
                      {" · "}
                      <span className={cn("tabular-nums", score >= 8 ? "text-brand" : "text-white/80")}>
                        {score.toFixed(1)}/10
                      </span>
                    </>
                  )}
                </span>
              </>
            );
            return (
              <li key={q.id} className="flex items-start gap-3 border-b border-line py-4 last:border-b-0">
                {session ? (
                  <Link href={`/report/${q.session_id}`} className="min-w-0 flex-1 hover:text-white/80">
                    {body}
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">{body}</div>
                )}
                <SaveButton
                  sessionId={q.session_id}
                  index={q.question_index}
                  text={q.text}
                  config={q}
                  className="-mt-1.5 -mr-2"
                />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
