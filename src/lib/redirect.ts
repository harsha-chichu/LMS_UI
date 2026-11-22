const FALLBACK = "/setup";
const BASE = "http://localhost";

/**
 * Where to send the user after signing in: a path on this site, or /setup.
 * Rejects anything a browser could resolve to another origin, including
 * `//evil.com`, `/\evil.com` (browsers read `\` as `/`), and control characters
 * that browsers strip before parsing.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) return FALLBACK;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return FALLBACK;
    return url.pathname + url.search + url.hash;
  } catch {
    return FALLBACK;
  }
}
