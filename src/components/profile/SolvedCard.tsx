"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardHead } from "@/components/common/Layout";
import { Bar } from "@/components/profile/parts";
import { DIFFICULTIES } from "@/lib/constants";
import { type ByDifficulty, SOLVED_SCORE } from "@/lib/mastery";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/types";

const COLOR: Record<Difficulty, string> = {
  easy: "color-mix(in oklch, var(--brand) 55%, var(--foreground))",
  medium: "var(--brand)",
  hard: "var(--brand-deep)",
};

const SIZE = 148;
const STROKE = 12;
const GAP = 6;

export interface StatTile {
  value: ReactNode;
  label: string;
  /** A short line of context under the label, e.g. "3 this week". */
  note?: ReactNode;
  accent?: boolean;
}

/**
 * The profile's headline card: questions solved per difficulty as a ring split
 * into easy / medium / hard arcs, with the headline numbers underneath. Each
 * arc's length is that difficulty's share of the bank and it fills as questions
 * are solved. Until the bank counts load (or if the RPC is missing) the arcs
 * are equal thirds and only the solved counts show. Without `solved` (a friend
 * from before migration 0011) only the numbers show.
 */
export function SolvedCard({
  solved,
  totals,
  tiles,
}: {
  solved?: ByDifficulty | null;
  totals: ByDifficulty | null;
  tiles: StatTile[];
}) {
  return (
    <Card>
      {solved && (
        <>
          <CardHead label="solved">
            <span className="-mr-1.5 flex items-center gap-0.5">
              {SOLVED_SCORE}/10 = solved
              <SolvedInfo />
            </span>
          </CardHead>
          <SolvedRing solved={solved} totals={totals} />
        </>
      )}
      <dl className={cn("grid grid-cols-3 gap-2.5", solved && "mt-6")}>
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col rounded-[14px] bg-surface-2 px-3 pt-3.5 pb-3 sm:px-3.5">
            <dd
              className={cn(
                "order-1 text-[26px] leading-tight font-medium tracking-tight tabular-nums sm:text-[30px]",
                tile.accent && "text-brand",
              )}
            >
              {tile.value}
            </dd>
            <dt className="order-2 text-[12px] text-subtle">{tile.label}</dt>
            {tile.note != null && <dd className="order-3 mt-1.5 text-[12px] text-foreground/85 tabular-nums">{tile.note}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SolvedRing({ solved, totals }: { solved: ByDifficulty; totals: ByDifficulty | null }) {
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;

  const solvedTotal = DIFFICULTIES.reduce((n, d) => n + solved[d], 0);
  const bankTotal = totals ? DIFFICULTIES.reduce((n, d) => n + totals[d], 0) : 0;

  const shares = DIFFICULTIES.map((d) => (bankTotal > 0 ? totals![d] / bankTotal : 1 / 3));
  const arcs = DIFFICULTIES.map((d, i) => {
    const start = shares.slice(0, i).reduce((sum, s) => sum + s * c, 0) + GAP / 2;
    const length = Math.max(0, shares[i] * c - GAP);
    const fraction = totals && totals[d] > 0 ? Math.min(1, solved[d] / totals[d]) : 0;
    return { d, start, length, filled: fraction * length, fraction };
  });

  const label = totals
    ? `${solvedTotal} of ${bankTotal} questions solved`
    : `${solvedTotal} question${solvedTotal === 1 ? "" : "s"} solved`;

  return (
    <div className="mt-5 flex items-center gap-4 sm:gap-6">
      <div className="relative size-[116px] shrink-0 sm:size-[148px]" role="img" aria-label={label}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" aria-hidden>
          {arcs.map((a) => (
            <g key={a.d} fill="none" strokeWidth={STROKE} strokeLinecap="round">
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                stroke="var(--track)"
                strokeDasharray={`${a.length} ${c}`}
                strokeDashoffset={-a.start}
              />
              {a.filled > 0 && (
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={r}
                  stroke={COLOR[a.d]}
                  strokeDasharray={`${a.filled} ${c}`}
                  strokeDashoffset={-a.start}
                  className="transition-[stroke-dasharray] duration-700"
                />
              )}
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] leading-none font-medium tabular-nums sm:text-[40px]">{solvedTotal}</span>
          <span className="mt-1 text-[12px] text-subtle tabular-nums">{totals ? `of ${bankTotal}` : "solved"}</span>
        </div>
      </div>

      <dl className="min-w-0 flex-1 space-y-3.5">
        {arcs.map((a) => (
          <div key={a.d} className="grid grid-cols-[1fr_auto] items-baseline gap-x-2.5 gap-y-1.5">
            <dt className="flex items-center gap-2 text-[14px]">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: COLOR[a.d] }} />
              {a.d}
            </dt>
            <dd className="text-[13px] text-foreground/85 tabular-nums">
              {solved[a.d]}
              {totals && <span className="text-subtle"> / {totals[a.d]}</span>}
            </dd>
            <dd className="col-span-2" aria-hidden>
              <Bar fraction={a.fraction} color={COLOR[a.d]} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Tap (i) to see how a question gets solved. A popover, so it works on phones too. */
function SolvedInfo() {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="How solving works"
        className="inline-flex size-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand data-[popup-open]:text-foreground"
      >
        <Info className="size-4" strokeWidth={1.75} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="max-w-[270px] origin-(--transform-origin) rounded-xl border border-line bg-popover p-4 text-[13px] leading-relaxed text-foreground/85 shadow-lg outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Popover.Title className="text-[14px] font-medium text-foreground">how solving works</Popover.Title>
            <ul className="mt-2 space-y-1.5">
              <li>a question counts as solved once you score {SOLVED_SCORE}/10 or more on it.</li>
              <li>your best score counts — a lower retry doesn&apos;t undo it.</li>
              <li>skipped questions don&apos;t count. use try again on a report to have another go.</li>
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
