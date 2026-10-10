"use client";

import { cn } from "@/lib/utils";

/**
 * The text-only toggle from the designs: unselected options are grey, the
 * selected one is white with an orange dot underneath.
 */
export function SegmentedPicker<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  format = (v) => String(v),
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  format?: (value: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex items-start gap-6 md:gap-8", className)}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt)}
            className={cn(
              "relative flex flex-col items-center pb-3 text-[17px] transition-colors focus-visible:outline-none focus-visible:after:absolute focus-visible:after:inset-x-[-6px] focus-visible:after:-inset-y-1 focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-brand",
              selected ? "font-medium text-white" : "text-subtle hover:text-white/80",
            )}
          >
            {format(opt)}
            <span
              aria-hidden
              className={cn(
                "absolute bottom-0 size-[5px] rounded-full bg-brand transition-opacity",
                selected ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
