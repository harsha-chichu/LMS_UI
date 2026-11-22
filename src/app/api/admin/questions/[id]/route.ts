import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body, idParam } from "@/lib/admin/route";
import { questionUpdateSchema } from "@/lib/admin/schemas";

/** Edits a bank question, or retires / restores it. */
export const PATCH = adminRoute<RouteContext<"/api/admin/questions/[id]">>(async ({ admin, request, ctx }) => {
  const id = await idParam(ctx);
  const changes = await body(request, questionUpdateSchema);
  const { data, error } = await db().from("lms_questions").update(changes).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") throw new AdminError("another question already has that text", 409);
    throw new Error(error.message);
  }
  if (!data?.length) throw new AdminError("question not found", 404);
  const action = Object.keys(changes).length === 1 && changes.status ? `question.${changes.status === "retired" ? "retire" : "restore"}` : "question.update";
  await logAdminAction(admin.id, action, { type: "question", id }, { fields: Object.keys(changes) });
});
