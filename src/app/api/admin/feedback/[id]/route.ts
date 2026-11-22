import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body, idParam } from "@/lib/admin/route";
import { feedbackUpdateSchema } from "@/lib/admin/schemas";

/** Sets a feedback item's triage status and/or private note. */
export const PATCH = adminRoute<RouteContext<"/api/admin/feedback/[id]">>(async ({ admin, request, ctx }) => {
  const id = await idParam(ctx);
  const { status, adminNote } = await body(request, feedbackUpdateSchema);
  const changes: Record<string, unknown> = {};
  if (status) {
    changes.status = status;
    changes.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  }
  if (adminNote !== undefined) changes.admin_note = adminNote || null;
  if (!Object.keys(changes).length) throw new AdminError("nothing to change");
  const { data, error } = await db().from("lms_feedback").update(changes).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new AdminError("feedback not found", 404);
  await logAdminAction(admin.id, "feedback.update", { type: "feedback", id }, { status: status ?? null, note: adminNote !== undefined });
});
