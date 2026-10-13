import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { sessionConfigSchema } from "@/lib/llm/schemas";
import { pickQuestions } from "@/lib/questions/pick";
import { errorResponse } from "@/lib/sessions/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serverTimer } from "@/lib/timing";
import type { Preferences } from "@/types";

// Keeps one account from burning through the LLM budget.
const DAILY_SESSION_LIMIT = 30;

/**
 * Start a session: pick questions from the bank and store an in-progress row.
 * `{ retryOf: id }` instead of a config reuses a finished session's settings and questions.
 */
export async function POST(request: Request) {
  const timer = serverTimer();
  const auth = await requireUser();
  timer.mark("auth");
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const body: unknown = await request.json().catch(() => null);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const underLimit = () =>
    Promise.resolve(
      supabase.from("lms_sessions").select("id", { count: "exact", head: true }).gte("created_at", since),
    ).then(({ count }) => (count ?? 0) < DAILY_SESSION_LIMIT);
  const limitReached = () =>
    Response.json(
      { error: `you've reached today's limit of ${DAILY_SESSION_LIMIT} sessions — come back tomorrow.` },
      { status: 429 },
    );

  // "try again": same settings and questions as one of the user's finished sessions.
  const retryOf = (body as { retryOf?: unknown } | null)?.retryOf;
  if (typeof retryOf === "string") {
    try {
      // Friends can read each other's sessions, so filter on the owner too.
      const [allowed, { data: prev, error: loadError }] = await Promise.all([
        underLimit(),
        supabase
          .from("lms_sessions")
          .select("config, questions")
          .eq("id", retryOf)
          .eq("user_id", user.id)
          .eq("status", "completed")
          .maybeSingle(),
      ]);
      if (loadError) throw loadError;
      if (!prev) return Response.json({ error: "session not found" }, { status: 404 });
      if (!allowed) return limitReached();

      const { data, error } = await getSupabaseAdmin()
        .from("lms_sessions")
        .insert({ user_id: user.id, config: prev.config, questions: prev.questions, results: [] })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ id: data.id, config: prev.config, questions: prev.questions });
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
