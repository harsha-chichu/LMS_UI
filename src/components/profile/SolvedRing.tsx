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
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] text-subtle">solved</h2>
        <p className="text-[13px] text-white/85">score {SOLVED_SCORE}+ on a question to solve it</p>
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
