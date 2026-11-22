import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { missingSuggestionIndexes, patchReportSuggestion, withSuggestion } from "@/lib/admin/rescore";
import { AdminError, adminRoute, check, idParam } from "@/lib/admin/route";
import { rescoreAnswer } from "@/lib/sessions/engine";
import type { SessionRow } from "@/types";

// Up to 90s per answer with the eval agent (in parallel), Claude as backup.
export const maxDuration = 300;

/**
 * Fills in suggested answers that a finished session's scored answers are
 * missing (the scorer sometimes left them out, typically after follow-ups).
 * The answers are evaluated again only to get a suggestion: the stored score,
 * feedback and report total don't change; just the suggested answer and key
 * points are added, in the results and in the stored report.
 */
export const POST = adminRoute<RouteContext<"/api/admin/sessions/[id]/suggest">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const supabase = db();
  const row = check(await supabase.from("lms_sessions").select("*").eq("id", id).maybeSingle()) as SessionRow | null;
  if (!row) throw new AdminError("session not found", 404);
  if (row.status !== "completed") throw new AdminError("only finished sessions have a report to fill in");

  const targets = missingSuggestionIndexes(row.results ?? []);
  if (!targets.length) throw new AdminError("every scored answer in this session already has a suggested answer");

  const results = structuredClone(row.results);
  let report = row.report;
  const errors: string[] = [];
  const filled: number[] = [];

  // Side by side, so several answers don't outlast the request.
  const fresh = await Promise.all(targets.map((i) => rescoreAnswer(row.config, results[i], row.user_id)));
  targets.forEach((i, k) => {
    const merged = withSuggestion(results[i], fresh[k]);
    if (merged) {
      results[i] = merged;
      if (report) report = patchReportSuggestion(report, i, merged);
      filled.push(i);
    } else {
      errors.push(fresh[k].scoring?.status === "failed" ? (fresh[k].scoring?.error ?? "scoring failed") : "the scorer returned no suggested answer again");
    }
  });

  if (filled.length) {
    check(await supabase.from("lms_sessions").update({ results, report }).eq("id", id).eq("status", "completed"));
  }
  await logAdminAction(admin.id, "session.suggest", { type: "session", id }, { attempted: targets.length, filled: filled.length, errors: errors.slice(0, 3) });

  if (!filled.length) throw new AdminError(`couldn't add a suggested answer: ${errors[0] ?? "unknown error"}`, 502);
  return { ok: true, attempted: targets.length, filled: filled.length };
});
