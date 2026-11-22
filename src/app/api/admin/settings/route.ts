import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { adminRoute, body, check } from "@/lib/admin/route";
import { settingSchema } from "@/lib/admin/schemas";

/** Turns an app-wide switch on or off (maintenance banner, pause new sessions). */
export const POST = adminRoute(async ({ admin, request }) => {
  const { key, enabled, message } = await body(request, settingSchema);
  check(
    await db()
      .from("lms_app_settings")
      .upsert({ key, value: { enabled, message }, updated_by: admin.id, updated_at: new Date().toISOString() }),
  );
  await logAdminAction(admin.id, "setting.update", { type: "setting", id: key }, { enabled, message });
});
