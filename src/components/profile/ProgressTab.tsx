"use client";

import { Card } from "@/components/common/Layout";
import { PillLink } from "@/components/common/PillButton";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { DomainScores } from "@/components/profile/DomainScores";
import { Milestones } from "@/components/profile/Milestones";
import { ScoreTrend } from "@/components/profile/ScoreTrend";
import { SolvedCard, type StatTile } from "@/components/profile/SolvedCard";
import { WeakAreas } from "@/components/profile/WeakAreas";
import { type CompletedSession, useAttempts, useBankCounts } from "@/lib/data";
import { relativeDay } from "@/lib/dates";
import { solvedByDifficulty, totalsByDifficulty } from "@/lib/mastery";
import { activityFromSessions, longestStreak, personStats, recentDelta } from "@/lib/stats";

/** The three headline numbers, each with a line of context. Sessions are newest first. */
export function statTiles(sessions: { total: number; completed_at: string }[]): StatTile[] {
  const stats = personStats(sessions);
  const delta = recentDelta(sessions.map((s) => s.total));
  const best = sessions.find((s) => s.total === stats.best);
  return [
    { value: stats.sessions, label: "sessions", note: `${stats.thisWeek} this week` },
    {
      value: stats.average ?? "–",
      label: "average",
      note: delta == null ? undefined : `${delta >= 0 ? "+" : ""}${delta} last 5`,
    },
    { value: stats.best ?? "–", label: "best", note: best && relativeDay(best.completed_at), accent: true },
  ];
}

/** The dashboard: solved ring and headline numbers, what to practise next, then activity, trend, domains and milestones. */
export function ProgressTab({ sessions }: { sessions: CompletedSession[] }) {
  const { data: attempts } = useAttempts();
  const { data: bank } = useBankCounts();

  const solved = solvedByDifficulty(attempts ?? []);
  const best = sessions.reduce((max, s) => Math.max(max, s.total), 0);

  return (
    <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
      <div className="grid min-w-0 gap-3.5">
        <SolvedCard solved={solved} totals={bank ? totalsByDifficulty(bank) : null} tiles={statTiles(sessions)} />
        {sessions.length === 0 && (
          <Card className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-[15px] text-foreground/85">finish a session and your progress will fill in here.</p>
            <PillLink href="/setup" size="sm" arrow>
              start a session
            </PillLink>
          </Card>
        )}
        <WeakAreas />
      </div>
      <div className="grid min-w-0 gap-3.5">
        <ActivityHeatmap sessions={sessions} reportHref={(id) => `/report/${id}`} />
        <ScoreTrend reports={sessions.map((s) => s.report)} />
        <DomainScores sessions={sessions} />
        <Milestones
          sessions={sessions.length}
          solved={solved.easy + solved.medium + solved.hard}
          streak={longestStreak(activityFromSessions(sessions))}
          best={best}
        />
      </div>
    </div>
  );
}
