import { z } from "zod";
import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { adminRoute, body, check, idParam } from "@/lib/admin/route";
import { limitOverrideSchema } from "@/lib/admin/schemas";
import { clearLimitCache } from "@/lib/rate-limit";

type Ctx = RouteContext<"/api/admin/users/[id]/limits">;

/** Gives one user a different limit for a while (e.g. a demo account). */
export const POST = adminRoute<Ctx>(async ({ admin, request, ctx }) => {
  const id = await idParam(ctx);
  const { bucket, maxCount, hours } = await body(request, limitOverrideSchema);
  const expires = new Date(Date.now() + hours * 3_600_000).toISOString();
  check(
    await db()
      .from("lms_rate_limit_overrides")
      .upsert({ user_id: id, bucket, max_count: maxCount, expires_at: expires, created_by: admin.id }),
  );
  clearLimitCache();
  await logAdminAction(admin.id, "user.limit_override", { type: "user", id }, { bucket, max_count: maxCount, expires_at: expires });
});

/** Removes an override; the normal limit applies again. */
export const DELETE = adminRoute<Ctx>(async ({ admin, request, ctx }) => {
  const id = await idParam(ctx);
  const { bucket } = await body(request, z.object({ bucket: z.string().min(1).max(40) }));
  check(await db().from("lms_rate_limit_overrides").delete().eq("user_id", id).eq("bucket", bucket));
  clearLimitCache();
  await logAdminAction(admin.id, "user.limit_override_removed", { type: "user", id }, { bucket });
});
