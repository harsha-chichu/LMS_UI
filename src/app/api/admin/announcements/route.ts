import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body } from "@/lib/admin/route";
import { announcementSchema } from "@/lib/admin/schemas";

/** Publishes a banner for all signed-in users. */
export const POST = adminRoute(async ({ admin, request }) => {
  const { message, level, endsAt } = await body(request, announcementSchema);
  if (endsAt && new Date(endsAt).getTime() <= Date.now()) throw new AdminError("the end time is in the past");
  const { data: row, error } = await db()
    .from("lms_announcements")
    .insert({ message, level, ends_at: endsAt, created_by: admin.id })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "insert failed");
  await logAdminAction(admin.id, "announcement.create", { type: "announcement", id: row.id }, { message, level, ends_at: endsAt });
  return { ok: true, id: row.id };
});
