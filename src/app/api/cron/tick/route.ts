import { timingSafeEqual } from "node:crypto";
import { runHealthCheck } from "@/lib/admin/alerts";
import { logServerError } from "@/lib/admin/errors";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * The scheduled health check (alerts, daily budget). Called every 10 minutes by
 * Supabase pg_cron (see migration 0015) with `Authorization: Bearer CRON_SECRET`.
 */
async function tick(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await runHealthCheck(), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[cron] health check failed:", err);
    logServerError("cron", err, { route: "/api/cron/tick" });
    return Response.json({ error: "health check failed" }, { status: 500 });
  }
}

export const GET = tick;
export const POST = tick;
