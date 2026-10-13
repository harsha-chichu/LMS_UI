/**
 * Sign-up and password-reset rules, checked in the browser before calling
 * Supabase. Supabase enforces the same password rules server-side (Auth →
 * Sign In / Providers → Email), so keep the two in sync.
 */

const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULES = [
  { label: `at least ${MIN_PASSWORD_LENGTH} characters`, test: (p: string) => p.length >= MIN_PASSWORD_LENGTH },
  { label: "a lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "an uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "a number", test: (p: string) => /\d/.test(p) },
  { label: "a symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordProblem(password: string, email?: string): string | null {
  const missing = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
  if (missing.length) return `your password needs ${missing.join(", ")}.`;
  const name = email?.split("@")[0]?.toLowerCase();
  if (name && name.length >= 4 && password.toLowerCase().includes(name)) {
    return "don't use your email address in your password.";
  }
  return null;
}

// Something before the @, a domain with a dot, a 2+ letter TLD, no spaces.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailProblem(email: string): string | null {
  return EMAIL.test(normalizeEmail(email)) ? null : "enter a valid email address, like you@example.com.";
}
