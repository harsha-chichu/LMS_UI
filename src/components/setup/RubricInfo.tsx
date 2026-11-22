"use client";

import { Popover } from "@base-ui/react/popover";
import { Check, Info, X } from "lucide-react";
import { domainShort } from "@/lib/constants";
import { useRubric } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/types";

/**
 * Tap (i) to see how answers are scored at the picked domain and difficulty,
 * from the eval agent's rubric. A popover like the solved ring's, so it works
 * on phones. The rubric loads with the screen, so it's ready on tap; the
 * button is hidden when the agent can't be reached.
 */
export function RubricInfo({ domain, difficulty }: { domain: Domain; difficulty: Difficulty }) {
  const { data: rubric, error, isValidating } = useRubric(domain, difficulty);
  if (!rubric || error) return null;
  // While another level loads, the last one stays up, dimmed and labelled with its own level.
  const stale = isValidating || rubric.difficulty !== difficulty;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="How answers are scored"
        className="-my-1 inline-flex size-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand data-[popup-open]:text-foreground"
      >
        <Info className="size-4" strokeWidth={1.75} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={16} className="z-50">
          <Popover.Popup
            className={cn(
              "max-h-[min(70dvh,560px)] w-[min(340px,calc(100vw-32px))] origin-(--transform-origin) overflow-y-auto rounded-xl border border-line bg-popover p-4 text-[13px] leading-relaxed text-foreground/85 shadow-lg outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              stale && "opacity-70",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <Popover.Title className="text-[14px] font-medium text-foreground">how you&rsquo;re scored</Popover.Title>
              <span className="text-[12px] text-subtle">
                {domainShort(domain)} · {rubric.difficulty}
              </span>
            </div>
            <p className="mt-1.5">{rubric.expectations}</p>

            <ul className="mt-3 space-y-3">
              {rubric.criteria.map((c) => {
                const pct = Math.round(c.weight * 100);
                return (
                  <li key={c.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-foreground">{c.name}</span>
                      <span className="shrink-0 text-[12px] text-subtle tabular-nums">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-track" aria-hidden>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-subtle">{c.looksFor}</p>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-4 space-y-2.5 border-t border-line pt-3 text-[12px] leading-snug">
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
