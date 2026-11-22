import "server-only";
import { logServerError } from "@/lib/admin/errors";
import { SessionError } from "@/lib/sessions/engine";
import { emptyResult } from "@/lib/sessions/progress";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseServer } from "@/lib/supabase/server";
import type { QuestionResult, SessionRow } from "@/types";

/** Loads a session the signed-in user owns (RLS hides everyone else's). */
export async function loadSession(supabase: SupabaseServer, id: string, { inProgress = true } = {}) {
  const { data, error } = await supabase.from("lms_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new SessionError(error.message, 500);
  if (!data) throw new SessionError("session not found", 404);
  const row = data as SessionRow;
  if (inProgress && row.status !== "in_progress") throw new SessionError(`session is ${row.status}`, 409);
  return row;
}

/**
 * Writes one question's result. A single SQL statement (lms_save_result_guarded,
 * migration 0013), so concurrent writes to other questions aren't lost and a
 * finished session is never touched.
 *
 * It's also a compare-and-set: the write only lands if the question's entry still
 * equals `expected`, which defaults to the entry as it was when `row` was loaded.
 * Two submissions racing on the same question (double click, two tabs) can't
 * both win; the loser gets a 409 instead of overwriting the first.
 */
export async function saveResult(
  userId: string,
  row: SessionRow,
  index: number,
  result: QuestionResult,
  expected: QuestionResult = row.results[index] ?? emptyResult(row.questions[index]),
) {
  const { data, error } = await getSupabaseAdmin().rpc("lms_save_result_guarded", {
    p_session: row.id,
    p_user: userId,
    p_index: index,
    p_expected: expected,
    p_result: result,
  });
  if (error) throw new SessionError(error.message, 500);
  if (!data) throw new SessionError("this question changed in another tab, or the session has ended — refresh to continue.", 409);
  return data as QuestionResult[];
}

/** Turns thrown errors into JSON responses for the route handlers. */
export function errorResponse(err: unknown, route = "/api/sessions") {
  if (err instanceof SessionError) {
    if (err.status >= 500) logServerError("sessions-api", err, { route });
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  logServerError("sessions-api", err, { route });
  return Response.json({ error: "something went wrong" }, { status: 500 });
}
