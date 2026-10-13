import { cn } from "@/lib/utils";

/**
 * Animated streak flame in the accent colour: an outer flame, a lighter middle
 * and a white-hot core, each flickering at its own pace, plus a soft glow and
 * a couple of rising embers. Animations live in globals.css (.flame-*) and
 * stop under prefers-reduced-motion.
 */
export function StreakFlame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" className={cn("flame size-4 shrink-0 overflow-visible", className)} aria-hidden>
      <circle className="flame-ember" cx="9" cy="10" r="0.9" />
      <circle className="flame-ember flame-ember-2" cx="15" cy="8" r="0.7" />
      <path
        className="flame-outer"
        d="M12 31C5 31 2 25.5 3.5 20 4.6 16 7.5 14 7.8 9.5c2.7 2 3.2 4.5 3 6.5C13 13 14.5 8 12.5 1 18 4.5 22 11 21.6 19 21.4 26 18 31 12 31Z"
      />
      <path
        className="flame-middle"
        d="M12 31c-4 0-6-3.5-5-7 .8-2.5 2.5-4 3-7 1.5 1.5 2 3 2 4.5 1.5-2 2.5-5 1.5-9 3.5 2.5 5.1 7 4.7 11.5-.4 4.5-2.7 7-6.2 7Z"
      />
      <path
        className="flame-core"
        d="M12 31c-2.2 0-3.2-1.8-2.7-3.5.5-1.5 1.7-2.3 2.1-4 1.4 1.3 3.1 2.8 3.2 4.5.1 1.8-1 3-2.6 3Z"
      />
    </svg>
  );
}
