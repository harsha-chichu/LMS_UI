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
  lastPracticed: string;
  mastered: boolean;
}

export const attemptScore = (a: Pick<Attempt, "score" | "skipped">) => (a.skipped ? 0 : (a.score ?? 0));

/** Per topic, at each domain + difficulty the user has practised. */
export function topicMastery(attempts: Attempt[]): TopicMastery[] {
  const newestFirst = [...attempts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups = new Map<string, { key: Omit<TopicMastery, "attempts" | "recentAverage" | "lastPracticed" | "mastered">; scores: number[]; last: string }>();

  for (const a of newestFirst) {
    for (const topic of a.topics) {
      const id = `${a.domain}|${a.difficulty}|${topic}`;
      let g = groups.get(id);
      if (!g) {
        g = { key: { domain: a.domain, difficulty: a.difficulty, topic }, scores: [], last: a.created_at };
        groups.set(id, g);
      }
      g.scores.push(attemptScore(a));
    }
  }

  return [...groups.values()].map(({ key, scores, last }) => {
    const recent = scores.slice(0, ADAPTIVE.masteryWindow);
    const recentAverage = Math.round((recent.reduce((s, x) => s + x, 0) / recent.length) * 10) / 10;
    return {
      ...key,
      attempts: scores.length,
      recentAverage,
      lastPracticed: last,
      mastered: scores.length >= ADAPTIVE.masteryMinAttempts && recentAverage >= ADAPTIVE.masteryScore,
    };
  });
}
