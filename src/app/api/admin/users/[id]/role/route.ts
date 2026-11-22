import { z } from "zod";
import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body, idParam, notSelf } from "@/lib/admin/route";

/** Grants or removes admin access stored on the profile (ADMIN_EMAILS admins stay admins regardless). */
export const POST = adminRoute<RouteContext<"/api/admin/users/[id]/role">>(async ({ admin, request, ctx }) => {
  const id = await idParam(ctx);
  notSelf(admin, id);
  const { role } = await body(request, z.object({ role: z.enum(["user", "admin"]) }));
  const { data, error } = await db().from("lms_profiles").update({ role }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new AdminError("user not found", 404);
  await logAdminAction(admin.id, "user.role", { type: "user", id }, { role });
});
