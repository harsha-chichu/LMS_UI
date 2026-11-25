import "server-only";
import type { User } from "@supabase/supabase-js";
import type { AdminAccess } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { logServerError } from "@/lib/admin/errors";
import { adminSigninAlert, factorAddedAlert, type RequestInfo } from "@/lib/admin/mfa-alert-text";
import { appUrl, notifyAdmins } from "@/lib/admin/notify";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Records a session or factor; true only the first time it's seen. */
async function firstSeen(kind: "session" | "factor", ref: string, userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("lms_admin_seen")
    .upsert({ kind, ref, user_id: userId }, { onConflict: "kind,ref", ignoreDuplicates: true })
    .select("ref");
  if (error) throw error;
  return Boolean(data?.length);
}

/**
 * Alerts admins about a new admin sign-in (a two-factor session seen for the
 * first time) and about authenticators seen for the first time. Runs from the
 * admin guard, which every admin page and API passes through. Never throws.
 */
export async function recordAdminSecurityEvents(user: User, access: AdminAccess, sessionId: string | null, request: RequestInfo) {
  const email = user.email ?? user.id;
  try {
    for (const f of user.factors ?? []) {
      if (f.status !== "verified") continue;
      if (!(await firstSeen("factor", f.id, user.id))) continue;
      const alert = factorAddedAlert({ email, factorName: f.friendly_name, createdAt: f.created_at, request });
      await notifyAdmins(alert.subject, alert.text);
      await logAdminAction(user.id, "admin.mfa_factor_added", { type: "user", id: user.id }, { factor_id: f.id, name: f.friendly_name ?? null, ...request });
    }

    if (sessionId && (await firstSeen("session", sessionId, user.id))) {
      const alert = adminSigninAlert({ email, access, at: new Date(), request, auditUrl: appUrl("/admin/audit") });
      await notifyAdmins(alert.subject, alert.text);
      await logAdminAction(user.id, "admin.signin", { type: "user", id: user.id }, { access, ...request });
    }
  } catch (err) {
    console.error("[admin] security alert failed:", err);
    logServerError("admin-security", err, { userId: user.id });
  }
}
