import { isEnvAdmin } from "@/lib/admin/emails";

/** What someone can do in /admin: everything, look only, or nothing. */
export type AdminAccess = "admin" | "support";

/** ADMIN_EMAILS wins; otherwise the profile role, unless the account is suspended. */
export function accessFor(
  email: string | null | undefined,
  profile: { role?: string | null; suspended_at?: string | null } | null | undefined,
  envList = process.env.ADMIN_EMAILS,
): AdminAccess | null {
  if (isEnvAdmin(email, envList)) return "admin";
  if (!profile || profile.suspended_at) return null;
  if (profile.role === "admin") return "admin";
  if (profile.role === "support") return "support";
  return null;
}

/** Two-factor sign-in is on unless ADMIN_MFA_REQUIRED=false (local development). */
export function mfaRequired(raw = process.env.ADMIN_MFA_REQUIRED) {
  return (raw ?? "").trim().toLowerCase() !== "false";
}

/**
 * Where an admin stands with two-factor sign-in:
 * "ok" (session verified with a second factor, or 2FA not required),
 * "enroll" (no authenticator set up yet) or "verify" (set up, not used this session).
 */
export function mfaStep(
  required: boolean,
  aal: string | null | undefined,
  factors: { status?: string; factor_type?: string }[] | null | undefined,
): "ok" | "enroll" | "verify" {
  if (!required || aal === "aal2") return "ok";
  const verified = (factors ?? []).some((f) => f.status === "verified");
  return verified ? "verify" : "enroll";
}

function jwtClaims(token: string | null | undefined): Record<string, unknown> | null {
  try {
    const part = token?.split(".")[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The `aal` claim of a Supabase access token (already verified by getUser). */
export function aalFromJwt(token: string | null | undefined): string | null {
  const aal = jwtClaims(token)?.aal;
  return typeof aal === "string" ? aal : null;
}

/** The `session_id` claim: one per sign-in, kept across token refreshes. */
export function sessionIdFromJwt(token: string | null | undefined): string | null {
  const id = jwtClaims(token)?.session_id;
  return typeof id === "string" && id ? id : null;
}
