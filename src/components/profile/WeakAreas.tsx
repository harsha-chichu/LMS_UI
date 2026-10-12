"use client";

import { Section, SectionLabel } from "@/components/common/Layout";
import { DIFFICULTIES, DOMAINS, domainShort } from "@/lib/constants";
import { useTopicMastery } from "@/lib/data";
import type { TopicMastery } from "@/lib/mastery";
import { cn } from "@/lib/utils";

const MAX_WEAK = 4;

/** Topics the user keeps scoring low on, per domain and difficulty. Sessions focus on these. */
export function WeakAreas() {
  const { data: topics } = useTopicMastery();
  if (!topics?.length) return null;

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
      <p className="mt-1 text-[13px] text-subtle">your next sessions focus on these until you score 8+ on them.</p>
      <ul className="mt-2">
        {[...groups.entries()]
          .sort(([a], [b]) => order(a) - order(b))
          .map(([key, list]) => {
            const { domain, difficulty } = list[0];
            const weak = list.filter((t) => !t.mastered).sort((a, b) => a.recentAverage - b.recentAverage);
            const mastered = list.filter((t) => t.mastered);
            return (
              <li key={key} className="border-b border-line py-4 last:border-b-0">
                <p className="text-[15px]">
                  {domainShort(domain)} · {difficulty}
                </p>
                {weak.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {weak.slice(0, MAX_WEAK).map((t) => (
                      <li key={t.topic} className="flex items-center justify-between gap-4 text-[14px]">
                        <span className="truncate text-white/80">{t.topic}</span>
                        <span
                          className={cn(
                            "shrink-0 tabular-nums",
                            t.recentAverage < 5 ? "text-white/90" : "text-subtle",
                          )}
                        >
                          {t.recentAverage.toFixed(1)}/10
                        </span>
                      </li>
                    ))}
                    {weak.length > MAX_WEAK && (
                      <li className="text-[13px] text-subtle">+{weak.length - MAX_WEAK} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[14px] text-white/70">no weak topics here — try a harder level.</p>
                )}
                {mastered.length > 0 && (
                  <p className="mt-2 text-[13px] text-subtle">
                    <span className="text-brand">mastered</span> · {mastered.map((t) => t.topic).join(", ")}
                  </p>
                )}
              </li>
            );
          })}
      </ul>
    </Section>
  );
}
