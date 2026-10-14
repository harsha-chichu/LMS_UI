"use client";

import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Section, SectionLabel } from "@/components/common/Layout";
import { ADAPTIVE, DIFFICULTIES, DOMAINS, domainShort } from "@/lib/constants";
import { useStartSession } from "@/hooks/useStartSession";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { useAttempts, useProfile, useTopicMastery } from "@/lib/data";
import { PRACTICE_COUNT, type TopicMastery, unsolvedQuestionIds } from "@/lib/mastery";
import type { Difficulty, Domain } from "@/types";
import { cn } from "@/lib/utils";

const MAX_WEAK = 4;

/** Topics the user keeps scoring low on, per domain and difficulty. Sessions focus on these. */
export function WeakAreas() {
  const { data: topics } = useTopicMastery();
  const { data: attempts } = useAttempts();
  const { data: profile } = useProfile();
  const speechSupported = useSpeechSupported();
  const { practise, start, pending, error } = useStartSession();
  const [starting, setStarting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (!topics?.length) return null;

  const mode = speechSupported ? (profile?.preferences.mode ?? "voice") : "text";
  const count = profile?.preferences.count ?? 5;

  /** A normal session on just this topic, at this level. */
  const practiseTopic = (t: TopicMastery) => {
    setStarting(`${t.domain}|${t.difficulty}|${t.topic}`);
    start({ domain: t.domain, difficulty: t.difficulty, count, mode, topics: [t.topic] });
  };
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups = new Map<string, TopicMastery[]>();
  for (const t of topics) {
    const key = `${t.domain}|${t.difficulty}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const order = (key: string) => {
    const [domain, difficulty] = key.split("|");
    return DOMAINS.findIndex((d) => d.value === domain) * 10 + DIFFICULTIES.indexOf(difficulty as never);
  };

  return (
    <Section>
      <SectionLabel>your weak areas</SectionLabel>
      <p className="mt-1 text-[13px] text-subtle">
        a topic counts as mastered once your last {ADAPTIVE.masteryWindow} answers on it average{" "}
        {ADAPTIVE.masteryScore}/10. tap one to practise it.
      </p>
      <ul className="mt-2">
        {[...groups.entries()]
          .sort(([a], [b]) => order(a) - order(b))
          .map(([key, list]) => {
            const { domain, difficulty } = list[0];
            const unsolved = unsolvedQuestionIds(attempts ?? [], domain as Domain, difficulty as Difficulty).length;
            const weak = list.filter((t) => !t.mastered).sort((a, b) => a.recentAverage - b.recentAverage);
            const mastered = list.filter((t) => t.mastered);
            return (
              <li key={key} className="border-b border-line py-4 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px]">
                    {domainShort(domain)} · {difficulty}
                  </p>
                  {unsolved > 0 && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setStarting(key);
                        practise(domain as Domain, difficulty as Difficulty, mode);
                      }}
                      className="h-8 shrink-0 rounded-full border border-brand/60 px-3.5 text-[13px] text-white transition-colors hover:bg-brand/10 disabled:opacity-50"
                    >
                      {pending && starting === key
                        ? "preparing…"
                        : `practise ${Math.min(unsolved, PRACTICE_COUNT)} unsolved`}
                    </button>
                  )}
                </div>
                {error && starting?.startsWith(key) && (
                  <p role="alert" className="mt-1 text-[13px] text-brand">
                    {error}
                  </p>
                )}
                {weak.length > 0 ? (
                  <ul className="mt-1.5 -mx-2">
                    {(expanded.has(key) ? weak : weak.slice(0, MAX_WEAK)).map((t) => {
                      const rowKey = `${key}|${t.topic}`;
                      return (
                        <li key={t.topic}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => practiseTopic(t)}
                            aria-label={`practise ${t.topic}`}
                            className="group flex w-full items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-white/[0.04] disabled:opacity-60"
                          >
                            <span className="truncate text-white/80 group-hover:text-white">{t.topic}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  t.answered === 0 ? "text-subtle" : t.recentAverage < 5 ? "text-white/90" : "text-subtle",
                                )}
                              >
                                {pending && starting === rowKey
                                  ? "preparing…"
                                  : t.answered === 0
                                    ? "skipped"
                                    : `${t.recentAverage.toFixed(1)}/10`}
                              </span>
                              <ChevronRight className="size-4 text-subtle group-hover:text-white" strokeWidth={1.75} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {weak.length > MAX_WEAK && (
                      <li>
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="px-2 pt-1 text-[13px] text-brand hover:brightness-110"
                        >
                          {expanded.has(key) ? "show less" : `+${weak.length - MAX_WEAK} more`}
                        </button>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[14px] text-white/70">no weak topics here — try a harder level.</p>
                )}
                {mastered.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 text-[12px] text-subtle">mastered</span>
                    {mastered.map((t) => (
                      <span
                        key={t.topic}
                        className="inline-flex items-center gap-1 rounded-full border border-brand/50 px-2.5 py-0.5 text-[12px] text-white/85"
                      >
                        <Check className="size-3 text-brand" strokeWidth={2.25} />
                        {t.topic}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </Section>
  );
}
