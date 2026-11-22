import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, check, idParam } from "@/lib/admin/route";

/** Closes a stuck in-progress session without a report. */
export const POST = adminRoute<RouteContext<"/api/admin/sessions/[id]/abandon">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const rows = check(await db().from("lms_sessions").update({ status: "abandoned" }).eq("id", id).eq("status", "in_progress").select("user_id"));
  if (!rows?.length) throw new AdminError("session isn't in progress", 409);
  await logAdminAction(admin.id, "session.abandon", { type: "session", id }, { user_id: rows[0].user_id });
});
