import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body, check } from "@/lib/admin/route";
import { reviewSchema } from "@/lib/admin/schemas";
import type { QuestionResult, SessionConfig } from "@/types";

/** Records an admin's verdict on one scored answer (fair / too high / too low). */
export const POST = adminRoute(async ({ admin, request }) => {
  const { sessionId, questionIndex, verdict, note } = await body(request, reviewSchema);
  const session = check(
    await db().from("lms_sessions").select("config, results").eq("id", sessionId).maybeSingle(),
  ) as { config: SessionConfig; results: QuestionResult[] } | null;
  const r = session?.results?.[questionIndex];
  if (!session || !r?.evaluation) throw new AdminError("that answer has no score to review", 404);
  check(
    await db()
      .from("lms_score_reviews")
      .upsert(
        {
          session_id: sessionId,
          question_index: questionIndex,
          verdict,
          note: note || null,
          domain: session.config.domain,
          engine: r.scoring?.engine ?? "unknown",
          score: r.evaluation.score,
          admin_id: admin.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: "session_id,question_index" },
      ),
  );
  await logAdminAction(admin.id, "score.review", { type: "session", id: sessionId }, { question_index: questionIndex, verdict });
});
