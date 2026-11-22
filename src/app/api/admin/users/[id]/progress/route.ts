import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { adminRoute, check, idParam } from "@/lib/admin/route";

/**
 * Resets a user's progress: deletes their sessions. Question attempts and saved
 * questions cascade from the sessions. The account, profile and friends stay.
 */
export const DELETE = adminRoute<RouteContext<"/api/admin/users/[id]/progress">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const deleted = check(await db().from("lms_sessions").delete().eq("user_id", id).select("id"));
  await logAdminAction(admin.id, "user.reset_progress", { type: "user", id }, { sessions_deleted: deleted?.length ?? 0 });
  return { ok: true, sessionsDeleted: deleted?.length ?? 0 };
});
