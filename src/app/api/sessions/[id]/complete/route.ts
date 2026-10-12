import { requireUser } from "@/lib/auth";
import { finalize } from "@/lib/sessions/engine";
import { errorResponse, loadSession } from "@/lib/sessions/store";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Wait for scoring to settle, write the report and close the session. */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/complete">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await ctx.params;
    const row = await loadSession(auth.supabase, id);
    const { results, report } = await finalize(row);

    const { error } = await getSupabaseAdmin()
      .from("lms_sessions")
      .update({
        results,
        report,
        total: report.total,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .eq("status", "in_progress");
    if (error) throw error;

    return Response.json({ id });
  } catch (err) {
    return errorResponse(err);
  }
}
