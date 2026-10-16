import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const feedbackSchema = z.object({
  category: z.enum(["idea", "problem", "praise", "other"]),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(1).max(5000),
  followUpConsent: z.boolean(),
  sessionId: z.uuid().optional(),
});

/** Stores private product feedback. Rows are only reviewable in Supabase. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid feedback" }, { status: 400 });

  try {
    const { category, rating, message, followUpConsent, sessionId } = parsed.data;
    const db = getSupabaseAdmin();

    if (sessionId) {
      const { data, error } = await db
        .from("lms_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return Response.json({ error: "session not found" }, { status: 404 });
    }

    const { error } = await db.from("lms_feedback").insert({
      user_id: auth.user.id,
      session_id: sessionId ?? null,
      category,
      rating,
      message,
      follow_up_consent: followUpConsent,
    });
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[feedback] saving failed:", err);
    return Response.json({ error: "couldn't send feedback" }, { status: 500 });
  }
}
