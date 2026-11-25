import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { unscoredIndexes } from "@/lib/admin/rescore";
import { AdminError, adminRoute, check, idParam } from "@/lib/admin/route";
import type { ReportHistory } from "@/lib/scoring";
import { finalize, rescoreAnswer } from "@/lib/sessions/engine";
import type { Report, SessionRow } from "@/types";

// Up to 90s per answer with the eval agent (in parallel), plus a new summary.
export const maxDuration = 300;

/** The report's own before/after data, so re-scoring keeps the original comparison. */
function historyFromReport(row: SessionRow): ReportHistory {
  const previousScores: Record<string, number | null> = {};
  // Older reports may not carry per-question data.
  row.report?.questions?.forEach((q, i) => {
    const bankId = row.questions[i]?.bankId;
    if (bankId && q.previousScore !== undefined) previousScores[bankId] = q.previousScore;
  });
  return { previous: row.report?.previous, previousScores };
}

/**
 * Scores answers that couldn't be scored at the time, the way a live session
 * does (a fresh eval agent run), then rebuilds the report of a
 * finished session. Answers that still can't be scored come back as an error
 * saying why, and keep that reason on the session.
 */
export const POST = adminRoute<RouteContext<"/api/admin/sessions/[id]/rescore">>(async ({ admin, ctx }) => {
  const id = await idParam(ctx);
  const supabase = db();
  const row = check(await supabase.from("lms_sessions").select("*").eq("id", id).maybeSingle()) as SessionRow | null;
  if (!row) throw new AdminError("session not found", 404);
  if (row.status === "abandoned") throw new AdminError("this session was abandoned; there's no report to fix");

  const targets = unscoredIndexes(row.results ?? []);
  if (!targets.length) throw new AdminError("every answer in this session already has a score");

  const results = structuredClone(row.results);
  // Side by side, like a session finishing: one at a time could outlast the request.
  await Promise.all(
    targets.map(async (i) => {
      results[i] = await rescoreAnswer(row.config, results[i], row.user_id);
    }),
  );
  const fixed = targets.filter((i) => results[i].evaluation && results[i].scoring?.status === "done");

  let report: Report | null = row.report;
  let finalResults = results;
  if (row.status === "completed") {
    // Already retried just now: don't replay what still failed a second time.
    const out = await finalize({ ...row, results }, historyFromReport(row), { replay: false });
    finalResults = out.results;
    report = out.report;
  }

  const update: Record<string, unknown> = { results: finalResults };
  if (row.status === "completed" && report) Object.assign(update, { report, total: report.total });
  check(await supabase.from("lms_sessions").update(update).eq("id", id).eq("status", row.status));

  // Keep per-question stats (mastery, bank averages) in line with the new scores.
  if (row.status === "completed") {
    for (const i of fixed) {
      const bankId = row.questions[i]?.bankId;
      const score = finalResults[i].evaluation?.score;
      if (bankId && typeof score === "number") {
        await supabase
          .from("lms_question_attempts")
          .update({ score: Math.max(0, Math.min(10, Math.round(score * 10) / 10)), skipped: false })
          .eq("session_id", id)
          .eq("question_id", bankId);
      }
    }
  }

  await logAdminAction(admin.id, "session.rescore", { type: "session", id }, {
    attempted: targets.length,
    fixed: fixed.length,
    total_before: row.total,
    total_after: report?.total ?? null,
  });
  if (!fixed.length) {
    const why = targets.map((i) => finalResults[i]?.scoring?.error).find(Boolean) ?? "unknown error";
    throw new AdminError(`couldn't score ${targets.length === 1 ? "the answer" : "any of the answers"}: ${why}`, 502);
  }
  return { ok: true, attempted: targets.length, fixed: fixed.length, total: report?.total ?? null };
});
