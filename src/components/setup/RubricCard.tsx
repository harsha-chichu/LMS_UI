"use client";

import { Check, X } from "lucide-react";
import { useRubric } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/types";

/**
 * How answers are scored at the picked domain and difficulty, from the eval
 * agent's rubric, so people know what to cover before they start. Hidden when
 * the agent can't be reached.
 */
export function RubricCard({ domain, difficulty }: { domain: Domain; difficulty: Difficulty }) {
  const { data: rubric, error, isValidating } = useRubric(domain, difficulty);
  if (!rubric || error) return null;
  // While another level loads, the last one stays up, dimmed and labelled with its own level.
  const stale = isValidating || rubric.difficulty !== difficulty;

  return (
    <section
      aria-label="how you're scored"
      className={cn("border-b border-line py-5 transition-opacity md:py-7", stale && "opacity-60")}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[17px] font-normal">how you&rsquo;re scored</h2>
        <span className="text-[13px] text-subtle">{rubric.difficulty}</span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground/80">{rubric.expectations}</p>

      <ul className="mt-4 space-y-3.5">
        {rubric.criteria.map((c) => {
          const pct = Math.round(c.weight * 100);
          return (
            <li key={c.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px]">{c.name}</span>
                <span className="shrink-0 text-[13px] text-subtle tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-track" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-subtle">{c.looksFor}</p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 grid gap-3 text-[13px] leading-snug sm:grid-cols-2 sm:gap-6">
        {rubric.forgiven.length > 0 && (
          <div className="flex gap-2">
            <Check className="mt-px size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden />
            <div>
              <dt className="text-foreground/85">fine to leave out</dt>
              <dd className="mt-0.5 text-subtle">{rubric.forgiven.join(" · ")}</dd>
            </div>
          </div>
        )}
        {rubric.notForgiven.length > 0 && (
          <div className="flex gap-2">
            <X className="mt-px size-3.5 shrink-0 text-subtle" strokeWidth={2.25} aria-hidden />
            <div>
              <dt className="text-foreground/85">always costs points</dt>
              <dd className="mt-0.5 text-subtle">{rubric.notForgiven.join(" · ")}</dd>
            </div>
          </div>
        )}
      </dl>
    </section>
  );
}
