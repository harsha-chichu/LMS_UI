import { requireUser } from "@/lib/auth";
import { SessionError, submitAnswer, type Target } from "@/lib/sessions/engine";
import { errorResponse, loadSession, saveResult } from "@/lib/sessions/store";
import type { AnswerMode } from "@/types";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 20_000;

/** Submit an answer (main or follow-up) for one question. Multipart form. */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/answers">) {
  const auth = await requireUser();
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

    const row = await loadSession(auth.supabase, id);
    if (!Number.isInteger(index) || index < 0 || index >= row.questions.length) {
      throw new SessionError("invalid question");
    }

    const result = await submitAnswer(row, index, target, { text, mode, durationSec }, audio);
    await saveResult(auth.supabase, row, index, result);
    return Response.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
