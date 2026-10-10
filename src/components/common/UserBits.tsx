import Link from "next/link";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function Avatar({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-medium text-black", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function StreakCount({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[15px] text-white/80" title={`${days} day streak`}>
      <Flame className="size-4 fill-brand text-brand" strokeWidth={1.5} />
      {days}
      <span className="sr-only">day streak</span>
    </span>
  );
}

export function StreakPill({ days }: { days: number }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full border border-brand/60 px-4 text-[14px] font-medium">
      <Flame className="size-4 fill-brand text-brand" strokeWidth={1.5} />
      {days} day streak
    </span>
  );
}

/** Streak + avatar cluster used in app headers. */
export function UserCluster({ name, streak }: { name: string; streak: number }) {
  return (
    <div className="flex items-center gap-4">
      <StreakCount days={streak} />
      <Link href="/profile" aria-label="Your profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Avatar name={name} size={44} />
      </Link>
    </div>
  );
}
