"use client";

import { Section, StatRow } from "@/components/common/Layout";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { ScoreTrend } from "@/components/profile/ScoreTrend";
import { SolvedRing } from "@/components/profile/SolvedRing";
import { WeakAreas } from "@/components/profile/WeakAreas";
import { type CompletedSession, useAttempts, useBankCounts } from "@/lib/data";
import { solvedByDifficulty, totalsByDifficulty } from "@/lib/mastery";
import { activityFromSessions, summaryStats } from "@/lib/stats";

/** The dashboard: solved ring, headline numbers, activity, trend and weak areas. */
export function ProgressTab({ sessions }: { sessions: CompletedSession[] }) {
  const { data: attempts } = useAttempts();
  const { data: bank } = useBankCounts();

  const reports = sessions.map((s) => s.report);
  const stats = summaryStats(reports);

  return (
    <>
      <Section className="border-t-0 py-7">
        <SolvedRing solved={solvedByDifficulty(attempts ?? [])} totals={bank ? totalsByDifficulty(bank) : null} />
      </Section>

      <StatRow
        items={[
          { value: stats.sessions, label: "sessions" },
          { value: stats.average ?? "–", label: "average" },
          { value: stats.best ?? "–", label: "best", accent: true },
        ]}
      />

      <Section className="border-t-0 py-7">
        <ActivityHeatmap activity={activityFromSessions(sessions)} />
      </Section>

      <Section className="py-7">
        <ScoreTrend reports={reports} />
      </Section>

      <WeakAreas />
    </>
  );
}
