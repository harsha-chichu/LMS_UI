import { requireUser } from "@/lib/auth";
import { SessionError, skip, type Target } from "@/lib/sessions/engine";
import { errorResponse, loadSession, saveResult } from "@/lib/sessions/store";

/** Skip a question, or the follow-up currently waiting on it. */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/skip">) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as { index?: number; target?: Target } | null;
    const index = Number(body?.index);
    const target = body?.target;
    if (target !== "main" && target !== "followup") throw new SessionError("invalid request");

    const row = await loadSession(auth.supabase, id);
    if (!Number.isInteger(index) || index < 0 || index >= row.questions.length) {
      throw new SessionError("invalid question");
    }

    const result = await skip(row, index, target);
    await saveResult(auth.supabase, row, index, result);
    return Response.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
