import { logAdminAction } from "@/lib/admin/audit";
import { db, rpc } from "@/lib/admin/data";
import { adminRoute, idParam, notSelf } from "@/lib/admin/route";

/** Permanently deletes the account; everything it owns cascades from auth.users. */
export const DELETE = adminRoute<RouteContext<"/api/admin/users/[id]">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  notSelf(admin, id);
  const [who] = await rpc<{ email: string }[]>("lms_admin_user_email", { p_id: id });
  const { error } = await db().auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  await logAdminAction(admin.id, "user.delete", { type: "user", id }, { email: who?.email ?? null });
});
