import { ADAPTIVE } from "@/lib/constants";
import type { Difficulty, Domain } from "@/types";

/** A row of lms_question_attempts. */
export interface Attempt {
  question_id: string;
  session_id: string;
  domain: Domain;
  difficulty: Difficulty;
  topics: string[];
  /** 0–10; null when skipped. */
  score: number | null;
  skipped: boolean;
  created_at: string;
}

export interface TopicMastery {
  domain: Domain;
  difficulty: Difficulty;
  topic: string;
  attempts: number;
  /** Average of the last ADAPTIVE.masteryWindow attempts, skips counting as 0. */
  recentAverage: number;
  /** How many of those recent attempts were actually answered (0 = only skipped). */
  answered: number;
  lastPracticed: string;
  mastered: boolean;
}

export const attemptScore = (a: Pick<Attempt, "score" | "skipped">) => (a.skipped ? 0 : (a.score ?? 0));

/** Per topic, at each domain + difficulty the user has practised. */
export function topicMastery(attempts: Attempt[]): TopicMastery[] {
  const newestFirst = [...attempts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups = new Map<
    string,
    {
      key: Omit<TopicMastery, "attempts" | "recentAverage" | "answered" | "lastPracticed" | "mastered">;
      scores: number[];
      skipped: boolean[];
      last: string;
    }
  >();

  for (const a of newestFirst) {
    for (const topic of a.topics) {
      const id = `${a.domain}|${a.difficulty}|${topic}`;
      let g = groups.get(id);
      if (!g) {
        g = { key: { domain: a.domain, difficulty: a.difficulty, topic }, scores: [], skipped: [], last: a.created_at };
        groups.set(id, g);
      }
      g.scores.push(attemptScore(a));
      g.skipped.push(a.skipped || a.score == null);
    }
  }

  return [...groups.values()].map(({ key, scores, skipped, last }) => {
    const recent = scores.slice(0, ADAPTIVE.masteryWindow);
    const answered = skipped.slice(0, ADAPTIVE.masteryWindow).filter((s) => !s).length;
    const recentAverage = Math.round((recent.reduce((s, x) => s + x, 0) / recent.length) * 10) / 10;
    return {
      ...key,
      attempts: scores.length,
      recentAverage,
      answered,
      lastPracticed: last,
      mastered: scores.length >= ADAPTIVE.masteryMinAttempts && recentAverage >= ADAPTIVE.masteryScore,
    };
  });
}

/** A question counts as solved once the user has scored this much on it. */
export const SOLVED_SCORE = 7;

export type ByDifficulty = Record<Difficulty, number>;

/** Distinct questions answered at SOLVED_SCORE or better at least once, per difficulty. */
export function solvedByDifficulty(attempts: Attempt[]): ByDifficulty {
  const best = new Map<string, { difficulty: Difficulty; score: number }>();
  for (const a of attempts) {
    if (a.skipped || a.score == null) continue;
    const prev = best.get(a.question_id);
    if (!prev || a.score > prev.score) best.set(a.question_id, { difficulty: a.difficulty, score: a.score });
  }
  const counts: ByDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const b of best.values()) if (b.score >= SOLVED_SCORE) counts[b.difficulty] += 1;
  return counts;
}

/** Bank size per difficulty, summed over domains (rows from lms_bank_counts). */
export function totalsByDifficulty(rows: { difficulty: Difficulty; count: number }[]): ByDifficulty {
  const totals: ByDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const row of rows) totals[row.difficulty] += Number(row.count);
  return totals;
}

/** How many questions a "practise unsolved" session asks. */
export const PRACTICE_COUNT = 5;

/**
 * Bank questions the user has tried but not solved yet (best score below
 * SOLVED_SCORE, or only ever skipped) at this domain + difficulty, weakest first.
 */
export function unsolvedQuestionIds(attempts: Attempt[], domain: Domain, difficulty: Difficulty): string[] {
  const best = new Map<string, number>();
  for (const a of attempts) {
    if (a.domain !== domain || a.difficulty !== difficulty) continue;
    const score = a.skipped || a.score == null ? 0 : Number(a.score);
    best.set(a.question_id, Math.max(best.get(a.question_id) ?? 0, score));
  }
  return [...best.entries()]
    .filter(([, score]) => score < SOLVED_SCORE)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}
