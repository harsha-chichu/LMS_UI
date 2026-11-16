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

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * How the average of the last `window` sessions compares with the `window`
 * before them. Totals are newest first; null until there's something to compare.
 */
export function recentDelta(totals: number[], window = 5) {
  const recent = totals.slice(0, window);
  const before = totals.slice(window, window * 2);
  if (!recent.length || !before.length) return null;
  return Math.round(mean(recent) - mean(before));
}

/** Session count and average total per domain, best average first. */
export function domainAverages<D extends string>(sessions: { total: number; config: { domain: D } }[]) {
  const byDomain = new Map<D, number[]>();
  for (const s of sessions) byDomain.set(s.config.domain, [...(byDomain.get(s.config.domain) ?? []), s.total]);
  return [...byDomain.entries()]
    .map(([domain, totals]) => ({ domain, sessions: totals.length, average: Math.round(mean(totals)) }))
    .sort((a, b) => b.average - a.average || b.sessions - a.sessions);
}

/** Sessions (already newest first) split into calendar months. */
export function sessionsByMonth<T extends { total: number; completed_at: string }>(sessions: T[], now = new Date()) {
  const groups: { key: string; label: string; average: number; sessions: T[] }[] = [];
  for (const s of sessions) {
    const d = new Date(s.completed_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = d
        .toLocaleDateString("en", d.getFullYear() === now.getFullYear() ? { month: "long" } : { month: "long", year: "numeric" })
        .toLowerCase();
      group = { key, label, average: 0, sessions: [] };
      groups.push(group);
    }
    group.sessions.push(s);
  }
  for (const g of groups) g.average = Math.round(mean(g.sessions.map((s) => s.total)));
  return groups;
}

export interface Milestone {
  key: string;
  label: string;
  detail: string;
  /** 0–1 towards this milestone. */
  progress: number;
  done: boolean;
}

const LADDERS = [
  { id: "sessions", steps: [1, 10, 25, 50, 100], label: (n: number) => (n === 1 ? "first session" : `${n} sessions`), detail: (cur: number, n: number) => `${cur} of ${n}` },
  { id: "solved", steps: [10, 25, 50, 100, 200], label: (n: number) => `${n} solved`, detail: (cur: number, n: number) => `${cur} of ${n}` },
  { id: "streak", steps: [3, 7, 14, 30, 60], label: (n: number) => `${n}-day streak`, detail: (cur: number) => `longest so far ${cur}` },
  { id: "best", steps: [60, 70, 80, 90], label: (n: number) => `score ${n} or more`, detail: (cur: number) => `best so far ${cur}` },
] as const;

/**
 * For each ladder (sessions, solved, streak, best score): the highest step
 * reached and the next one to aim for. Reached steps come first.
 */
export function milestones(current: { sessions: number; solved: number; streak: number; best: number }) {
  const done: Milestone[] = [];
  const next: Milestone[] = [];
  let reached = 0;
  for (const ladder of LADDERS) {
    const value = current[ladder.id];
    const passed = ladder.steps.filter((n) => value >= n);
    reached += passed.length;
    const last = passed[passed.length - 1];
    const target = ladder.steps[passed.length];
    if (last !== undefined) done.push({ key: `${ladder.id}-${last}`, label: ladder.label(last), detail: "reached", progress: 1, done: true });
    if (target !== undefined) {
      next.push({ key: `${ladder.id}-${target}`, label: ladder.label(target), detail: ladder.detail(value, target), progress: value / target, done: false });
    }
  }
  return { items: [...done, ...next], reached };
}
