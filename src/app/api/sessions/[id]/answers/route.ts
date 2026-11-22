import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { SessionError, scoreLater, scoresLater, submitAnswer, type Target } from "@/lib/sessions/engine";
import { rateLimited, takeRateLimit } from "@/lib/rate-limit";
import { errorResponse, loadSession, saveResult } from "@/lib/sessions/store";
import { serverTimer } from "@/lib/timing";
import type { AnswerMode } from "@/types";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 20_000;

/** Submit an answer (main or follow-up) for one question. Multipart form. */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/answers">) {
  // Step timings go out as a Server-Timing header (devtools → Network → the request
  // → Timing) and to the server log when the request is slow.
  const timer = serverTimer();
  const started = performance.now();
  const auth = await requireUser();
  timer.mark("auth");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await ctx.params;
    const form = await request.formData();
    const index = Number(form.get("index"));
    const target = form.get("target") as Target;
    const mode = form.get("mode") as AnswerMode;
    const text = String(form.get("text") ?? "").trim().slice(0, MAX_TEXT);
    const durationSec = Math.min(3600, Math.max(0, Number(form.get("durationSec")) || 0));
    const audioField = form.get("audio");
    const audio = audioField instanceof Blob && audioField.size > 0 ? audioField : null;

    if (!["main", "followup"].includes(target) || !["voice", "text"].includes(mode)) {
      throw new SessionError("invalid request");
    }
    if (audio && audio.size > MAX_AUDIO_BYTES) throw new SessionError("recording is too long", 413);

    timer.mark("upload");

    const [allowed, row] = await Promise.all([takeRateLimit(auth.user.id, "answer"), loadSession(auth.supabase, id)]);
    timer.mark("load");
    if (!allowed) return rateLimited();
    if (!Number.isInteger(index) || index < 0 || index >= row.questions.length) {
      throw new SessionError("invalid question");
    }

    const result = await submitAnswer(row, index, target, { text, mode, durationSec }, audio, auth.user.id);
    // "agent" or "claude": which one decided the follow-up (claude also covers an agent fallback).
    timer.mark(`decide-${result.scoring?.engine ?? "claude"}`);
    await saveResult(auth.user.id, row, index, result);
    timer.mark("save");

    if (scoresLater(result)) {
      // Only replaces the unscored copy just saved (`result`), so it can't clobber
      // newer input. If the session is already finished, finalize has scored it
      // and the save is refused.
      after(async () => {
        const scored = await scoreLater(row.config, result);
        await saveResult(auth.user.id, row, index, scored, result).catch((err) =>
          console.warn("[claude:evaluate] saving background score failed:", err instanceof Error ? err.message : err),
        );
      });
    }
    if (performance.now() - started > 5000) console.info(`[answers] slow submit: ${timer.header()}`);
    return Response.json({ result }, { headers: { "Server-Timing": timer.header() } });
  } catch (err) {
    return errorResponse(err);
  }
}
