"use client";

import { useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// 🔥-shaped: a rounded base, a tall main tongue and a smaller one beside it (mirrored below so the tip leans left, like the emoji).
const OUTER =
  "M16 39C8.3 39 3 33.6 3 26.6c0-5.4 2.8-9 5.2-11.6.4 2.7 1.7 4.4 3.4 5.4C10.6 13.9 13.2 7.6 18.3 2c.4 5 2.7 8.4 5.5 11.8C26.7 17.4 29 21.6 29 26.6 29 33.6 23.7 39 16 39Z";
const INNER =
  "M16 37.2c-4.4 0-7.2-3-7.2-7 0-3.5 2.4-5.9 4-8.4.5 2.4 1.9 3.6 3.1 4.1-.6-3.6 1-6.9 3.7-9.6.4 3.6 3.6 6.4 3.6 12.8 0 4.9-3 8.1-7.2 8.1Z";
const CORE =
  "M16 37.2c-2.4 0-3.6-1.7-3.6-3.6 0-2.4 2-4 3.6-6.2 1.6 2.2 3.6 3.8 3.6 6.2 0 1.9-1.2 3.6-3.6 3.6Z";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const prefersReducedMotion = () => window.matchMedia(REDUCED).matches;

/**
 * Animated streak flame in the accent colour. Gradients give a hot centre
 * fading to the accent, an animated turbulence filter makes the edges ripple
 * like real fire, and a blurred halo plus drop-shadows make it glow. Motion
 * lives in globals.css (.flame-*) and stops under prefers-reduced-motion.
 */
export function StreakFlame({ className }: { className?: string }) {
  // Several flames can be on one page, so each needs its own gradient/filter ids.
  const id = `flame${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // The edge ripple is SVG animation, which CSS can't pause, so leave it out.
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
        <filter id={`${id}-wave`} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="1" seed="4" result="noise">
            {!still && (
              <animate
                attributeName="baseFrequency"
                dur="2.6s"
                values="0.035 0.06;0.045 0.08;0.03 0.065;0.035 0.06"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
          {/* Displacement isn't anti-aliased; a touch of blur smooths the edges. */}
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        <filter id={`${id}-halo`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      <g transform="matrix(-1 0 0 1 32 0)">
        <path className="flame-halo" d={OUTER} fill="var(--brand)" filter={`url(#${id}-halo)`} />
        <g filter={`url(#${id}-wave)`}>
          <path className="flame-outer" d={OUTER} fill={`url(#${id}-outer)`} />
          <path className="flame-middle" d={INNER} fill={`url(#${id}-inner)`} />
          <path className="flame-core" d={CORE} fill="#fffdf4" />
        </g>
        <circle className="flame-ember" cx="11" cy="12" r="0.9" />
        <circle className="flame-ember flame-ember-2" cx="21" cy="9" r="0.75" />
      </g>
    </svg>
  );
}
