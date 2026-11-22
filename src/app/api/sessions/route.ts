import { after } from "next/server";
import { SESSION_BLOCK_KEYS, activeBudget, newSessionBlock } from "@/lib/admin/session-block";
import { getSpendToday } from "@/lib/admin/spend";
import { requireUser } from "@/lib/auth";
import { practiceRequestSchema, savedTestRequestSchema, sessionConfigSchema } from "@/lib/llm/schemas";
import { type Attempt, PRACTICE_COUNT, unsolvedQuestionIds } from "@/lib/mastery";
import { pickQuestions } from "@/lib/questions/pick";
import { errorResponse } from "@/lib/sessions/store";
import { limitFor, rateLimited, takeRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serverTimer } from "@/lib/timing";
import type { Preferences, Question, SessionConfig } from "@/types";

/**
 * Start a session: pick questions from the bank and store an in-progress row.
 * `{ retryOf: id }` instead of a config reuses a finished session's settings and questions;
 * `{ practice: { domain, difficulty }, mode }` builds one from the user's unsolved questions;
 * `{ saved: [ids], mode }` builds one from up to 10 saved questions at the same level.
 */
export async function POST(request: Request) {
  const timer = serverTimer();
  const auth = await requireUser();
  timer.mark("auth");
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  // Maintenance mode, "pause new sessions" and the daily AI budget (all set from
  // /admin/system) stop new sessions; the rest of the app keeps working.
  const { data: settings } = await supabase.from("lms_app_settings").select("key, value").in("key", SESSION_BLOCK_KEYS);
  // Spend is only looked up when a budget is on; if that lookup fails, don't block.
  const spent = activeBudget(settings) ? await getSpendToday().catch(() => null) : null;
  const blocked = newSessionBlock(settings, spent);
  if (blocked) return Response.json({ error: blocked }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  // Taken atomically in Postgres, so parallel requests can't all slip under the limit.
  // The retry / practice / saved paths take it only once the request is known to be valid.
  const underLimit = () => takeRateLimit(user.id, "session");
  const limitReached = async () =>
    rateLimited(`you've reached today's limit of ${await limitFor(user.id, "session")} sessions — come back tomorrow.`);

  // "try again": same settings and questions as one of the user's finished sessions.
  const retryOf = (body as { retryOf?: unknown } | null)?.retryOf;
  if (typeof retryOf === "string") {
    try {
      // Friends can read each other's sessions, so filter on the owner too.
      const { data: prev, error: loadError } = await supabase
        .from("lms_sessions")
        .select("config, questions")
        .eq("id", retryOf)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .maybeSingle();
      if (loadError) throw loadError;
      if (!prev) return Response.json({ error: "session not found" }, { status: 404 });
      if (!(await underLimit())) return limitReached();

      // Remember which session this repeats, so its report can show before / after.
      const config: SessionConfig = { ...(prev.config as SessionConfig), retryOf };
      const { data, error } = await getSupabaseAdmin()
        .from("lms_sessions")
        .insert({ user_id: user.id, config, questions: prev.questions, results: [] })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ id: data.id, config, questions: prev.questions });
    } catch (err) {
      return errorResponse(err);
    }
  }

  // "practise unsolved": questions the user has tried at this level but not solved yet.
  if (body && typeof body === "object" && "practice" in body) {
    const practice = practiceRequestSchema.safeParse(body);
    if (!practice.success) return Response.json({ error: "invalid request" }, { status: 400 });
    const { practice: level, mode } = practice.data;
    try {
      const { data: attempts, error: attemptsError } = await supabase
        .from("lms_question_attempts")
        .select("question_id, session_id, domain, difficulty, topics, score, skipped, created_at")
        .eq("user_id", user.id)
        .eq("domain", level.domain)
        .eq("difficulty", level.difficulty)
        .limit(2000);
      if (attemptsError) throw attemptsError;

      const ids = unsolvedQuestionIds((attempts ?? []) as Attempt[], level.domain, level.difficulty);
      // The bank is server-only, so read it with the service role; skip retired questions.
      const { data: bank, error: bankError } = ids.length
        ? await getSupabaseAdmin().from("lms_questions").select("id, text, topics").in("id", ids).eq("status", "active")
        : { data: [], error: null };
      if (bankError) throw bankError;
      const byId = new Map((bank ?? []).map((q) => [q.id as string, q]));
      const picked = ids.filter((id) => byId.has(id)).slice(0, PRACTICE_COUNT);
      if (!picked.length) {
        return Response.json({ error: "nothing left to practise here — every question you tried is solved." }, { status: 404 });
      }
      if (!(await underLimit())) return limitReached();

      const questions: Question[] = picked.map((id, i) => {
        const q = byId.get(id)!;
        return { id: `q${i + 1}`, text: q.text as string, bankId: id, topics: (q.topics as string[]) ?? [] };
      });
      const config: SessionConfig = {
        domain: level.domain,
        difficulty: level.difficulty,
        count: questions.length,
        mode,
        practice: true,
      };
      const { data, error } = await getSupabaseAdmin()
        .from("lms_sessions")
        .insert({ user_id: user.id, config, questions, results: [] })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ id: data.id, config, questions });
    } catch (err) {
      return errorResponse(err);
    }
  }

  // "test on saved": questions the user picked from their saved list, all at one level.
  if (body && typeof body === "object" && "saved" in body) {
    const request = savedTestRequestSchema.safeParse(body);
    if (!request.success) return Response.json({ error: "invalid request" }, { status: 400 });
    const { saved: ids, mode } = request.data;
    try {
      const { data: rows, error: savedError } = await supabase
        .from("lms_saved_questions")
        .select("id, session_id, question_index, text, domain, difficulty")
        .eq("user_id", user.id)
        .in("id", ids);
      if (savedError) throw savedError;

      const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
      const picked = ids.map((id) => byId.get(id)).filter((r) => r !== undefined);
      if (!picked.length) return Response.json({ error: "those saved questions are gone." }, { status: 404 });
      const { domain, difficulty } = picked[0];
      if (picked.some((r) => r.domain !== domain || r.difficulty !== difficulty)) {
        return Response.json({ error: "pick questions from one domain and difficulty." }, { status: 400 });
      }
      if (!(await underLimit())) return limitReached();

      // The source sessions keep each question's bank id, so attempts still count towards progress.
      const { data: sources, error: sourcesError } = await supabase
        .from("lms_sessions")
        .select("id, questions")
        .eq("user_id", user.id)
        .in("id", [...new Set(picked.map((r) => r.session_id as string))]);
      if (sourcesError) throw sourcesError;
      const sourceQuestions = new Map((sources ?? []).map((s) => [s.id as string, (s.questions ?? []) as Question[]]));

      const questions: Question[] = picked.map((r, i) => {
        const source = sourceQuestions.get(r.session_id as string)?.[r.question_index as number];
        return {
          id: `q${i + 1}`,
          text: r.text as string,
          ...(source?.bankId ? { bankId: source.bankId } : {}),
          topics: source?.topics ?? [],
        };
      });
      const config: SessionConfig = {
        domain: domain as SessionConfig["domain"],
        difficulty: difficulty as SessionConfig["difficulty"],
        count: questions.length,
        mode,
        saved: true,
      };
      const { data, error } = await getSupabaseAdmin()
        .from("lms_sessions")
        .insert({ user_id: user.id, config, questions, results: [] })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ id: data.id, config, questions });
    } catch (err) {
      return errorResponse(err);
    }
  }

  const parsed = sessionConfigSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });

  try {
    const config = parsed.data;
    const underLimitNow = underLimit();

    // The limit check and the bank lookup run side by side; generating questions
    // (the expensive part) still waits for the limit.
    const [allowed, questions] = await Promise.all([
      underLimitNow,
      pickQuestions(user.id, config, { timer, canGenerate: underLimitNow }),
    ]);
    if (!allowed) return limitReached();

    // Users can't write sessions themselves (migration 0004), so the insert uses the service role.
    const { data, error } = await getSupabaseAdmin()
      .from("lms_sessions")
      .insert({ user_id: user.id, config, questions, results: [] })
      .select("id")
      .single();
    if (error) throw error;
    timer.mark("insert");

    // Remember the last-used settings as the user's defaults, keeping other
    // preferences (e.g. the accent colour). Topics are remembered per domain.
    // Not needed for the session itself, so it runs after the response.
    // (The row always exists: created on sign-up, or backfilled by the migration.)
    after(async () => {
      const db = getSupabaseAdmin();
      const { data: profile } = await db.from("lms_profiles").select("preferences").eq("id", user.id).maybeSingle();
      const prev = (profile?.preferences ?? {}) as Partial<Preferences>;
      const { topics = [], ...rest } = config;
      const { error } = await db
        .from("lms_profiles")
        .update({
          preferences: { ...prev, ...rest, topicsByDomain: { ...prev.topicsByDomain, [config.domain]: topics } },
        })
        .eq("id", user.id);
      if (error) console.error("[sessions] saving preferences failed:", error.message);
    });

    return Response.json({ id: data.id, questions }, { headers: { "Server-Timing": timer.header() } });
  } catch (err) {
    return errorResponse(err);
  }
}
