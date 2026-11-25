import "server-only";
import type { User } from "@supabase/supabase-js";
import { logServerError } from "@/lib/admin/errors";
import { appUrl, emailConfigured, notifyAdmins, sendEmail } from "@/lib/admin/notify";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseWelcome, personalize, shouldEmailWelcome, signupAlert, welcomeTitle, type WelcomeSetting } from "@/lib/welcome";

/** The welcome note from lms_app_settings (defaults when unset). */
export async function getWelcomeSetting(): Promise<WelcomeSetting> {
  const { data, error } = await getSupabaseAdmin().from("lms_app_settings").select("value").eq("key", "welcome").maybeSingle();
  if (error) throw error;
  return parseWelcome(data?.value);
}

/**
 * Records the user's first visit. Returns `isNew` only for the one call that
 * created the row, so the alert and the email go out once even if the page
 * fires the request twice.
 */
export async function claimSignup(userId: string) {
  const db = getSupabaseAdmin();
  const { data: inserted, error } = await db
    .from("lms_signups")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("welcome_seen_at");
  if (error) throw error;
  if (inserted?.length) return { isNew: true, seenAt: null as string | null };
  const { data, error: readError } = await db.from("lms_signups").select("welcome_seen_at").eq("user_id", userId).maybeSingle();
  if (readError) throw readError;
  return { isNew: false, seenAt: (data?.welcome_seen_at as string | null) ?? null };
}

/** Admin alert + welcome email for a new user. Never throws. */
export async function announceSignup(user: User, welcome: WelcomeSetting) {
  const db = getSupabaseAdmin();
  try {
    const { data: profile } = await db.from("lms_profiles").select("name, email_opt_out").eq("id", user.id).maybeSingle();
    const name = (profile?.name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null;

    const alert = signupAlert({
      id: user.id,
      name,
      email: user.email,
      provider: user.app_metadata?.provider as string | undefined,
      adminUrl: appUrl(`/admin/users/${user.id}`),
    });
    const results = await notifyAdmins(alert.subject, alert.text);
    if (results.some((r) => r.ok)) {
      await db.from("lms_signups").update({ notified_at: new Date().toISOString() }).eq("user_id", user.id);
    }

    if (shouldEmailWelcome(welcome, { emailConfigured: emailConfigured(), optedOut: Boolean(profile?.email_opt_out), email: user.email })) {
      const text = `${personalize(welcome.body, name)}\n\n—\n${appUrl("/setup")}`;
      await sendEmail([user.email!], personalize(welcomeTitle(welcome), name), text);
      await db.from("lms_signups").update({ welcome_emailed_at: new Date().toISOString() }).eq("user_id", user.id);
    }
  } catch (err) {
    console.error("[welcome] announcing sign-up failed:", err);
    logServerError("welcome", err, { route: "/api/welcome", userId: user.id });
  }
}
