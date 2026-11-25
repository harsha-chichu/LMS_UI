/**
 * The welcome note new users see once after signing up (popup + email), and
 * the admin alert for a new sign-up. Pure helpers, so they can be unit-tested.
 * The message is stored in lms_app_settings under "welcome", edited on /admin/welcome.
 */

export type WelcomeSetting = {
  /** Show the popup and send the email. Off until the admin writes a message. */
  enabled: boolean;
  title: string;
  body: string;
  /** Also email the note (when email is set up and the user hasn't opted out). */
  sendEmail: boolean;
};

export const DEFAULT_WELCOME: WelcomeSetting = { enabled: false, title: "", body: "", sendEmail: true };

export const DEFAULT_WELCOME_TITLE = "Welcome!";

/** Stored value merged over the defaults, ignoring anything malformed. */
export function parseWelcome(value: unknown): WelcomeSetting {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof WelcomeSetting, unknown>>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_WELCOME.enabled,
    title: typeof v.title === "string" ? v.title : DEFAULT_WELCOME.title,
    body: typeof v.body === "string" ? v.body : DEFAULT_WELCOME.body,
    sendEmail: typeof v.sendEmail === "boolean" ? v.sendEmail : DEFAULT_WELCOME.sendEmail,
  };
}

/** A note is only sent when it's switched on and has something to say. */
export function welcomeReady(w: WelcomeSetting) {
  return w.enabled && w.body.trim().length > 0;
}

export function welcomeTitle(w: WelcomeSetting) {
  return w.title.trim() || DEFAULT_WELCOME_TITLE;
}

/** Whether the popup should open for a user. */
export function shouldShowWelcome(w: WelcomeSetting, seenAt: string | null) {
  return welcomeReady(w) && !seenAt;
}

/** Whether to email the note to a brand-new user. */
export function shouldEmailWelcome(w: WelcomeSetting, opts: { emailConfigured: boolean; optedOut: boolean; email: string | null | undefined }) {
  return welcomeReady(w) && w.sendEmail && opts.emailConfigured && !opts.optedOut && Boolean(opts.email);
}

/** "{name}" in the note becomes the user's first name (or "there"). */
export function personalize(text: string, name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  return text.replace(/\{name\}/gi, first);
}

const PROVIDERS: Record<string, string> = { email: "email + password", google: "Google" };

/** Subject and text of the admin alert for a new sign-up. */
export function signupAlert(u: { id: string; name: string | null | undefined; email: string | null | undefined; provider: string | null | undefined; adminUrl: string }) {
  const who = (u.name ?? "").trim() || u.email || u.id.slice(0, 8);
  const method = PROVIDERS[u.provider ?? ""] ?? u.provider ?? "unknown";
  return {
    subject: `New sign-up: ${who}`,
    text: [`Name: ${(u.name ?? "").trim() || "—"}`, `Email: ${u.email ?? "—"}`, `Signed up with: ${method}`, `Profile: ${u.adminUrl}`].join("\n"),
  };
}
