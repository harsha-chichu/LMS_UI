import "server-only";
import { ADAPTIVE } from "@/lib/constants";
import { generateQuestions } from "@/lib/llm/service";
import { type Attempt, attemptScore, type TopicMastery, topicMastery } from "@/lib/mastery";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Question, SessionConfig } from "@/types";

/**
 * Picks a session's questions from the bank (lms_questions), steering towards
 * what the user is weak at:
 * - weak: topics they haven't mastered yet, preferring questions they haven't seen
 * - new: questions they've never been asked, preferring topics they've never tried
 * - review: mastered topics they haven't practised in a while
 * Questions from their last few sessions are never repeated. The LLM writes new
 * questions only for whatever the bank can't cover, and they're saved to the bank.
 */

interface BankQuestion {
  id: string;
  text: string;
  topics: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AVOID = 30;

const norm = (t: string) => t.trim().toLowerCase();

/** Same normalization as lms_questions.text_key. */
const textKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Postgres array literal with every element quoted; custom topics can contain commas or braces. */
const pgArray = (items: string[]) => `{${items.map((t) => `"${t.replace(/["\\]/g, "\\$&")}"`).join(",")}}`;

function shuffle<T>(items: T[]) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Takes from priority-ordered pools while rotating topics, so one topic doesn't fill the session. */
function spreadPicker() {
  const taken = new Set<string>();
  const topicUse = new Map<string, number>();
  const picked: BankQuestion[] = [];
  const keys = (q: BankQuestion) => (q.topics.length ? q.topics : [""]);
  const usage = (q: BankQuestion) => Math.min(...keys(q).map((t) => topicUse.get(t) ?? 0));

  return {
    picked,
    taken,
    take(pool: BankQuestion[], n: number) {
      for (let added = 0; added < n; added++) {
        let best: BankQuestion | undefined;
        for (const q of pool) {
          if (taken.has(q.id)) continue;
          if (!best || usage(q) < usage(best)) best = q;
          if (usage(best) === 0) break;
        }
        if (!best) return;
        taken.add(best.id);
        picked.push(best);
        for (const t of keys(best)) topicUse.set(t, (topicUse.get(t) ?? 0) + 1);
      }
    },
  };
}

