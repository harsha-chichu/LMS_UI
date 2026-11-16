"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { SaveButton } from "@/components/common/SaveButton";
import { Tag } from "@/components/profile/parts";
import { domainShort } from "@/lib/constants";
import { type CompletedSession, useSavedQuestions } from "@/lib/data";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Bookmarked questions, newest first, each linking back to the report it came from. */
export function SavedTab({ sessions }: { sessions: CompletedSession[] }) {
  const { data: saved } = useSavedQuestions();
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

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {saved.map((q) => {
        const session = completed.get(q.session_id);
        const score = session?.report.questions[q.question_index]?.score;
        const body = (
          <>
            <span className="block text-[15px] leading-snug text-pretty">{q.text}</span>
            <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-subtle">
              <Tag>{domainShort(q.domain)}</Tag>
              <Tag>{q.difficulty}</Tag>
              <span>{relativeDay(q.created_at)}</span>
              {score != null && (
                <span className={cn("tabular-nums", score >= 8 ? "text-brand" : "text-foreground/85")}>
                  {score.toFixed(1)}/10
                </span>
              )}
            </span>
          </>
        );
        return (
          <li key={q.id} className="flex items-start gap-3 rounded-[18px] bg-surface p-[18px] pb-4">
            {session ? (
              <Link
                href={`/report/${q.session_id}?from=saved`}
                className="min-w-0 flex-1 rounded-md hover:text-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
              >
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
              className="-mt-2 -mr-2"
            />
          </li>
        );
      })}
    </ul>
  );
}
