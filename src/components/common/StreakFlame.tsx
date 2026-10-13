"use client";

import { useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/*
 * The flame moves by morphing between a few shapes, so it stays a crisp vector
 * at any size. Each layer is built from points (tip, side tongue, notch,
 * shoulder) that shift between keyframes; every keyframe uses the same path
 * commands, which is what lets SVG interpolate between them. Drawn with the
 * side tongue on the left, then mirrored so the tip leans left like 🔥.
 */

type Pt = [number, number];
const r = (n: number) => Math.round(n * 100) / 100;

function outer(t: Pt, s: Pt, n: Pt, sh: Pt) {
  const [tx, ty] = t, [sx, sy] = s, [nx, ny] = n, [rx, ry] = sh;
  return [
    `M16 39C8.3 39 3 33.6 3 26.6`,
    `C3 21.2 ${r(sx - 2.4)} ${r(sy + 2.6)} ${sx} ${sy}`,
    `C${r(sx + 0.4)} ${r(sy + 2.7)} ${r(nx - 1.7)} ${r(ny - 1)} ${nx} ${ny}`,
    `C${r(nx - 1)} ${r(ny - 6.5)} ${r(tx - 5.1)} ${r(ty + 5.6)} ${tx} ${ty}`,
    `C${r(tx + 0.4)} ${r(ty + 5)} ${r(rx - 2.8)} ${r(ry - 3.4)} ${rx} ${ry}`,
    `C${r(rx + 2.9)} ${r(ry + 3.6)} 29 21.6 29 26.6`,
    `C29 33.6 23.7 39 16 39Z`,
  ].join("");
}

function inner(t: Pt, s: Pt, n: Pt) {
  const [tx, ty] = t, [sx, sy] = s, [nx, ny] = n;
  return [
    `M16 37.2C11.6 37.2 8.8 34.2 8.8 30.2`,
    `C8.8 26.7 ${r(sx - 1.6)} ${r(sy + 2.5)} ${sx} ${sy}`,
    `C${r(sx + 0.5)} ${r(sy + 2.4)} ${r(nx - 1.2)} ${r(ny - 0.5)} ${nx} ${ny}`,
    `C${r(nx - 0.6)} ${r(ny - 3.6)} ${r(tx - 2.7)} ${r(ty + 2.7)} ${tx} ${ty}`,
    `C${r(tx + 0.4)} ${r(ty + 3.6)} 23.2 22.7 23.2 29.1`,
    `C23.2 34 20.2 37.2 16 37.2Z`,
  ].join("");
}

function core(t: Pt) {
  const [tx, ty] = t;
  return [
    `M16 37.2C13.6 37.2 12.4 35.5 12.4 33.6`,
    `C12.4 31.2 ${r(tx - 1.6)} ${r(ty + 2.2)} ${tx} ${ty}`,
    `C${r(tx + 1.6)} ${r(ty + 2.2)} 19.6 31.2 19.6 33.6`,
    `C19.6 35.5 18.4 37.2 16 37.2Z`,
  ].join("");
}

// Keyframes: the tip licks up and leans, the side tongue flickers, the body breathes.
const OUTER = [
  outer([18.3, 2], [8.2, 15], [11.6, 20.4], [23.8, 13.8]),
  outer([16.6, 3.6], [7.3, 12.4], [11.2, 19.6], [24.4, 14.8]),
  outer([19.8, 0.6], [8.9, 16.4], [12.1, 21.1], [23.1, 12.6]),
  outer([17.4, 2.9], [7.7, 13.6], [11.4, 20], [24.1, 13.4]),
];
const INNER = [
  inner([19.6, 16.3], [12.8, 21.8], [15.9, 25.9]),
  inner([20.5, 15], [13.3, 22.8], [16.2, 26.3]),
  inner([18.5, 17.6], [12.1, 20.5], [15.6, 25.4]),
  inner([19.2, 16.6], [12.5, 21.2], [15.8, 25.6]),
];
const CORE = [core([16, 27.4]), core([15.4, 26]), core([16.6, 28.1]), core([15.8, 26.7])];

const loop = (frames: string[]) => [...frames, frames[0]].join(";");
const EASE = "0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1";

function Morph({ frames, dur, still }: { frames: string[]; dur: string; still: boolean }) {
  if (still) return null;
  return (
    <animate
      attributeName="d"
      dur={dur}
      values={loop(frames)}
      keyTimes="0;0.25;0.5;0.75;1"
      calcMode="spline"
      keySplines={EASE}
      repeatCount="indefinite"
    />
  );
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const prefersReducedMotion = () => window.matchMedia(REDUCED).matches;

/**
 * Animated streak flame in the accent colour: a white-hot core fading to the
 * accent, each layer flickering at its own pace, with a glow around it.
 * Glow and embers live in globals.css (.flame-*); all motion stops under
 * prefers-reduced-motion.
 */
export function StreakFlame({ className }: { className?: string }) {
  // Several flames can be on one page, so each needs its own gradient/filter ids.
  const id = `flame${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // The shape morphs are SVG animations, which CSS can't pause, so leave them out.
  const still = useSyncExternalStore(subscribe, prefersReducedMotion, () => false);

  return (
    <svg viewBox="0 0 32 40" className={cn("flame size-4 shrink-0 overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-outer`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: "color-mix(in oklch, var(--brand) 65%, white)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--brand)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklch, var(--brand) 85%, #000)" }} />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: "#fffaf0" }} />
          <stop offset="0.6" style={{ stopColor: "color-mix(in oklch, var(--brand) 30%, white)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklch, var(--brand) 60%, white)" }} />
        </linearGradient>
        <filter id={`${id}-halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>

      <g transform="matrix(-1 0 0 1 32 0)">
        <path className="flame-halo" d={OUTER[0]} fill="var(--brand)" filter={`url(#${id}-halo)`} />
        <path d={OUTER[0]} fill={`url(#${id}-outer)`}>
          <Morph frames={OUTER} dur="1.3s" still={still} />
        </path>
        <path d={INNER[0]} fill={`url(#${id}-inner)`}>
          <Morph frames={INNER} dur="0.95s" still={still} />
        </path>
        <path d={CORE[0]} fill="#fffdf4">
          <Morph frames={CORE} dur="0.7s" still={still} />
        </path>
        <circle className="flame-ember" cx="11" cy="12" r="0.9" />
        <circle className="flame-ember flame-ember-2" cx="21" cy="9" r="0.75" />
      </g>
    </svg>
  );
}
