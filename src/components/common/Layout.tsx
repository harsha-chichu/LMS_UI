import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The narrow centred column every app screen uses. */
export function AppColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[520px] px-5 md:px-0", className)}>{children}</div>;
}

/** The profile screens' column: the usual 520px, widening on desktop to fit two columns of cards. */
export function ProfileColumn({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[520px] px-5 md:px-0 lg:max-w-[960px] lg:px-5", className)}>{children}</div>
  );
}

/** "‹   title" bar used on the report and profile screens, with optional icons on the right. */
export function BackHeader({ title, href, actions }: { title: string; href: string; actions?: ReactNode }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      <Link
        href={href}
        aria-label="Back"
        className="absolute left-0 -ml-2 rounded-full p-2 text-foreground/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="text-[14px] text-subtle">{title}</h1>
      {actions && <div className="absolute right-0 -mr-2 flex items-center">{actions}</div>}
    </header>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-[13px] text-subtle", className)}>{children}</h2>;
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("border-t border-line py-6", className)}>{children}</section>;
}

/** A block lifted onto its own surface. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[18px] bg-surface p-5", className)}>{children}</section>;
}

/** A card's label on the left and a short note on the right. */
export function CardHead({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <SectionLabel>{label}</SectionLabel>
      {children != null && <div className="text-right text-[13px] text-foreground/85">{children}</div>}
    </div>
  );
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
