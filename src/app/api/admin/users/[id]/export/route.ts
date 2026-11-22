import { logAdminAction } from "@/lib/admin/audit";
import { db, rpc } from "@/lib/admin/data";
import { adminRoute, check, idParam } from "@/lib/admin/route";

/** Everything stored about one user, as a JSON download (data-access requests). */
export const GET = adminRoute<RouteContext<"/api/admin/users/[id]/export">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const supabase = db();
  const [account] = await rpc<{ email: string; last_sign_in_at: string | null; created_at: string }[]>("lms_admin_user_email", { p_id: id });
  const [profile, sessions, attempts, saved, friendships, feedback] = await Promise.all([
    supabase.from("lms_profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("lms_sessions").select("*").eq("user_id", id).order("created_at"),
    supabase.from("lms_question_attempts").select("*").eq("user_id", id).order("created_at"),
    supabase.from("lms_saved_questions").select("*").eq("user_id", id).order("created_at"),
    supabase.from("lms_friendships").select("*").or(`requester.eq.${id},addressee.eq.${id}`),
    supabase.from("lms_feedback").select("*").eq("user_id", id).order("created_at"),
  ]);
  const data = {
    exported_at: new Date().toISOString(),
    account: account ?? null,
    profile: check(profile),
    sessions: check(sessions),
    question_attempts: check(attempts),
    saved_questions: check(saved),
    friendships: check(friendships),
    feedback: check(feedback),
  };
  await logAdminAction(admin.id, "user.export", { type: "user", id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="user-${id}.json"`,
      "cache-control": "no-store",
    },
  });
});
