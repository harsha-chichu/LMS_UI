"use client";

import { useState } from "react";
import { PillLink } from "@/components/common/PillButton";
import { SessionRow } from "@/components/profile/parts";
import { DIFFICULTIES, DOMAINS, domainShort } from "@/lib/constants";
import type { CompletedSession } from "@/lib/data";
import { sessionsByMonth } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/types";

/** Every finished session, newest first and grouped by month, each linking to its report. */
export function SessionsTab({ sessions }: { sessions: CompletedSession[] }) {
  const [domain, setDomain] = useState<Domain | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-[18px] bg-surface px-5 py-10 text-center">
        <p className="text-[15px] text-foreground/85">no sessions yet — your reports will show up here.</p>
        <PillLink href="/setup" size="sm" arrow>
          start a session
        </PillLink>
      </div>
    );
  }

  // Only offer filters that would change the list.
  const domains = DOMAINS.filter((d) => sessions.some((s) => s.config.domain === d.value));
  const difficulties = DIFFICULTIES.filter((d) => sessions.some((s) => s.config.difficulty === d));
  const shown = sessions.filter(
    (s) => (!domain || s.config.domain === domain) && (!difficulty || s.config.difficulty === difficulty),
  );

  return (
    <div>
      {(domains.length > 1 || difficulties.length > 1) && (
        <div className="mb-5 space-y-2">
          {domains.length > 1 && (
            <div role="group" aria-label="filter by domain" className="flex flex-wrap gap-1.5">
              <FilterChip selected={!domain} onClick={() => setDomain(null)}>
                all domains
              </FilterChip>
              {domains.map((d) => (
                <FilterChip key={d.value} selected={domain === d.value} onClick={() => setDomain(d.value)}>
                  {d.short}
                </FilterChip>
              ))}
            </div>
          )}
          {difficulties.length > 1 && (
            <div role="group" aria-label="filter by difficulty" className="flex flex-wrap gap-1.5">
              <FilterChip selected={!difficulty} onClick={() => setDifficulty(null)}>
                any level
              </FilterChip>
              {difficulties.map((d) => (
                <FilterChip key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
                  {d}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[18px] bg-surface px-5 py-9 text-center">
          <p className="text-[15px] text-foreground/85">
            no {difficulty} {domain && domainShort(domain)} sessions yet.
          </p>
          <button
            type="button"
            onClick={() => {
              setDomain(null);
              setDifficulty(null);
            }}
            className="h-8 rounded-full border border-brand/60 px-3.5 text-[13px] transition-colors hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand"
          >
            clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {sessionsByMonth(shown).map((month) => (
            <section key={month.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1 text-[13px] text-subtle">
                <h2>{month.label}</h2>
                <p className="tabular-nums">
                  {month.sessions.length} session{month.sessions.length === 1 ? "" : "s"} · avg {month.average}
                </p>
              </div>
              <ul className="rounded-[18px] bg-surface px-2 py-1">
                {month.sessions.map((s) => (
                  <SessionRow key={s.id} href={`/report/${s.id}?from=sessions`} session={s} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-brand",
        selected ? "border-brand/60 bg-brand/15 text-foreground" : "border-line text-subtle hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
