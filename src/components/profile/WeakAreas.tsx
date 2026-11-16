"use client";

import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card, CardHead } from "@/components/common/Layout";
import { Bar } from "@/components/profile/parts";
import { ADAPTIVE, DIFFICULTIES, DOMAINS, domainShort } from "@/lib/constants";
import { useStartSession } from "@/hooks/useStartSession";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { useAttempts, useProfile, useTopicMastery } from "@/lib/data";
import { PRACTICE_COUNT, type TopicMastery, unsolvedQuestionIds } from "@/lib/mastery";
import type { Difficulty, Domain } from "@/types";
import { cn } from "@/lib/utils";

const MAX_WEAK = 4;

const topicKey = (t: TopicMastery) => `${t.domain}|${t.difficulty}|${t.topic}`;
const scoreText = (t: TopicMastery) => (t.answered === 0 ? "skipped" : `${t.recentAverage.toFixed(1)}/10`);

/**
 * What to practise next: the weakest topic up top, then one block per domain
 * with a switch for its levels. Tapping a topic starts a session on it.
 */
export function WeakAreas() {
  const { data: topics } = useTopicMastery();
  const { data: attempts } = useAttempts();
  const { data: profile } = useProfile();
  const speechSupported = useSpeechSupported();
  const { practise, start, pending, error } = useStartSession();
  const [starting, setStarting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showMastered, setShowMastered] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<Partial<Record<Domain, Difficulty>>>({});
  if (!topics?.length) return null;

  const mode = speechSupported ? (profile?.preferences.mode ?? "voice") : "text";
  const count = profile?.preferences.count ?? 5;

  /** A normal session on just this topic, at this level. `from` says which button was pressed. */
  const practiseTopic = (t: TopicMastery, from: string) => {
    setStarting(from);
    start({ domain: t.domain, difficulty: t.difficulty, count, mode, topics: [t.topic] });
  };
  const toggleIn = (set: (update: (prev: Set<string>) => Set<string>) => void, key: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // One block per domain; its levels sit behind a small switch instead of each
  // level repeating the same block.
  const byDomain = new Map<Domain, Map<Difficulty, TopicMastery[]>>();
  for (const t of topics) {
    const levels = byDomain.get(t.domain) ?? new Map<Difficulty, TopicMastery[]>();
    levels.set(t.difficulty, [...(levels.get(t.difficulty) ?? []), t]);
    byDomain.set(t.domain, levels);
  }
  const domains = [...byDomain.keys()].sort(
    (a, b) => DOMAINS.findIndex((d) => d.value === a) - DOMAINS.findIndex((d) => d.value === b),
  );

  /** The level shown for a domain: the one picked, else the one practised most recently. */
  const levelFor = (domain: Domain, levels: Map<Difficulty, TopicMastery[]>): Difficulty => {
    const picked = level[domain];
    if (picked && levels.has(picked)) return picked;
    let latest: TopicMastery | undefined;
    for (const list of levels.values())
      for (const t of list) if (!latest || t.lastPracticed > latest.lastPracticed) latest = t;
    return latest!.difficulty;
  };

  // The headline pick: the lowest recent average of all, most recently practised on a tie.
  const weakest = topics
    .filter((t) => !t.mastered)
    .sort((a, b) => a.recentAverage - b.recentAverage || b.lastPracticed.localeCompare(a.lastPracticed))[0];

  return (
    <Card>
      <CardHead label="practise next">your weak areas</CardHead>

      {weakest && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-brand/15 px-4 py-3.5">
          <div className="min-w-0 flex-[1_1_180px]">
            <p className="text-[12px] text-foreground/85">weakest right now</p>
            <p className="mt-0.5 truncate text-[17px] font-medium">{weakest.topic}</p>
            <p className="text-[13px] text-foreground/85 tabular-nums">
              {domainShort(weakest.domain)} · {weakest.difficulty} · {scoreText(weakest)}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => practiseTopic(weakest, "weakest")}
            className="inline-flex h-[38px] shrink-0 items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-medium text-primary-foreground transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            {pending && starting === "weakest" ? (
              "preparing…"
            ) : (
              <>
                practise it <ArrowRight className="size-4" strokeWidth={2} />
              </>
            )}
          </button>
          {error && starting === "weakest" && (
            <p role="alert" className="w-full text-[13px] text-brand">
              {error}
            </p>
          )}
        </div>
      )}

      <ul>
        {domains.map((domain) => {
          const levels = byDomain.get(domain)!;
          const difficulty = levelFor(domain, levels);
          const list = levels.get(difficulty)!;
          const key = `${domain}|${difficulty}`;
          const available = DIFFICULTIES.filter((d) => levels.has(d));
          const unsolved = unsolvedQuestionIds(attempts ?? [], domain, difficulty).length;
          const weak = list.filter((t) => !t.mastered).sort((a, b) => a.recentAverage - b.recentAverage);
          const mastered = list.filter((t) => t.mastered);
          return (
            <li key={domain} className="mt-[18px] border-t border-line pt-[18px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[16px] font-medium">{domainShort(domain)}</h3>
                {unsolved > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setStarting(key);
                      practise(domain, difficulty, mode);
                    }}
                    className="h-8 shrink-0 rounded-full border border-brand/60 px-3.5 text-[13px] text-foreground tabular-nums transition-colors hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
                  >
                    {pending && starting === key ? "preparing…" : `practise ${Math.min(unsolved, PRACTICE_COUNT)} unsolved`}
                  </button>
                )}
              </div>

              {available.length > 1 ? (
                <div role="tablist" aria-label={`${domainShort(domain)} level`} className="mt-2.5 flex flex-wrap gap-1.5">
                  {available.map((d) => {
                    const selected = d === difficulty;
                    const weakCount = levels.get(d)!.filter((t) => !t.mastered).length;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setLevel((prev) => ({ ...prev, [domain]: d }))}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                          selected
                            ? "border-brand/60 bg-brand/15 text-foreground"
                            : "border-line text-subtle hover:text-foreground",
                        )}
                      >
                        {d}
                        <span
                          aria-label={`${weakCount} weak`}
                          className={cn("tabular-nums", weakCount === 0 ? "text-subtle" : selected ? "text-brand" : "")}
                        >
                          {weakCount === 0 ? <Check className="size-3" strokeWidth={2.25} /> : weakCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-0.5 text-[13px] text-subtle">{difficulty}</p>
              )}

              {error && starting?.startsWith(key) && (
                <p role="alert" className="mt-1 text-[13px] text-brand">
                  {error}
                </p>
              )}
              {weak.length > 0 ? (
                <ul className="-mx-2 mt-2.5">
                  {(expanded.has(key) ? weak : weak.slice(0, MAX_WEAK)).map((t) => (
                    <li key={t.topic}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => practiseTopic(t, topicKey(t))}
                        aria-label={`practise ${t.topic}, ${scoreText(t)}`}
                        className="group grid w-full grid-cols-[minmax(0,1fr)_56px_auto_16px] items-center gap-3 rounded-[10px] px-2 py-2 text-left text-[14px] transition-colors hover:bg-foreground/[0.05] focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 sm:grid-cols-[minmax(0,1fr)_72px_auto_16px]"
                      >
                        <span className="truncate text-foreground/85 group-hover:text-foreground">{t.topic}</span>
                        <Bar
                          fraction={t.answered === 0 ? 0 : t.recentAverage / 10}
                          color={t.recentAverage < 5 ? "var(--brand)" : "color-mix(in oklch, var(--brand) 55%, var(--foreground))"}
                        />
                        <span className="min-w-[44px] text-right text-[13px] text-subtle tabular-nums">
                          {pending && starting === topicKey(t)
                            ? "preparing…"
                            : t.answered === 0
                              ? "skipped"
                              : t.recentAverage.toFixed(1)}
                        </span>
                        <ChevronRight className="size-4 text-subtle group-hover:text-foreground" strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                  {weak.length > MAX_WEAK && (
                    <li>
                      <button
                        type="button"
                        onClick={() => toggleIn(setExpanded, key)}
                        className="px-2 pt-1 text-[13px] text-brand hover:brightness-110"
                      >
                        {expanded.has(key) ? "show less" : `+${weak.length - MAX_WEAK} more`}
                      </button>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-2.5 text-[14px] text-foreground/70">
                  {difficulty === "hard" ? "no weak topics at this level — nice work." : "no weak topics here — try a harder level."}
                </p>
              )}
              {mastered.length > 0 && (
                <div className="mt-2.5">
                  <button
                    type="button"
                    aria-expanded={showMastered.has(key)}
                    onClick={() => toggleIn(setShowMastered, key)}
                    className="inline-flex items-center gap-1.5 text-[13px] text-subtle tabular-nums hover:text-foreground"
                  >
                    <Check className="size-3.5 text-brand" strokeWidth={2.25} />
                    {mastered.length} mastered
                    <ChevronRight
                      className={cn("size-3.5 transition-transform", showMastered.has(key) && "rotate-90")}
                      strokeWidth={1.75}
                    />
                  </button>
                  {showMastered.has(key) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mastered.map((t) => (
                        <span key={t.topic} className="rounded-full border border-brand/50 px-2.5 py-0.5 text-[12px] text-foreground/85">
                          {t.topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[13px] text-subtle">
        a topic counts as mastered once your last {ADAPTIVE.masteryWindow} answers on it average {ADAPTIVE.masteryScore}/10.
      </p>
    </Card>
  );
}
