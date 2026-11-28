"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { radarPoint, radarPoints, toPointsAttr, weakestIndex, type RadarAxis } from "@/components/report/radar";

const W = 340;
const H = 320;
const CX = 170;
const CY = 160;
const R = 108;
const RINGS = [0.25, 0.5, 0.75, 1];

/** A pentagon (or any n-gon) of 0–100 skill scores, drawn in the accent colour. */
export function SkillRadar({ axes, className }: { axes: RadarAxis[]; className?: string }) {
  const n = axes.length;
  const values = axes.map((a) => a.value);
  const points = radarPoints(values, R, CX, CY);
  const weak = weakestIndex(values);

  // Grow in from a smaller shape on first paint.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full max-w-[340px] overflow-visible", className)}
      role="img"
      aria-label={`skill balance: ${axes.map((a) => `${a.label} ${a.value}`).join(", ")}`}
    >
      {RINGS.map((f) => (
        <polygon
          key={f}
          points={toPointsAttr(Array.from({ length: n }, (_, i) => radarPoint(i, n, f, R, CX, CY)))}
          fill={f === 1 ? "color-mix(in srgb, var(--surface-2) 45%, transparent)" : "none"}
          stroke="var(--surface-3)"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = radarPoint(i, n, 1, R, CX, CY);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--surface-3)" strokeWidth={1} />;
      })}

      <g
        className={cn(
          "transition-transform duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
          shown ? "scale-100" : "scale-[0.6]",
        )}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <polygon
          points={toPointsAttr(points)}
          fill="color-mix(in oklch, var(--brand) 26%, transparent)"
          stroke="var(--brand)"
          strokeWidth={2.25}
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
        ))}
      </g>

      {axes.map((a, i) => {
        const [x, y0] = radarPoint(i, n, 1.2, R, CX, CY);
        const anchor = Math.abs(x - CX) < 4 ? "middle" : x > CX ? "start" : "end";
        const y = i === 0 ? y0 - 10 : y0;
        return (
          <g key={a.label} textAnchor={anchor}>
            <text x={x} y={y} className="fill-foreground/70 text-[12.5px]">
              {a.label}
            </text>
            <text
              x={x}
              y={y + 16}
              className={cn("text-[13px] font-semibold tabular-nums", i === weak ? "fill-brand" : "fill-foreground")}
            >
              {a.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
