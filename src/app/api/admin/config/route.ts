import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { adminRoute, body, check } from "@/lib/admin/route";
import { configSchema } from "@/lib/admin/schemas";
import { clearLimitCache } from "@/lib/rate-limit";

/** Saves alert thresholds, the daily AI budget or rate limits. */
export const POST = adminRoute(async ({ admin, request }) => {
  const { key, value } = await body(request, configSchema);
  check(
    await db()
      .from("lms_app_settings")
      .upsert({ key, value, updated_by: admin.id, updated_at: new Date().toISOString() }),
  );
  if (key === "rate_limits") clearLimitCache();
  await logAdminAction(admin.id, "setting.update", { type: "setting", id: key }, value);
});
