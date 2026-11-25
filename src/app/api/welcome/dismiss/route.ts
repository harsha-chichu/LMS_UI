import { logServerError } from "@/lib/admin/errors";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** The user closed the welcome popup: don't show it again. */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { error } = await getSupabaseAdmin()
    .from("lms_signups")
    .update({ welcome_seen_at: new Date().toISOString() })
    .eq("user_id", auth.user.id);
  if (error) {
    logServerError("welcome", error, { route: "/api/welcome/dismiss", userId: auth.user.id });
    return Response.json({ error: "couldn't save" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
