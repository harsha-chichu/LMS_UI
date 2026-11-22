import { recordUsage } from "@/lib/admin/usage";
import { requireUser } from "@/lib/auth";
import { rateLimited, takeRateLimit } from "@/lib/rate-limit";

const GRANT_URL = "https://api.deepgram.com/v1/auth/grant";

/**
 * Mints a short-lived Deepgram token so the browser can open a live
 * transcription socket without ever seeing DEEPGRAM_API_KEY. The token only
 * has to be valid when the socket opens; the connection outlives it.
 * 404 when Deepgram isn't configured: the client falls back to the browser's
 * own speech recognition.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return Response.json({ error: "live transcription isn't set up" }, { status: 404 });

  let started = 0;
  try {
    // Each token opens a socket billed to our Deepgram account, so cap them per user.
    // A refusal makes the client fall back to the browser's own speech recognition.
    if (!(await takeRateLimit(auth.user.id, "speechToken"))) return rateLimited();
    started = Date.now();
    const res = await fetch(GRANT_URL, {
      method: "POST",
      headers: { authorization: `Token ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`deepgram grant failed: ${res.status}`);
    const { access_token } = (await res.json()) as { access_token?: string };
    if (!access_token) throw new Error("deepgram grant returned no token");
    recordUsage({ kind: "deepgram", operation: "grant", ok: true, latencyMs: Date.now() - started, userId: auth.user.id });
    return Response.json({ token: access_token }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error(err);
    if (started) {
      recordUsage({
        kind: "deepgram",
        operation: "grant",
        ok: false,
        latencyMs: Date.now() - started,
        userId: auth.user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return Response.json({ error: "couldn't reach the transcription service" }, { status: 502 });
  }
}
