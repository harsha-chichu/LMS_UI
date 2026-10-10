import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-10 px-5 text-[15px]",
  md: "h-13 px-8 text-[17px]",
  lg: "h-14 w-full px-8 text-[18px] md:h-[60px]",
};

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-full bg-brand font-medium text-black transition-[filter,transform] hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50";

interface Common {
  size?: Size;
  arrow?: boolean;
}

export function PillLink({ size = "md", arrow, className, children, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, sizes[size], className)} {...props}>
      {children}
      {arrow && <ArrowRight className="size-[1.1em]" strokeWidth={2} />}
    </Link>
  );
}

export function PillButton({ size = "md", arrow, className, children, ...props }: Common & ComponentProps<"button">) {
  return (
    <button className={cn(base, sizes[size], className)} {...props}>
      {children}
      {arrow && <ArrowRight className="size-[1.1em]" strokeWidth={2} />}
    </button>
  );
}