export async function pickQuestions(userId: string, config: SessionConfig): Promise<Question[]> {
  const db = getSupabaseAdmin();
  const { domain, difficulty, count } = config;
  const chosen = (config.topics ?? []).map(norm);

  let bankQuery = db
    .from("lms_questions")
    .select("id, text, topics")
    .eq("domain", domain)
    .eq("difficulty", difficulty)
    .eq("status", "active");
  if (chosen.length) bankQuery = bankQuery.overlaps("topics", pgArray(chosen));

  const [bankRes, attemptsRes] = await Promise.all([
    bankQuery.limit(5000),
    db
      .from("lms_question_attempts")
      .select("question_id, session_id, domain, difficulty, topics, score, skipped, created_at")
      .eq("user_id", userId)
      .eq("domain", domain)
      .eq("difficulty", difficulty)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (bankRes.error) throw bankRes.error;
  if (attemptsRes.error) throw attemptsRes.error;
  const bank = shuffle((bankRes.data ?? []) as BankQuestion[]);
  const attempts = (attemptsRes.data ?? []) as Attempt[];

  // ---- what the user has done ----
  const latest = new Map<string, Attempt>(); // newest attempt per question
  for (const a of attempts) if (!latest.has(a.question_id)) latest.set(a.question_id, a);

  const recentSessions = [...new Set(attempts.map((a) => a.session_id))].slice(0, ADAPTIVE.recentSessions);
  const recent = new Set(attempts.filter((a) => recentSessions.includes(a.session_id)).map((a) => a.question_id));

  const mastery = new Map<string, TopicMastery>(topicMastery(attempts).map((m) => [m.topic, m]));
  const isWeak = (t: string) => mastery.has(t) && !mastery.get(t)!.mastered;
  const reviewDue = (t: string) => {
    const m = mastery.get(t);
    return !!m?.mastered && Date.now() - new Date(m.lastPracticed).getTime() >= ADAPTIVE.reviewAfterDays * DAY_MS;
  };
  const weakness = (q: BankQuestion) =>
    Math.min(...q.topics.filter(isWeak).map((t) => mastery.get(t)!.recentAverage));

  // ---- buckets, each in priority order ----
  const available = bank.filter((q) => !recent.has(q.id));
  const questionMastered = (q: BankQuestion) => {
    const a = latest.get(q.id);
    return !!a && attemptScore(a) >= ADAPTIVE.masteryScore;
  };

  const weak = available
    .filter((q) => !questionMastered(q) && q.topics.some(isWeak))
    // Unseen first (a different question on the same topic), then the weakest topics.
    .sort((a, b) => Number(latest.has(a.id)) - Number(latest.has(b.id)) || weakness(a) - weakness(b));

  const fresh = available
    .filter((q) => !latest.has(q.id) && !q.topics.some(isWeak))
    .filter((q) => !q.topics.length || q.topics.some((t) => !mastery.has(t)))
    // Topics never tried first.
    .sort((a, b) => Number(a.topics.some((t) => mastery.has(t))) - Number(b.topics.some((t) => mastery.has(t))));

  const review = available
    .filter((q) => q.topics.some(reviewDue))
    .sort((a, b) => Number(latest.has(a.id)) - Number(latest.has(b.id)));

  // ---- fill the session: 60% weak / 25% new / 15% review, then top up ----
  const picker = spreadPicker();
  const weakN = Math.round(count * ADAPTIVE.weakShare);
  const reviewN = Math.min(count - weakN, Math.round(count * ADAPTIVE.reviewShare));
  picker.take(weak, weakN);
  picker.take(review, reviewN);
  picker.take(fresh, count - picker.picked.length);
  for (const pool of [weak, fresh, review]) picker.take(pool, count - picker.picked.length);

  // ---- the bank ran out: generate the rest and save it ----
  const missing = count - picker.picked.length;
  if (missing > 0) {
    const weakTopics = [...mastery.values()]
      .filter((m) => !m.mastered && (!chosen.length || chosen.includes(m.topic)))
      .sort((a, b) => a.recentAverage - b.recentAverage)
      .map((m) => m.topic);
    const focus = weakTopics.length ? weakTopics.slice(0, 5) : chosen;
    const seenFirst = [...bank].sort((a, b) => Number(latest.has(b.id)) - Number(latest.has(a.id)));
    const avoid = seenFirst.slice(0, MAX_AVOID).map((q) => q.text);

    const generated = await saveGenerated(userId, config, missing, focus, avoid);
    picker.take(generated, missing);

    // Still short (e.g. the LLM is down and the fallback only repeats the bank):
    // reuse the least recently asked questions rather than run a short session.
    const leftovers = [...bank].sort(
      (a, b) => (latest.get(a.id)?.created_at ?? "").localeCompare(latest.get(b.id)?.created_at ?? ""),
    );
    picker.take(leftovers, count - picker.picked.length);
  }
  if (!picker.picked.length) throw new Error(`no questions available for ${domain} / ${difficulty}`);

  return shuffle(picker.picked).map((q, i) => ({ id: `q${i + 1}`, text: q.text, bankId: q.id, topics: q.topics }));
}

/** Generates questions, adds them to the bank (skipping duplicates) and returns their bank rows. */
async function saveGenerated(
  userId: string,
  config: SessionConfig,
  count: number,
  topics: string[],
  avoid: string[],
): Promise<BankQuestion[]> {
  const db = getSupabaseAdmin();
  const { data: questions } = await generateQuestions(config.domain, config.difficulty, count, topics, avoid);
  if (!questions.length) return [];

  const { error } = await db.from("lms_questions").upsert(
    questions.map((q) => ({
      domain: config.domain,
      difficulty: config.difficulty,
      text: q.text,
      topics: q.topics,
      source: "generated",
      created_by: userId,
    })),
    { onConflict: "domain,text_key", ignoreDuplicates: true },
  );
  if (error) throw error;

  // Read back by key: covers both new rows and ones that already existed.
  const { data, error: readError } = await db
    .from("lms_questions")
    .select("id, text, topics")
    .eq("domain", config.domain)
    .eq("status", "active")
    .in("text_key", questions.map((q) => textKey(q.text)));
  if (readError) throw readError;
  return (data ?? []) as BankQuestion[];
}
