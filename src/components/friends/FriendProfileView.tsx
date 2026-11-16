"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppColumn, BackHeader, Card, CardHead, ProfileColumn, SectionLabel } from "@/components/common/Layout";
import { PillLink } from "@/components/common/PillButton";
import { Avatar } from "@/components/common/UserBits";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { Bar, ProfileSkeleton, SessionRow, StreakBadge } from "@/components/profile/parts";
import { statTiles } from "@/components/profile/ProgressTab";
import { ScoreTrend } from "@/components/profile/ScoreTrend";
import { SolvedCard } from "@/components/profile/SolvedCard";
import { ReportBody } from "@/components/report/ReportView";
import { removeFriend, useBankCounts, useCompletedSessions, useFriendProfile } from "@/lib/data";
import { totalsByDifficulty } from "@/lib/mastery";
import { personStats } from "@/lib/stats";
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
  const { data: bank } = useBankCounts();
  const [removing, setRemoving] = useState(false);

  if (error) return <NotAvailable />;
  if (!friend || !mine) return <ProfileSkeleton title="friend" href="/friends" />;

  const sessions = friend.sessions;
  const them = personStats(sessions);
  const me = personStats(mine);
  const name = friend.name || "your friend";
  const reportHref = (sessionId: string) => `/friends/${id}/report/${sessionId}`;

  return (
    <ProfileColumn className="pb-12">
      <BackHeader title="friend" href="/friends" />

      <div className="flex items-center gap-4 pt-3 pb-6 sm:gap-[18px]">
        <Avatar name={name} src={friend.avatar_url} size={72} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[24px] leading-tight font-semibold tracking-tight sm:text-[26px]">{name}</p>
          {them.streak > 0 && (
            <div className="mt-2.5">
              <StreakBadge days={them.streak} />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
        <div className="grid min-w-0 gap-3.5">
          <SolvedCard solved={friend.solved} totals={bank ? totalsByDifficulty(bank) : null} tiles={statTiles(sessions)} />

          <Card>
            <CardHead label={`you vs ${name}`}>
              <span className="flex items-center gap-3.5">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-brand" />
                  you
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-foreground/55" />
                  <span className="max-w-[110px] truncate">{name}</span>
                </span>
              </span>
            </CardHead>
            <dl className="mt-4 space-y-3.5">
              <CompareRow label="sessions" mine={me.sessions} theirs={them.sessions} name={name} />
              <CompareRow label="this week" mine={me.thisWeek} theirs={them.thisWeek} name={name} />
              <CompareRow label="average" mine={me.average} theirs={them.average} name={name} />
              <CompareRow label="best" mine={me.best} theirs={them.best} name={name} />
              <CompareRow label="streak" mine={me.streak} theirs={them.streak} name={name} />
            </dl>
          </Card>
        </div>

        <div className="grid min-w-0 gap-3.5">
          <ActivityHeatmap sessions={sessions} reportHref={reportHref} />
          <ScoreTrend reports={sessions.map((s) => s.report)} whose="their" />

          <section>
            <SectionLabel className="mt-1.5 mb-2 px-1">recent sessions</SectionLabel>
            {sessions.length === 0 ? (
              <p className="rounded-[18px] bg-surface px-5 py-8 text-center text-[15px] text-foreground/85">
                no finished sessions yet.
              </p>
            ) : (
              <ul className="rounded-[18px] bg-surface px-2 py-1">
                {sessions.slice(0, 10).map((s) => (
                  <SessionRow key={s.id} href={reportHref(s.id)} session={s} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="pt-7 text-center">
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
          className="text-[14px] text-subtle hover:text-foreground disabled:opacity-50"
        >
          {removing ? "removing…" : "remove friend"}
        </button>
      </div>
    </ProfileColumn>
  );
}

/** One stat as a pair of bars, yours over theirs, scaled to the larger of the two. */
function CompareRow({ label, mine, theirs, name }: { label: string; mine: number | null; theirs: number | null; name: string }) {
  const a = mine ?? 0;
  const b = theirs ?? 0;
  const max = Math.max(a, b, 1);
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 text-[14px]">
      <dt>{label}</dt>
      <dd className="space-y-[5px]">
        <CompareBar value={mine} fraction={a / max} wins={a > b} color="var(--brand)" who="you" />
        <CompareBar
          value={theirs}
          fraction={b / max}
          wins={b > a}
          color="color-mix(in srgb, var(--foreground) 55%, transparent)"
          who={name}
        />
      </dd>
    </div>
  );
}

function CompareBar({
  value,
  fraction,
  wins,
  color,
  who,
}: {
  value: number | null;
  fraction: number;
  wins: boolean;
  color: string;
  who: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_28px] items-center gap-2.5">
      <Bar fraction={fraction} color={color} className="h-1.5" />
      <span className={cn("text-right text-[13px] tabular-nums", wins ? "font-medium text-foreground" : "text-subtle")}>
        <span className="sr-only">{who}: </span>
        {value ?? "–"}
      </span>
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
