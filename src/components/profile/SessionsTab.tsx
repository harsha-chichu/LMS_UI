import Link from "next/link";
import { Section, SectionLabel } from "@/components/common/Layout";
import { domainShort, topicsShort } from "@/lib/constants";
import type { CompletedSession } from "@/lib/data";
import { relativeDay } from "@/lib/dates";

/** Every finished session, newest first, each linking to its report. */
export function SessionsTab({ sessions }: { sessions: CompletedSession[] }) {
  return (
    <Section className="border-t-0 pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <SectionLabel>all sessions</SectionLabel>
        {sessions.length > 0 && (
          <p className="text-[13px] text-white/85">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      {sessions.length === 0 ? (
        <p className="mt-3 text-[15px] text-white/70">no sessions yet — your reports will show up here.</p>
      ) : (
        <ul className="mt-1">
          {sessions.map((s) => (
            <li key={s.id} className="border-b border-line last:border-b-0">
              <Link href={`/report/${s.id}`} className="flex items-center justify-between gap-4 py-4 hover:text-white/80">
                <span className="text-[15px]">
                  {relativeDay(s.completed_at)} · {domainShort(s.config.domain)} · {s.config.difficulty}
                  {topicsShort(s.config.topics, 1) && (
                    <span className="text-subtle"> · {topicsShort(s.config.topics, 1)}</span>
                  )}
                </span>
                <span className="text-[15px] font-medium tabular-nums">{s.total}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
