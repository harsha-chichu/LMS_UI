import { requireUser } from "@/lib/auth";

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

  try {
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
    return Response.json({ token: access_token }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "couldn't reach the transcription service" }, { status: 502 });
  }
}
