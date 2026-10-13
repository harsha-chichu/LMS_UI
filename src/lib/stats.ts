import { addDays, dayKey, startOfDay } from "@/lib/dates";
import type { Report } from "@/types";

export function currentStreak(activity: Record<string, number>, now = new Date()) {
  let day = startOfDay(now);
  // Today not practised yet doesn't break the streak.
  if (!activity[dayKey(day)]) day = addDays(day, -1);
  let streak = 0;
  while (activity[dayKey(day)]) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(activity: Record<string, number>) {
  const days = Object.keys(activity)
    .filter((k) => activity[k] > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const d = new Date(`${k}T00:00:00`);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function summaryStats(reports: { total: number }[]) {
  if (reports.length === 0) return { sessions: 0, average: null, best: null };
  const totals = reports.map((r) => r.total);
  return {
    sessions: reports.length,
    average: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length),
    best: Math.max(...totals),
  };
}

/** Oldest-first totals for the trend line. */
export function scoreTrend(reports: Report[]) {
  const ordered = [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const points = ordered.map((r) => r.total);
  const delta = points.length >= 2 ? points[points.length - 1] - points[0] : 0;
  return { points, delta };
}

interface HeatmapCell {
  key: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
}

/**
 * Weeks as columns (Sun→Sat rows), ending with the current week.
 * Future days in the current week are null.
 */
export function heatmap(activity: Record<string, number>, weeks = 26, now = new Date()) {
  const today = startOfDay(now);
  const start = addDays(today, -((weeks - 1) * 7 + today.getDay()));
  const columns: (HeatmapCell | null)[][] = [];
  const months: { col: number; label: string }[] = [];
  let total = 0;

  for (let w = 0; w < weeks; w++) {
    const col: (HeatmapCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      if (date > today) {
        col.push(null);
        continue;
      }
      if (date.getDate() === 1 || (w === 0 && d === 0)) {
        months.push({ col: w, label: date.toLocaleDateString("en", { month: "short" }).toLowerCase() });
      }
      const key = dayKey(date);
      const count = activity[key] ?? 0;
      total += count;
      col.push({
        key,
        count,
        level: (count >= 4 ? 4 : count) as HeatmapCell["level"],
        isToday: key === dayKey(today),
      });
    }
    columns.push(col);
  }

  // Drop a leading partial-month label that would collide with the next one.
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();

  return { columns, months, total };
}

/** Completed sessions per local day, for the heatmap and streaks. */
export function activityFromSessions(sessions: { completed_at: string }[]) {
  const activity: Record<string, number> = {};
  for (const s of sessions) {
    const key = dayKey(new Date(s.completed_at));
    activity[key] = (activity[key] ?? 0) + 1;
  }
  return activity;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Numbers used to compare people: totals, this week's sessions and streak. */
export function personStats(sessions: { total: number; completed_at: string }[], now = new Date()) {
  return {
    ...summaryStats(sessions),
    thisWeek: sessions.filter((s) => now.getTime() - new Date(s.completed_at).getTime() < WEEK_MS).length,
    streak: currentStreak(activityFromSessions(sessions), now),
  };
}
