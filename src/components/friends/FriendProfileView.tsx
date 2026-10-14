"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppColumn, BackHeader, Section, SectionLabel, StatRow } from "@/components/common/Layout";
import { PillLink } from "@/components/common/PillButton";
import { Avatar, StreakCount, StreakPill } from "@/components/common/UserBits";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { ScoreTrend } from "@/components/profile/ScoreTrend";
import { ReportBody } from "@/components/report/ReportView";
import { domainShort } from "@/lib/constants";
import { removeFriend, useCompletedSessions, useFriendProfile } from "@/lib/data";
import { relativeDay } from "@/lib/dates";
import { activityFromSessions, personStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

function NotAvailable() {
  return (
    <AppColumn className="flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
      <p className="text-[17px]">you can only see your friends&apos; progress.</p>
      <PillLink href="/friends">back to friends</PillLink>
    </AppColumn>
  );
}

export function FriendProfileView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: friend, error } = useFriendProfile(id);
  const { data: mine } = useCompletedSessions();
  const [removing, setRemoving] = useState(false);

  if (error) return <NotAvailable />;
  if (!friend || !mine) return null;

  const sessions = friend.sessions;
  const them = personStats(sessions);
  const me = personStats(mine);
  const activity = activityFromSessions(sessions);
  const name = friend.name || "your friend";

  return (
    <AppColumn className="pb-12">
      <BackHeader title="friend" href="/friends" />

      <div className="flex items-center gap-4 pt-4 pb-7">
        <Avatar name={name} src={friend.avatar_url} size={60} />
        <p className="min-w-0 flex-1 truncate text-[22px] leading-tight font-medium">{name}</p>
        {them.streak > 0 && (
          // Phones get the compact flame + number so the name has room; the pill from sm up.
          <>
            <span className="shrink-0 sm:hidden">
              <StreakCount days={them.streak} />
            </span>
            <span className="hidden shrink-0 sm:inline-flex">
              <StreakPill days={them.streak} />
            </span>
          </>
        )}
      </div>

      <StatRow
        items={[
          { value: them.sessions, label: "sessions" },
          { value: them.average ?? "–", label: "average" },
          { value: them.best ?? "–", label: "best", accent: true },
        ]}
      />

      <Section className="border-t-0">
        <div className="grid grid-cols-[1fr_64px_64px] items-baseline gap-x-3">
          <SectionLabel>you vs {name}</SectionLabel>
          <span className="text-right text-[13px] text-brand">you</span>
          <span className="truncate text-right text-[13px] text-subtle">{name}</span>
        </div>
        <dl className="mt-2">
          <CompareRow label="sessions" mine={me.sessions} theirs={them.sessions} />
          <CompareRow label="this week" mine={me.thisWeek} theirs={them.thisWeek} />
          <CompareRow label="average" mine={me.average} theirs={them.average} />
          <CompareRow label="best" mine={me.best} theirs={them.best} />
          <CompareRow label="streak" mine={me.streak} theirs={them.streak} />
        </dl>
      </Section>

      <Section className="py-7">
        <ActivityHeatmap activity={activity} />
      </Section>

      <Section className="py-7">
        <ScoreTrend reports={sessions.map((s) => s.report)} />
      </Section>

      <Section>
        <SectionLabel>recent sessions</SectionLabel>
        {sessions.length === 0 ? (
          <p className="mt-3 text-[15px] text-white/70">no finished sessions yet.</p>
        ) : (
          <ul className="mt-1">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/friends/${id}/report/${s.id}`}
                  className="flex items-center justify-between gap-4 py-4 hover:text-white/80"
                >
                  <span className="text-[15px]">
                    {relativeDay(s.completed_at)} · {domainShort(s.config.domain)} · {s.config.difficulty}
                  </span>
                  <span className="text-[15px] font-medium tabular-nums">{s.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="border-t border-line pt-6 text-center">
        <button
          type="button"
          disabled={removing}
          onClick={async () => {
            if (!window.confirm(`remove ${name} from friends? you'll stop seeing each other's progress.`)) return;
            setRemoving(true);
            try {
              await removeFriend(id);
              router.replace("/friends");
            } catch {
              setRemoving(false);
            }
          }}
          className="text-[14px] text-subtle hover:text-white disabled:opacity-50"
        >
          {removing ? "removing…" : "remove friend"}
        </button>
      </div>
    </AppColumn>
  );
}

function CompareRow({ label, mine, theirs }: { label: string; mine: number | null; theirs: number | null }) {
  const a = mine ?? -1;
  const b = theirs ?? -1;
  return (
    <div className="grid grid-cols-[1fr_64px_64px] items-center gap-x-3 border-b border-line py-3 last:border-b-0">
      <dt className="text-[15px]">{label}</dt>
      <dd className={cn("text-right text-[15px] tabular-nums", a > b ? "font-medium text-brand" : "text-white/85")}>
        {mine ?? "–"}
      </dd>
      <dd className={cn("text-right text-[15px] tabular-nums", b > a ? "font-medium text-brand" : "text-white/85")}>
        {theirs ?? "–"}
      </dd>
    </div>
  );
}

/** A friend's report: summary, strengths, communication and per-question scores. */
export function FriendReportView() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const { data: friend, error } = useFriendProfile(id);
  if (error) return <NotAvailable />;
  if (!friend) return null;

  const session = friend.sessions.find((s) => s.id === sessionId);
  if (!session) return <NotAvailable />;
  return <ReportBody report={session.report} sessionId={session.id} friend={{ id, name: friend.name || "friend" }} />;
}
