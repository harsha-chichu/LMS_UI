"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { DIFFICULTIES } from "@/lib/constants";
import { type ByDifficulty, SOLVED_SCORE } from "@/lib/mastery";
import type { Difficulty } from "@/types";

const COLOR: Record<Difficulty, string> = {
  easy: "color-mix(in oklch, var(--brand) 55%, white)",
  medium: "var(--brand)",
  hard: "var(--brand-deep)",
};

/**
 * Questions solved per difficulty, as a ring split into easy / medium / hard
 * arcs. Each arc's length is that difficulty's share of the bank and it fills
 * as the user solves questions. Until the bank counts load (or if the RPC is
 * missing) the arcs are equal thirds and only the solved counts show.
 */
export function SolvedRing({
  solved,
  totals,
  size = 116,
}: {
  solved: ByDifficulty;
  totals: ByDifficulty | null;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 5;

  const solvedTotal = DIFFICULTIES.reduce((n, d) => n + solved[d], 0);
  const bankTotal = totals ? DIFFICULTIES.reduce((n, d) => n + totals[d], 0) : 0;

  const shares = DIFFICULTIES.map((d) => (bankTotal > 0 ? totals![d] / bankTotal : 1 / 3));
  const arcs = DIFFICULTIES.map((d, i) => {
    const start = shares.slice(0, i).reduce((sum, s) => sum + s * c, 0);
    const length = Math.max(0, shares[i] * c - gap);
    const fraction = totals && totals[d] > 0 ? Math.min(1, solved[d] / totals[d]) : 0;
    return { d, start, length, filled: fraction * length, fraction };
  });

  const label = totals
    ? `${solvedTotal} of ${bankTotal} questions solved`
    : `${solvedTotal} question${solvedTotal === 1 ? "" : "s"} solved`;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[13px] text-subtle">solved</h2>
        <div className="-mr-1.5 flex items-center gap-0.5 text-[13px] text-white/85">
          {SOLVED_SCORE}/10 = solved
          <SolvedInfo />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden>
            {arcs.map((a) => (
              <g key={a.d}>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="#1d1d1d"
                  strokeWidth={stroke}
                  strokeDasharray={`${a.length} ${c}`}
                  strokeDashoffset={-a.start}
                />
                {a.filled > 0 && (
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={COLOR[a.d]}
                    strokeWidth={stroke}
                    strokeDasharray={`${a.filled} ${c}`}
                    strokeDashoffset={-a.start}
                    className="transition-[stroke-dasharray] duration-700"
                  />
                )}
              </g>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] leading-none font-medium tabular-nums">{solvedTotal}</span>
            <span className="mt-1 text-[11px] text-white/70">{totals ? `of ${bankTotal}` : "solved"}</span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-3">
          {arcs.map((a) => (
            <div key={a.d} className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
              <dt className="flex items-center gap-2 text-[14px]">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: COLOR[a.d] }} />
                {a.d}
              </dt>
              <dd className="h-[3px] overflow-hidden rounded-full bg-white/10" aria-hidden>
                <span
                  className="block h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.round(a.fraction * 100)}%`, background: COLOR[a.d] }}
                />
              </dd>
              <dd className="text-[13px] text-white/80 tabular-nums">
                {solved[a.d]}
                {totals && <span className="text-subtle"> / {totals[a.d]}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Tap (i) to see how a question gets solved. A popover, so it works on phones too. */
function SolvedInfo() {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="How solving works"
        className="inline-flex size-7 items-center justify-center rounded-full text-subtle transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand data-[popup-open]:text-white"
      >
        <Info className="size-4" strokeWidth={1.75} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="max-w-[270px] origin-(--transform-origin) rounded-xl border border-line bg-popover p-4 text-[13px] leading-relaxed text-white/85 shadow-lg outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Popover.Title className="text-[14px] font-medium text-white">how solving works</Popover.Title>
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
