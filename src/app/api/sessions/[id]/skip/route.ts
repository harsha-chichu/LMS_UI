import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { SessionError, scoreLater, scoresLater, skip, type Target } from "@/lib/sessions/engine";
import { rateLimited, takeRateLimit } from "@/lib/rate-limit";
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

    if (!(await takeRateLimit(auth.user.id, "answer"))) return rateLimited();
    const row = await loadSession(auth.supabase, id);
    if (!Number.isInteger(index) || index < 0 || index >= row.questions.length) {
      throw new SessionError("invalid question");
    }

    const result = await skip(row, index, target);
    await saveResult(auth.user.id, row, index, result);

    // Skipping a follow-up leaves the main answer to score; do it after responding.
    if (scoresLater(result)) {
      after(async () => {
        const scored = await scoreLater(row.config, result);
        await saveResult(auth.user.id, row, index, scored, result).catch((err) =>
          console.warn("[claude:evaluate] saving background score failed:", err instanceof Error ? err.message : err),
        );
      });
    }
    return Response.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
