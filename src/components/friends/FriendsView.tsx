"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AppColumn, BackHeader, Section, SectionLabel } from "@/components/common/Layout";
import { Avatar, StreakCount } from "@/components/common/UserBits";
import { Chip, PersonRow } from "@/components/friends/parts";
import {
  removeFriend,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  useFriendRequests,
  useFriendsOverview,
} from "@/lib/data";
import { personStats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { FriendRelation, UserSearchResult } from "@/types";
import Link from "next/link";

export function FriendsView() {
  return (
    <AppColumn className="pb-12">
      <BackHeader title="friends" href="/setup" />
      <FindFriends />
      <Requests />
      <Leaderboard />
      <SentRequests />
    </AppColumn>
  );
}

// ---- search ----

const MIN_QUERY = 3;

function FindFriends() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ term: string; items: UserSearchResult[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (term.length < MIN_QUERY) return;
    let live = true;
    const t = setTimeout(() => {
      searchUsers(term).then(
        (items) => {
          if (!live) return;
          setFailed(false);
          setResults({ term, items });
        },
        () => live && setFailed(true),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);

  const shown = term.length >= MIN_QUERY && results?.term === term ? results.items : null;

  const setRelation = (id: string, relation: FriendRelation) =>
    setResults((r) => r && { ...r, items: r.items.map((p) => (p.id === id ? { ...p, relation } : p)) });

  return (
    <Section className="border-t-0 pt-4">
      <SectionLabel>find friends</SectionLabel>
      <label className="relative mt-3 block">
        <span className="sr-only">search by name or email</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="name or exact email"
          autoComplete="off"
          className="h-11 w-full rounded-xl bg-surface-2 pr-4 pl-10 text-[15px] outline-none placeholder:text-subtle focus:ring-2 focus:ring-brand"
        />
      </label>

      {term.length > 0 && term.length < MIN_QUERY && (
        <p className="mt-3 text-[13px] text-subtle">type at least {MIN_QUERY} characters.</p>
      )}
      {failed && term.length >= MIN_QUERY && (
        <p role="alert" className="mt-3 text-[13px] text-brand">
          couldn&apos;t search right now — try again.
        </p>
      )}
      {shown && shown.length === 0 && (
        <p className="mt-3 text-[14px] text-white/70">no one found. try their full email address.</p>
      )}
      {shown && shown.length > 0 && (
        <ul className="mt-2">
          {shown.map((p) => (
            <PersonRow key={p.id} name={p.name} href={p.relation === "friends" ? `/friends/${p.id}` : undefined}>
              <RelationAction person={p} onChange={(r) => setRelation(p.id, r)} />
            </PersonRow>
          ))}
        </ul>
      )}
    </Section>
  );
}

function RelationAction({ person, onChange }: { person: UserSearchResult; onChange: (r: FriendRelation) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<FriendRelation>) => {
    setBusy(true);
    try {
      onChange(await fn());
    } catch {
      // Leave the row as it was; the lists refresh on the next visit.
    }
    setBusy(false);
  };

  switch (person.relation) {
    case "friends":
      return (
        <span className="inline-flex items-center gap-1.5 text-[14px] text-subtle">
          <Check className="size-4 text-brand" strokeWidth={2} />
          friends
        </span>
      );
    case "outgoing":
      return (
        <Chip
          tone="muted"
          disabled={busy}
          aria-label={`cancel request to ${person.name}`}
          onClick={() => run(async () => (await removeFriend(person.id), "none"))}
        >
          requested
        </Chip>
      );
    case "incoming":
      return (
        <Chip disabled={busy} onClick={() => run(async () => (await respondFriendRequest(person.id, true), "friends"))}>
          accept
        </Chip>
      );
    default:
      return (
        <Chip disabled={busy} onClick={() => run(() => sendFriendRequest(person.id))}>
          add
        </Chip>
      );
  }
}

// ---- requests ----

function Requests() {
  const { data } = useFriendRequests();
  const incoming = data?.filter((r) => r.direction === "incoming") ?? [];
  if (incoming.length === 0) return null;

  return (
    <Section>
      <SectionLabel>requests</SectionLabel>
      <ul className="mt-1">
        {incoming.map((r) => (
          <PersonRow key={r.id} name={r.name} detail="wants to be friends">
            <IncomingActions id={r.id} />
          </PersonRow>
        ))}
      </ul>
    </Section>
  );
}

function IncomingActions({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const respond = async (accept: boolean) => {
    setBusy(true);
    await respondFriendRequest(id, accept).catch(() => setBusy(false));
  };
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => respond(false)}
        className="text-[14px] text-subtle hover:text-white disabled:opacity-50"
      >
        decline
      </button>
      <Chip disabled={busy} onClick={() => respond(true)}>
        accept
      </Chip>
    </div>
  );
}

function SentRequests() {
  const { data } = useFriendRequests();
  const outgoing = data?.filter((r) => r.direction === "outgoing") ?? [];
  if (outgoing.length === 0) return null;

  return (
    <Section>
      <SectionLabel>sent requests</SectionLabel>
      <ul className="mt-1">
        {outgoing.map((r) => (
          <PersonRow key={r.id} name={r.name} detail="waiting for them to accept">
            <Chip tone="muted" onClick={() => void removeFriend(r.id).catch(() => {})}>
              cancel
            </Chip>
          </PersonRow>
        ))}
      </ul>
    </Section>
  );
}

// ---- leaderboard ----

function Leaderboard() {
  const { data, error } = useFriendsOverview();
  if (error && !data) {
    return (
      <Section>
        <SectionLabel>leaderboard</SectionLabel>
        <p className="mt-3 text-[15px] text-white/70">friends aren&apos;t available right now.</p>
      </Section>
    );
  }
  if (!data) return null;

  const rows = data
    .map((p) => ({ ...p, stats: personStats(p.sessions) }))
    .sort(
      (a, b) =>
        b.stats.thisWeek - a.stats.thisWeek ||
        (b.stats.average ?? -1) - (a.stats.average ?? -1) ||
        Number(b.is_me) - Number(a.is_me),
    );
  const hasFriends = rows.some((r) => !r.is_me);

  return (
    <Section>
      <div className="flex items-baseline justify-between">
        <SectionLabel>leaderboard</SectionLabel>
        {hasFriends && <span className="text-[12px] text-subtle">ranked by this week</span>}
      </div>
      {!hasFriends ? (
        <p className="mt-3 text-[15px] text-white/70">add friends to compare progress — only friends can see it.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-[20px_1fr_48px_44px_44px] items-center gap-x-3 pb-2 text-[12px] text-subtle">
            <span />
            <span />
            <span className="text-right">week</span>
            <span className="text-right">avg</span>
            <span className="text-right">streak</span>
          </div>
          <ol>
            {rows.map((r, i) => (
              <li key={r.id} className="border-t border-line">
                <Link
                  href={r.is_me ? "/profile" : `/friends/${r.id}`}
                  className="grid grid-cols-[20px_1fr_48px_44px_44px] items-center gap-x-3 py-3.5 hover:text-white/80"
                >
                  <span className={cn("text-[13px] tabular-nums", i === 0 ? "text-brand" : "text-subtle")}>{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name || "?"} size={32} />
                    <span className={cn("truncate text-[16px]", r.is_me && "text-brand")}>{r.is_me ? "you" : r.name}</span>
                  </span>
                  <span className="text-right text-[15px] tabular-nums">{r.stats.thisWeek}</span>
                  <span className="text-right text-[15px] tabular-nums">{r.stats.average ?? "–"}</span>
                  <span className="flex justify-end">
                    <StreakCount days={r.stats.streak} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </Section>
  );
}
