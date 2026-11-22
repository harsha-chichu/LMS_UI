import { logAdminAction } from "@/lib/admin/audit";
import { db, rpc } from "@/lib/admin/data";
import { appUrl, emailConfigured, sendEmailBatch } from "@/lib/admin/notify";
import { AdminError, adminRoute, body } from "@/lib/admin/route";
import { emailSchema } from "@/lib/admin/schemas";

export const maxDuration = 300;

/** Hard cap per send, so a mistake can't mail the whole user base twice over. */
const MAX_RECIPIENTS = 2000;

const AUDIENCE_LABEL = {
  contact_ok: "said ok to contact in feedback",
  inactive: "inactive",
  all: "all users",
  one: "one user",
} as const;

/**
 * Emails users through Resend. A dry run (the default) returns the recipient
 * count and a few addresses; sending is a second call with dryRun: false.
 * Opted-out users are skipped (except a direct message to one user), and every
 * email ends with a line on how to turn them off.
 */
export const POST = adminRoute(async ({ admin, request }) => {
  const { audience, days, userId, subject, body: text, dryRun } = await body(request, emailSchema);
  if (audience === "one" && !userId) throw new AdminError("pick the user to email");

  const recipients = await rpc<{ id: string; email: string; name: string }[]>("lms_admin_email_audience", {
    p_audience: audience,
    p_days: days,
    p_user: userId ?? null,
  });
  if (recipients.length > MAX_RECIPIENTS) {
    throw new AdminError(`${recipients.length} recipients is over the ${MAX_RECIPIENTS} limit per send — narrow the audience`);
  }
  if (dryRun) {
    return { ok: true, dryRun: true, recipients: recipients.length, sample: recipients.slice(0, 5).map((r) => r.email), configured: emailConfigured() };
  }
  if (!emailConfigured()) throw new AdminError("email isn't set up — add RESEND_API_KEY and EMAIL_FROM", 503);
  if (!recipients.length) throw new AdminError("nobody matches this audience");

  const footer =
    audience === "one"
      ? ""
      : `\n\n—\nYou're getting this because you have an LMS account. To stop these emails, turn off "product emails" in settings: ${appUrl("/settings")}`;
  const messages = recipients.map((r) => ({
    to: r.email,
    subject,
    text: `${r.name ? `Hi ${r.name.split(" ")[0]},\n\n` : ""}${text}${footer}`,
  }));

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      sent += await sendEmailBatch(batch);
    } catch (err) {
      failed += batch.length;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  await db().from("lms_email_log").insert({
    admin_id: admin.id,
    audience: audience === "inactive" ? `inactive ${days}d` : audience === "one" ? `one: ${recipients[0]?.email}` : audience,
    subject,
    recipients: recipients.length,
    sent,
    failed,
  });
  await logAdminAction(admin.id, "email.send", null, { audience: AUDIENCE_LABEL[audience], subject, recipients: recipients.length, sent, failed });
  return { ok: failed === 0, dryRun: false, recipients: recipients.length, sent, failed, errors: errors.slice(0, 3) };
});
