import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/sessions/store";

/** The ✕ on the session screen: close it without a report. */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/abandon">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await ctx.params;
    const { error } = await auth.supabase
      .from("lms_sessions")
      .update({ status: "abandoned" })
      .eq("id", id)
      .eq("status", "in_progress");
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
