import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { BackHeader, ProfileColumn } from "@/components/common/Layout";
import { StreakFlame } from "@/components/common/StreakFlame";
import { domainShort, topicsShort } from "@/lib/constants";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SessionConfig } from "@/types";

/** A thin progress ring with something centred in it. */
export function Arc({
  size,
  stroke,
  fraction,
  color = "var(--brand)",
  className,
  children,
}: {
  size: number;
  stroke: number;
  /** 0–1. */
  fraction: number;
  color?: string;
  className?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, fraction)) * c;
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
          />
        )}
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** A thin horizontal bar filled to `fraction`. */
export function Bar({ fraction, color = "var(--brand)", className }: { fraction: number; color?: string; className?: string }) {
  return (
    <span aria-hidden className={cn("block h-1 overflow-hidden rounded-full bg-track", className)}>
      <span
        className="block h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`, background: color }}
      />
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] text-foreground/85">{children}</span>;
}

/** The small streak pill under a name. */
export function StreakBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand/15 px-3 text-[13px] font-medium tabular-nums">
      <StreakFlame className="size-[15px]" />
      {days} day streak
    </span>
  );
}

/** A finished session in a list: score ring, domain, level, when and topics. */
export function SessionRow({
  href,
  session,
}: {
  href: string;
  session: { total: number; completed_at: string; config: SessionConfig };
}) {
  const { config, total } = session;
  const topics = topicsShort(config.topics, 2);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={href}
        className="flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Arc size={44} stroke={3.5} fraction={total / 100} color={total >= 70 ? "var(--brand)" : "var(--brand-deep)"}>
          <span className="text-[14px] font-medium tabular-nums">{total}</span>
        </Arc>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            {domainShort(config.domain)}
            <Tag>{config.difficulty}</Tag>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-subtle">
            {relativeDay(session.completed_at)}
            {topics && ` · ${topics}`}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-subtle" strokeWidth={1.75} />
      </Link>
    </li>
  );
}

function Block({ className }: { className?: string }) {
  return <div className={cn("rounded-[18px] bg-surface", className)} />;
}

/** Placeholder cards in the profile's layout, shown while its data loads. */
export function ProfileSkeleton({ title, href }: { title: string; href: string }) {
  return (
    <ProfileColumn className="pb-12">
      <BackHeader title={title} href={href} />
      <div aria-busy="true" aria-label="loading" className="motion-safe:animate-pulse">
        <div className="flex items-center gap-4 pt-3 pb-7">
          <div className="size-[72px] shrink-0 rounded-full bg-surface" />
          <div className="space-y-2.5">
            <div className="h-6 w-36 rounded-md bg-surface" />
            <div className="h-4 w-48 rounded-md bg-surface" />
          </div>
        </div>
        <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-3.5">
            <Block className="h-[330px]" />
            <Block className="h-[280px]" />
          </div>
          <div className="grid gap-3.5">
            <Block className="h-[250px]" />
            <Block className="h-[260px]" />
          </div>
        </div>
      </div>
    </ProfileColumn>
  );
}
