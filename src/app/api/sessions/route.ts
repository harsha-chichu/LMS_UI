import { requireUser } from "@/lib/auth";
import { generateQuestions } from "@/lib/llm/service";
import { sessionConfigSchema } from "@/lib/llm/schemas";
import { errorResponse } from "@/lib/sessions/store";

// Keeps one account from burning through the LLM budget.
const DAILY_SESSION_LIMIT = 30;

/** Start a session: generate questions and store an in-progress row. */
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
    const { data: texts } = await generateQuestions(config.domain, config.difficulty, config.count);
    const questions = texts.map((text, i) => ({ id: `q${i + 1}`, text }));

    const { data, error } = await supabase
      .from("lms_sessions")
      .insert({ user_id: user.id, config, questions, results: [] })
      .select("id")
      .single();
    if (error) throw error;

    // Remember the last-used settings as the user's defaults, keeping other
    // preferences (e.g. the accent colour).
    // (The row always exists: created on sign-up, or backfilled by the migration.)
    const { data: profile } = await supabase.from("lms_profiles").select("preferences").eq("id", user.id).maybeSingle();
    await supabase
      .from("lms_profiles")
      .update({ preferences: { ...(profile?.preferences ?? {}), ...config } })
      .eq("id", user.id);

    return Response.json({ id: data.id, questions });
  } catch (err) {
    return errorResponse(err);
  }
}
