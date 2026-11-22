import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isEnvAdmin } from "@/lib/admin/emails";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * An admin is anyone listed in ADMIN_EMAILS, or whose profile has role = 'admin'
 * (set from /admin/users). The env list is how the first admin gets in.
 */
export async function isAdmin(user: Pick<User, "id" | "email">): Promise<boolean> {
  if (isEnvAdmin(user.email)) return true;
  const { data, error } = await getSupabaseAdmin()
    .from("lms_profiles")
    .select("role, suspended_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[admin] role lookup failed:", error.message);
    return false;
  }
  return data?.role === "admin" && !data.suspended_at;
}

type AdminOk = { ok: true; user: User };
type AdminDenied = { ok: false; response: Response };

/** Route-handler guard: the verified admin, or a 401 / 403. */
export async function requireAdmin(): Promise<AdminOk | AdminDenied> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: Response.json({ error: "sign in required" }, { status: 401 }) };
  }
  if (!(await isAdmin(data.user))) {
    return { ok: false, response: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, user: data.user };
}

/**
 * Server-component guard, run by the admin layout AND by every page's data
 * component (a layout alone doesn't protect its pages). Signed out → /login;
 * signed in but not an admin → back to the app. (A redirect, not notFound():
 * the check runs inside a streamed Suspense boundary, where a redirect is the
 * reliable way to leave the page.) Deduplicated per request.
 */
export const requireAdminPage = cache(async (): Promise<User> => {
  // Request-time only: never part of a prerendered shell.
  await connection();
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/admin");
  if (!(await isAdmin(data.user))) redirect("/setup");
  return data.user;
});
