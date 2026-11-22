import { z } from "zod";
import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { adminRoute, body, check, idParam, notSelf } from "@/lib/admin/route";

type Ctx = RouteContext<"/api/admin/users/[id]/suspend">;

/**
 * Suspends a user: marks the profile and bans the auth user, which ends their
 * sessions (getUser fails for banned users) and blocks signing in again.
 */
export const POST = adminRoute<Ctx>(async ({ admin, request, ctx }) => {
  const id = await idParam(ctx);
  notSelf(admin, id);
  const { reason } = await body(request, z.object({ reason: z.string().trim().max(300).optional() }));
  const { error } = await db().auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (error) throw new Error(error.message);
  check(
    await db()
      .from("lms_profiles")
      .update({ suspended_at: new Date().toISOString(), suspended_reason: reason || null })
      .eq("id", id),
  );
  await logAdminAction(admin.id, "user.suspend", { type: "user", id }, { reason: reason ?? null });
});

export const DELETE = adminRoute<Ctx>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const { error } = await db().auth.admin.updateUserById(id, { ban_duration: "none" });
  if (error) throw new Error(error.message);
  check(await db().from("lms_profiles").update({ suspended_at: null, suspended_reason: null }).eq("id", id));
  await logAdminAction(admin.id, "user.unsuspend", { type: "user", id });
});
