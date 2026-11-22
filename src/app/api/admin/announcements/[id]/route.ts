import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, check, idParam } from "@/lib/admin/route";

/** Ends an announcement now (kept for history). */
export const DELETE = adminRoute<RouteContext<"/api/admin/announcements/[id]">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const rows = check(await db().from("lms_announcements").update({ active: false }).eq("id", id).select("id"));
  if (!rows?.length) throw new AdminError("announcement not found", 404);
  await logAdminAction(admin.id, "announcement.end", { type: "announcement", id });
});
