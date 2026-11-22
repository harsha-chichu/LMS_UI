import "server-only";
import { parseAdminEmails } from "@/lib/admin/emails";

const RESEND_URL = "https://api.resend.com";

export type ChannelResult = { channel: "email" | "webhook"; ok: boolean; skipped?: string; error?: string };

/** Email sending is set up (Resend key + from address). */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Slack wants `text`, Discord wants `content`; anything else gets both. */
export function webhookPayload(url: string, text: string) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // fall through to the generic payload
  }
  if (host.endsWith("discord.com") || host.endsWith("discordapp.com")) return { content: text.slice(0, 1900) };
  if (host.endsWith("slack.com")) return { text };
  return { text, content: text.slice(0, 1900) };
}

/** Who gets alert emails: ALERT_EMAILS, else ADMIN_EMAILS. */
export function alertRecipients() {
  const list = parseAdminEmails(process.env.ALERT_EMAILS);
  return [...(list.size ? list : parseAdminEmails(process.env.ADMIN_EMAILS))];
}

/** One email through Resend. */
export async function sendEmail(to: string[], subject: string, text: string) {
  const res = await fetch(`${RESEND_URL}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

/**
 * Up to 100 separate emails in one Resend request (each recipient gets their
 * own message, so addresses aren't shared). Returns how many were accepted.
 */
export async function sendEmailBatch(messages: { to: string; subject: string; text: string }[]) {
  const res = await fetch(`${RESEND_URL}/emails/batch`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(messages.map((m) => ({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text }))),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return messages.length;
}

/**
 * Sends an admin alert to every configured channel: email (Resend, to
 * ALERT_EMAILS or ADMIN_EMAILS) and ALERT_WEBHOOK_URL (Slack or Discord).
 * Never throws; reports what happened per channel.
 */
export async function notifyAdmins(subject: string, text: string): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];

  const to = alertRecipients();
  if (!emailConfigured()) results.push({ channel: "email", ok: false, skipped: "RESEND_API_KEY or EMAIL_FROM not set" });
  else if (!to.length) results.push({ channel: "email", ok: false, skipped: "no ALERT_EMAILS or ADMIN_EMAILS" });
  else {
    try {
      await sendEmail(to, `[LMS] ${subject}`, text);
      results.push({ channel: "email", ok: true });
    } catch (err) {
      results.push({ channel: "email", ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const hook = process.env.ALERT_WEBHOOK_URL;
  if (!hook) results.push({ channel: "webhook", ok: false, skipped: "ALERT_WEBHOOK_URL not set" });
  else {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(webhookPayload(hook, `*${subject}*\n${text}`)),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      results.push({ channel: "webhook", ok: true });
    } catch (err) {
      results.push({ channel: "webhook", ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

/** Absolute link into the app, for emails and alerts. */
export function appUrl(path = "/") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}
