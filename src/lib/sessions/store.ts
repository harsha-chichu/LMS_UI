import "server-only";
import { SessionError } from "@/lib/sessions/engine";
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

export async function saveResult(supabase: SupabaseServer, row: SessionRow, index: number, result: QuestionResult) {
  const results = row.questions.map((question, i) =>
    i === index ? result : (row.results[i] ?? { question, skipped: false, followUps: [] }),
  );
  const { error } = await supabase.from("lms_sessions").update({ results }).eq("id", row.id);
  if (error) throw new SessionError(error.message, 500);
  return results;
}

/** Turns thrown errors into JSON responses for the route handlers. */
export function errorResponse(err: unknown) {
  if (err instanceof SessionError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "something went wrong" }, { status: 500 });
}
