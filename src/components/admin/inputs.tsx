import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const inputCls =
  "w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[14px] text-foreground outline-none focus-visible:border-brand";

/**
 * A native select with our own chevron instead of the browser's, which sits
 * jammed against the edge of rounded fields. `className` styles the field
 * (e.g. inputCls); `wrapperClassName` sizes it (e.g. "w-full" in forms).
 */
export function AdminSelect({ className, wrapperClassName, children, ...props }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative inline-flex", wrapperClassName)}>
      <select {...props} className={cn(className, "w-full cursor-pointer appearance-none pr-9")}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
    </span>
  );
}
