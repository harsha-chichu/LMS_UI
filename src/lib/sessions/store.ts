import "server-only";
import { SessionError } from "@/lib/sessions/engine";
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
 * Writes one question's result. A single SQL statement (lms_save_result), so
 * concurrent writes to other questions aren't lost and a finished session is never touched.
 */
export async function saveResult(userId: string, row: SessionRow, index: number, result: QuestionResult) {
  const { data, error } = await getSupabaseAdmin().rpc("lms_save_result", {
    p_session: row.id,
    p_user: userId,
    p_index: index,
    p_result: result,
  });
  if (error) throw new SessionError(error.message, 500);
  if (!data) throw new SessionError("session is no longer in progress", 409);
  return data as QuestionResult[];
}

/** Turns thrown errors into JSON responses for the route handlers. */
export function errorResponse(err: unknown) {
  if (err instanceof SessionError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "something went wrong" }, { status: 500 });
}
