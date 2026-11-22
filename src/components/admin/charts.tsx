"use client";

import { useState } from "react";

/** How values are written. A name, not a function, so server components can pass it. */
export type Unit = "count" | "usd" | "score";

function formatter(unit: Unit) {
  if (unit === "usd") return (v: number) => (v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);
  if (unit === "score") return (v: number) => v.toFixed(1);
  return (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Single-series column chart in the brand colour. Thin bars with 4px rounded
 * tops on a shared baseline, 2px gaps, a recessive grid, and a hover tooltip
 * per bar (hit area is the full column, not just the bar). One series, so no
 * legend: the panel title names it. A table view sits behind "table".
 */
export function ColumnChart({
  data,
  unit = "count",
  height = 140,
  label,
}: {
  data: { label: string; value: number | null }[];
  unit?: Unit;
  height?: number;
  label: string;
}) {
  const format = formatter(unit);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  const n = data.length || 1;
  const W = 600;
  const H = height;
  const pad = { top: 8, bottom: 18 };
  const plotH = H - pad.top - pad.bottom;
  const slot = W / n;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const r = Math.min(4, barW / 2);
  const total = data.reduce((s, d) => s + (d.value ?? 0), 0);

  if (table) {
    return (
      <div>
        <ToggleRow table={table} setTable={setTable} />
        <div className="max-h-[220px] overflow-y-auto text-[12px]">
          <table className="w-full">
            <thead>
              <tr className="text-subtle">
                <th className="py-1 text-left font-normal">day</th>
                <th className="py-1 text-right font-normal">{label}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-t border-line/70">
                  <td className="py-1">{d.label}</td>
                  <td className="py-1 text-right tabular-nums">{d.value == null ? "—" : format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const h = hover != null ? data[hover] : null;
  return (
    <div>
      <ToggleRow table={table} setTable={setTable} />
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-[140px] w-full"
          role="img"
          aria-label={`${label}: ${data.length} days, total ${format(total)}`}
          onMouseLeave={() => setHover(null)}
        >
          {[0.5, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={pad.top + plotH * (1 - f)}
              y2={pad.top + plotH * (1 - f)}
              stroke="var(--line)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line x1={0} x2={W} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--surface-3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => {
            const v = d.value ?? 0;
            const bh = (v / max) * plotH;
            const x = i * slot + (slot - barW) / 2;
            const y = pad.top + plotH - bh;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}>
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                {bh > 0 && (
                  <path
                    d={roundedTop(x, y, barW, bh, Math.min(r, bh))}
                    fill="var(--brand)"
                    opacity={hover == null || hover === i ? 1 : 0.45}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex justify-between text-[11px] text-faint">
          <span>{data[0]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
        {h && hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[10px] bg-surface-3 px-2.5 py-1.5 text-[12px] whitespace-nowrap shadow-lg"
            style={{ left: `${((hover + 0.5) / n) * 100}%` }}
          >
            <div className="text-subtle">{h.label}</div>
            <div className="tabular-nums">
              {h.value == null ? "—" : format(h.value)} <span className="text-subtle">{label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ table, setTable }: { table: boolean; setTable: (v: boolean) => void }) {
  return (
    <div className="mb-1 flex justify-end">
      <button
        type="button"
        onClick={() => setTable(!table)}
        className="text-[11px] text-faint underline-offset-4 hover:text-subtle hover:underline"
      >
        {table ? "chart" : "table"}
      </button>
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Horizontal share bars (e.g. sessions by domain): value label in text ink, bar in brand. */
export function ShareBars({ rows, unit = "count" }: { rows: { label: string; value: number; note?: string }[]; unit?: Unit }) {
  const format = formatter(unit);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate">{r.label}</span>
          <span className="h-2 rounded-full bg-track">
            <span className="block h-2 rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">
            {format(r.value)}
            {r.note && <span className="ml-1.5 text-[12px] text-subtle">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Funnel: one bar per step, each as a share of the first step, with the
 * drop-off from the step before written next to it.
 */
export function FunnelBars({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <p className="text-[13px] text-subtle">nobody signed up in this range.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const share = s.value / first;
        const prev = i > 0 ? steps[i - 1].value : 0;
        const kept = i > 0 && prev ? s.value / prev : null;
        return (
          <li key={s.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-[13px] sm:grid-cols-[12rem_1fr_9rem]">
            <span className="truncate">{s.label}</span>
            <span className="h-3 rounded-full bg-track">
              <span className="block h-3 rounded-full bg-brand" style={{ width: `${Math.max(share * 100, s.value ? 1 : 0)}%` }} />
            </span>
            <span className="text-right tabular-nums">
              {s.value.toLocaleString("en-US")}
              <span className="ml-1.5 text-[12px] text-subtle">
                {i === 0 ? "100%" : `${Math.round(share * 100)}%`}
                {kept != null && <span className="hidden sm:inline"> · {Math.round(kept * 100)}% of prev</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
