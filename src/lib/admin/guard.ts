import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { type AdminAccess, aalFromJwt, accessFor, mfaRequired, mfaStep } from "@/lib/admin/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export type { AdminAccess } from "@/lib/admin/access";

/**
 * Admin access: anyone in ADMIN_EMAILS, or a profile with role 'admin'
 * (everything) or 'support' (read-only). Suspended accounts get nothing.
 */
export async function getAdminAccess(user: Pick<User, "id" | "email">): Promise<AdminAccess | null> {
  const env = accessFor(user.email, null);
  if (env) return env;
  const { data, error } = await getSupabaseAdmin()
    .from("lms_profiles")
    .select("role, suspended_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[admin] role lookup failed:", error.message);
    return null;
  }
  return accessFor(user.email, data);
}

/** True for admins and support (drives the link in settings). */
export async function isAdmin(user: Pick<User, "id" | "email">) {
  return (await getAdminAccess(user)) !== null;
}

/** The verified user, their access and where they stand with two-factor sign-in. */
async function current() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  // getUser() just verified this token with Supabase, so reading its aal claim is safe.
  const { data: s } = await supabase.auth.getSession();
  const step = mfaStep(mfaRequired(), aalFromJwt(s.session?.access_token), data.user.factors);
  const access = await getAdminAccess(data.user);
  return { user: data.user, access, step };
}

type AdminOk = { ok: true; user: User; access: AdminAccess };
type AdminDenied = { ok: false; response: Response };

/**
 * Route-handler guard. Writes (the default) need full admin access; pass
 * `{ write: false }` for read-only endpoints such as exports, which support may use.
 */
export async function requireAdmin({ write = true }: { write?: boolean } = {}): Promise<AdminOk | AdminDenied> {
  const me = await current();
  if (!me) return { ok: false, response: Response.json({ error: "sign in required" }, { status: 401 }) };
  if (!me.access) return { ok: false, response: Response.json({ error: "forbidden" }, { status: 403 }) };
  if (me.step !== "ok") {
    return { ok: false, response: Response.json({ error: "two-factor sign-in required — open /admin-mfa" }, { status: 403 }) };
  }
  if (write && me.access !== "admin") {
    return { ok: false, response: Response.json({ error: "your access is read-only" }, { status: 403 }) };
  }
  return { ok: true, user: me.user, access: me.access };
}

/**
 * Server-component guard, run by the admin layout AND by every page's data
 * component (a layout alone doesn't protect its pages). Signed out → /login;
 * no access → back to the app; 2FA not done → /admin-mfa. Redirects, not
 * notFound(): the check runs inside a streamed Suspense boundary, where a
 * redirect is the reliable way out. Deduplicated per request.
 */
export const requireAdminPage = cache(async (): Promise<{ user: User; access: AdminAccess }> => {
  // Request-time only: never part of a prerendered shell.
  await connection();
  const me = await current();
  if (!me) redirect("/login?next=/admin");
  if (!me.access) redirect("/setup");
  if (me.step !== "ok") redirect("/admin-mfa");
  return { user: me.user, access: me.access };
});

/**
 * For /admin-mfa itself: signed in with admin access, whatever the 2FA state.
 */
export const requireAdminForMfa = cache(async () => {
  await connection();
  const me = await current();
  if (!me) redirect("/login?next=/admin-mfa");
  if (!me.access) redirect("/setup");
  return me;
});
