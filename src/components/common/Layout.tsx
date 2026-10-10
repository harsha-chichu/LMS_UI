import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The narrow centred column every app screen uses. */
export function AppColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[520px] px-5 md:px-0", className)}>{children}</div>;
}

/** "‹   title" bar used on the report and profile screens. */
export function BackHeader({ title, href }: { title: string; href: string }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      <Link
        href={href}
        aria-label="Back"
        className="absolute left-0 -ml-2 rounded-full p-2 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="text-[14px] text-subtle">{title}</h1>
    </header>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-[13px] text-subtle", className)}>{children}</h2>;
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("border-t border-line py-6", className)}>{children}</section>;
}

/** Three numbers split by thin vertical rules. */
export function StatRow({
  items,
}: {
  items: { value: ReactNode; label: string; accent?: boolean }[];
}) {
  return (
    <dl className="grid grid-cols-3 border-y border-line py-5">
      {items.map((item, i) => (
        <div key={item.label} className={cn("flex flex-col items-center gap-1", i > 0 && "border-l border-line")}>
          <dd className={cn("text-[22px] font-medium tabular-nums", item.accent && "text-brand")}>{item.value}</dd>
          <dt className="text-[12px] text-subtle">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}
