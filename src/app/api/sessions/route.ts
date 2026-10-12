import { requireUser } from "@/lib/auth";
import { sessionConfigSchema } from "@/lib/llm/schemas";
import { pickQuestions } from "@/lib/questions/pick";
import { errorResponse } from "@/lib/sessions/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Preferences } from "@/types";

// Keeps one account from burning through the LLM budget.
const DAILY_SESSION_LIMIT = 30;

/** Start a session: pick questions from the bank and store an in-progress row. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const parsed = sessionConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("lms_sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_SESSION_LIMIT) {
      return Response.json(
        { error: `you've reached today's limit of ${DAILY_SESSION_LIMIT} sessions — come back tomorrow.` },
        { status: 429 },
      );
    }

    const config = parsed.data;
    const questions = await pickQuestions(user.id, config);

    // Users can't write sessions themselves (migration 0004), so the insert uses the service role.
    const { data, error } = await getSupabaseAdmin()
      .from("lms_sessions")
      .insert({ user_id: user.id, config, questions, results: [] })
      .select("id")
      .single();
    if (error) throw error;

    // Remember the last-used settings as the user's defaults, keeping other
    // preferences (e.g. the accent colour). Topics are remembered per domain.
    // (The row always exists: created on sign-up, or backfilled by the migration.)
    const { data: profile } = await supabase.from("lms_profiles").select("preferences").eq("id", user.id).maybeSingle();
    const prev = (profile?.preferences ?? {}) as Partial<Preferences>;
    const { topics = [], ...rest } = config;
    await supabase
      .from("lms_profiles")
      .update({
        preferences: { ...prev, ...rest, topicsByDomain: { ...prev.topicsByDomain, [config.domain]: topics } },
      })
      .eq("id", user.id);

    return Response.json({ id: data.id, questions });
  } catch (err) {
    return errorResponse(err);
  }
}
