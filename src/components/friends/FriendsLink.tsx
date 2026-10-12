"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useFriendRequests } from "@/lib/data";

/** Header link to /friends, with a dot when someone is waiting on you. */
export function FriendsLink() {
  const { data: requests } = useFriendRequests();
  const incoming = requests?.filter((r) => r.direction === "incoming").length ?? 0;
  return (
    <Link
      href="/friends"
      aria-label={incoming ? `Friends, ${incoming} new request${incoming > 1 ? "s" : ""}` : "Friends"}
      className="relative rounded-full p-2 text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Users className="size-5" strokeWidth={1.75} />
      {incoming > 0 && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand" />}
    </Link>
  );
}
