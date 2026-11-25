/** Text of the admin security alerts. Pure, so it can be unit-tested. */

export type RequestInfo = { ip: string | null; userAgent: string | null };

const UNKNOWN = "unknown";

export function adminSigninAlert(a: { email: string; access: string; at: Date; request: RequestInfo; auditUrl: string }) {
  return {
    subject: `Admin sign-in: ${a.email}`,
    text: [
      `${a.email} signed in to the admin dashboard with two-factor.`,
      `Access: ${a.access}`,
      `When: ${a.at.toISOString().replace("T", " ").slice(0, 16)} UTC`,
      `IP: ${a.request.ip ?? UNKNOWN}`,
      `Browser: ${a.request.userAgent?.slice(0, 200) ?? UNKNOWN}`,
      `Audit log: ${a.auditUrl}`,
      "",
      "If this wasn't you or someone you trust, change that account's password and remove its authenticator in Supabase → Authentication → Users.",
    ].join("\n"),
  };
}

export function factorAddedAlert(a: { email: string; factorName: string | null | undefined; createdAt: string | null | undefined; request: RequestInfo }) {
  return {
    subject: `New authenticator for admin ${a.email}`,
    text: [
      `An authenticator (two-factor) on admin account ${a.email} was seen by the app for the first time.`,
      `Name: ${a.factorName?.trim() || "—"}`,
      `Set up: ${a.createdAt ? `${a.createdAt.replace("T", " ").slice(0, 16)} UTC` : UNKNOWN}`,
      `IP: ${a.request.ip ?? UNKNOWN}`,
      `Browser: ${a.request.userAgent?.slice(0, 200) ?? UNKNOWN}`,
      "",
      "If this wasn't you, remove the factor in Supabase → Authentication → Users right away and change the password.",
    ].join("\n"),
  };
}

/** First address in x-forwarded-for (the client), else x-real-ip. */
export function clientIp(forwardedFor: string | null, realIp: string | null) {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || realIp?.trim() || null;
}
