"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Card, CardHead } from "@/components/common/Layout";
import { scoreTrend } from "@/lib/stats";
import type { Report } from "@/types";

const H = 190;
const M = { left: 28, right: 34, top: 24, bottom: 24 };
/** Past this many sessions the per-session dots would merge into the line. */
const MAX_DOTS = 40;

/** Session totals over time: a filled line with a scale. Hover or drag across it to read any session. */
export function ScoreTrend({ reports, whose = "your" }: { reports: Report[]; whose?: string }) {
  const { points, delta } = scoreTrend(reports);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradient = `trend-${useId().replace(/\W/g, "")}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const last = points.length - 1;
  const at = hover != null && hover <= last ? hover : last;

  // A scale snapped to tens with some room above and below the scores.
  const lo = Math.max(0, Math.floor((Math.min(...points) - 8) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...points) + 8) / 10) * 10);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const x = (i: number) => (last === 0 ? width / 2 : M.left + (i / last) * (width - M.left - M.right));
  const y = (v: number) => M.top + (1 - (v - lo) / Math.max(hi - lo, 1)) * (H - M.top - M.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");

  const nearest = (clientX: number) => {
    const left = box.current?.getBoundingClientRect().left ?? 0;
    const f = (clientX - left - M.left) / Math.max(width - M.left - M.right, 1);
    return Math.min(last, Math.max(0, Math.round(f * last)));
  };

  // Keep the value label inside the card at either end of the line.
  const anchor = last === 0 ? "middle" : at === 0 ? "start" : at >= last - 1 ? "end" : "middle";
  const labelX = anchor === "start" ? x(at) - 4 : anchor === "end" ? x(at) + 8 : x(at);

  return (
    <Card>
      <CardHead label="score trend">
        {points.length < 2
          ? "complete two sessions to see a trend"
          : `${delta >= 0 ? "+" : ""}${delta} since ${whose} first session`}
      </CardHead>
      {points.length > 0 && (
        <div
          ref={box}
          className="mt-3 touch-pan-y"
          style={{ height: H }}
          onPointerMove={(e) => setHover(nearest(e.clientX))}
          onPointerLeave={() => setHover(null)}
        >
          {width > 0 && (
            <svg
              width={width}
              height={H}
              viewBox={`0 0 ${width} ${H}`}
              role="img"
              aria-label={`scores over time: ${points.join(", ")}`}
              className="block text-[11px] tabular-nums"
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
                  <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                  <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fill="var(--subtle)">
                    {t}
                  </text>
                </g>
              ))}
              {last > 0 && (
                <>
                  <path d={`${line} L${x(last)},${H - M.bottom} L${x(0)},${H - M.bottom} Z`} fill={`url(#${gradient})`} />
                  <path
                    d={line}
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </>
              )}
              {points.length <= MAX_DOTS &&
                points.map((p, i) => i !== at && <circle key={i} cx={x(i)} cy={y(p)} r={2.5} fill="var(--brand)" />)}
              <circle cx={x(at)} cy={y(points[at])} r={5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2.5} />
              <text
                x={labelX}
                y={y(points[at]) - 12}
                textAnchor={anchor}
                fill="var(--foreground)"
                className="text-[13px] font-medium"
              >
                {points[at]}
              </text>
              {last > 0 && (
                <>
                  <text x={M.left} y={H - 4} fill="var(--subtle)">
                    first session
                  </text>
                  <text x={width - M.right} y={H - 4} textAnchor="end" fill="var(--subtle)">
                    {at === last ? "latest" : `session ${at + 1}`}
                  </text>
                </>
              )}
            </svg>
          )}
        </div>
      )}
    </Card>
  );
}
