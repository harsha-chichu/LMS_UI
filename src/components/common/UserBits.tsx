"use client";

import Link from "next/link";
import { useState } from "react";
import { StreakFlame } from "@/components/common/StreakFlame";
import { FriendsLink } from "@/components/friends/FriendsLink";
import { cn } from "@/lib/utils";

/** The user's photo, or the first letter of their name on the accent colour. */
export function Avatar({
  name,
  src,
  size = 44,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  // Remember which URL failed, so a new photo gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny pre-sized avatar from Supabase Storage
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        decoding="async"
        onError={() => setFailed(src)}
        // A server-rendered image can fail before React attaches onError; catch that on mount.
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) setFailed(src);
        }}
        className={cn("shrink-0 rounded-full bg-surface-2 object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
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
      <StreakFlame className="size-[18px]" />
      {days}
      <span className="sr-only">day streak</span>
    </span>
  );
}

export function StreakPill({ days }: { days: number }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full border border-brand/60 px-4 text-[14px] font-medium">
      <StreakFlame className="size-[18px]" />
      {days} day streak
    </span>
  );
}

/** Streak + avatar cluster used in app headers. */
export function UserCluster({ name, avatarUrl, streak }: { name: string; avatarUrl?: string | null; streak: number }) {
  return (
    <div className="flex items-center gap-4">
      <StreakCount days={streak} />
      <FriendsLink />
      <Link href="/profile" aria-label="Your profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Avatar name={name} src={avatarUrl} size={44} />
      </Link>
    </div>
  );
}
