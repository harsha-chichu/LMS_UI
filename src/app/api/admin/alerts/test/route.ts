import { logAdminAction } from "@/lib/admin/audit";
import { appUrl, notifyAdmins } from "@/lib/admin/notify";
import { adminRoute } from "@/lib/admin/route";

/** Sends a test alert to every configured channel and reports what happened. */
export const POST = adminRoute(async ({ admin }) => {
  const results = await notifyAdmins("test alert", `If you can read this, alerts reach you.\n\n${appUrl("/admin/alerts")}`);
  await logAdminAction(admin.id, "alert.test", null, { results });
  return { ok: results.some((r) => r.ok), results };
});
