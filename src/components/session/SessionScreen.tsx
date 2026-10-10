"use client";

import { ArrowRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PillLink } from "@/components/common/PillButton";
import { ListeningView } from "@/components/session/ListeningView";
import { TextComposer } from "@/components/session/TextComposer";
import {
  AnswerBubble,
  FollowUpBlock,
  KeyboardButton,
  MicButton,
  QuestionMeta,
  QuestionText,
  SessionHeader,
} from "@/components/session/parts";
import { useRecorder } from "@/hooks/useRecorder";
import { useSessionMachine } from "@/hooks/useSessionMachine";
import { useSpeechRecognition, useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { domainShort } from "@/lib/constants";
import {
  abandonSession,
  completeSession,
  sendAnswer,
  sendSkip,
  useSessionRow,
} from "@/lib/data";
import type { AnswerMode, SessionRow } from "@/types";

export function SessionScreen() {
  const { id } = useParams<{ id: string }>();
  const { data: row, error } = useSessionRow(id);
  const router = useRouter();

  const done = row?.status === "completed";
  useEffect(() => {
    if (done) router.replace(`/report/${id}`);
  }, [done, id, router]);

  if (error || row === null || row?.status === "abandoned") {
    return (
      <Centered>
        <p className="text-[17px]">{row?.status === "abandoned" ? "this session was ended." : "we couldn't find that session."}</p>
        <PillLink href="/setup" arrow>
          start a new one
        </PillLink>
      </Centered>
    );
  }
  if (!row || done) return <Centered>{null}</Centered>;

  return <SessionRunner key={row.id} row={row} defaultInput={row.config.mode} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-6 px-5 text-center">
      {children}
    </main>
  );
}

function SessionRunner({ row, defaultInput }: { row: SessionRow; defaultInput: AnswerMode }) {
  const router = useRouter();
  const [state, dispatch] = useSessionMachine(row, defaultInput);
  const speech = useSpeechRecognition();
  const recorder = useRecorder();
  const speechSupported = useSpeechSupported();
  const [notice, setNotice] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  const { config, questions } = row;
  const total = questions.length;
  const finishing = state.phase === "finishing";
  const result = state.results[Math.min(state.index, total - 1)];
  const followUps = result.followUps;
  const waiting = state.target === "followup" ? followUps.at(-1) : undefined;
  const prompt = waiting ? waiting.question : result.question.text;
  const input = speechSupported ? state.input : "text";
  const submitting = state.phase === "submitting";

  // ---- actions ----

  const submit = useCallback(
    async (text: string, mode: AnswerMode, durationSec: number, audio: Blob | null) => {
      dispatch({ type: "submitting", text: text || null });
      try {
        const updated = await sendAnswer(row.id, {
          index: state.index,
          target: state.target,
          text,
          mode,
          durationSec,
          audio,
        });
        dispatch({ type: "synced", result: updated });
      } catch (err) {
        dispatch({ type: "failed", error: errorText(err), draft: text || undefined });
      }
    },
    [dispatch, row.id, state.index, state.target],
  );

  const skip = async () => {
    dispatch({ type: "submitting", text: null });
    try {
      dispatch({ type: "synced", result: await sendSkip(row.id, state.index, state.target) });
    } catch (err) {
      dispatch({ type: "failed", error: errorText(err) });
    }
  };

  const startListening = useCallback(() => {
    setNotice(null);
    if (!speech.start()) {
      dispatch({ type: "setInput", input: "text" });
      return;
    }
    void recorder.start();
    dispatch({ type: "listen", at: Date.now() });
  }, [dispatch, recorder, speech]);

  const cancelListening = useCallback(() => {
    speech.stop();
    recorder.cancel();
    dispatch({ type: "cancelListening" });
  }, [dispatch, recorder, speech]);

  const submitVoice = useCallback(async () => {
    const text = speech.stop();
    const audio = await recorder.stop();
    if (!text && !audio) {
      setNotice("didn't catch anything — try again, or tap ✕ and type instead.");
      speech.start();
      void recorder.start();
      return;
    }
    const durationSec = state.listenStartedAt ? Math.max(1, Math.round((Date.now() - state.listenStartedAt) / 1000)) : 0;
    void submit(text, "voice", durationSec, audio);
  }, [recorder, speech, state.listenStartedAt, submit]);

  const typeInstead = useCallback(() => {
    const heard = speech.stop();
    recorder.cancel();
    speech.clearError();
    dispatch({ type: "setInput", input: "text", draft: heard || state.draft });
  }, [dispatch, recorder, speech, state.draft]);

  const submitDraft = () => {
    const text = state.draft.trim();
    if (text) void submit(text, "text", 0, null);
  };

  // "next question" sends whatever is typed; with nothing typed it skips.
  const next = () => {
    if (input === "text" && state.draft.trim()) return submitDraft();
    void skip();
  };

  const close = async () => {
    if (!window.confirm("end this session? it won't be scored.")) return;
    speech.stop();
    recorder.cancel();
    await abandonSession(row.id).catch(() => {});
    router.push("/setup");
  };

  // ---- finish: score everything and build the report ----

  const started = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!finishing || started.current) return;
    started.current = true;
    completeSession(row.id)
      .then(() => router.replace(`/report/${row.id}`))
      .catch((err) => {
        started.current = false;
        setFinishError(errorText(err));
      });
  }, [finishing, router, row.id, attempt]);

  if (finishing) {
    return (
      <Centered>
        {finishError ? (
          <>
            <p className="text-[17px]">couldn&apos;t build your report.</p>
            <p className="text-[14px] text-subtle">{finishError}</p>
            <button
              type="button"
              className="text-[15px] text-brand underline-offset-4 hover:underline"
              onClick={() => {
                setFinishError(null);
                setAttempt((a) => a + 1);
              }}
            >
              try again
            </button>
          </>
        ) : (
          <>
            <span className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-brand" aria-hidden />
            <p className="text-[16px] text-white/80">scoring your session…</p>
            <p className="text-[13px] text-subtle">this can take up to a minute</p>
          </>
        )}
      </Centered>
    );
  }

  // ---- layout ----

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-6 md:px-0">
      <SessionHeader total={total} current={state.index} onClose={close} />

      <section className="mt-4 flex-1 md:mt-6" aria-live="polite">
        <QuestionMeta>
          question {state.index + 1} · {domainShort(config.domain)} · {config.difficulty}
        </QuestionMeta>
        <QuestionText className="mt-2.5">{result.question.text}</QuestionText>

        {result.answer && <AnswerBubble className="mt-6">{result.answer.text || "🎙️ spoken answer"}</AnswerBubble>}
        {result.answer &&
          followUps.map((f, i) => (
            <div key={i}>
              <FollowUpBlock className="mt-6">{f.question}</FollowUpBlock>
              {f.answer && <AnswerBubble className="mt-6">{f.answer.text || "🎙️ spoken answer"}</AnswerBubble>}
            </div>
          ))}
        {submitting && state.pending && <AnswerBubble className="mt-6 opacity-70">{state.pending}</AnswerBubble>}

        {submitting && (
          <p className="mt-6 flex items-center gap-2 text-[14px] text-subtle">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-pulse rounded-full bg-brand"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
            {state.pending === null ? "moving on…" : "listening back to your answer…"}
          </p>
        )}
      </section>

      <div className="sticky bottom-0 bg-black pt-6">
        {state.error && (
          <p role="alert" className="mb-3 text-center text-[14px] text-brand">
            {state.error}
          </p>
        )}

        {input === "voice" ? (
          <div className="flex flex-col items-center">
            <div className="grid grid-cols-[44px_auto_44px] items-center gap-5">
              <span aria-hidden />
              <MicButton size={80} onClick={startListening} disabled={submitting} className="md:size-[84px]" />
              <KeyboardButton onClick={() => dispatch({ type: "setInput", input: "text" })} disabled={submitting} />
            </div>
            <p className="mt-3 text-[14px] text-subtle">tap to answer · or type instead</p>
          </div>
        ) : (
          <TextComposer
            value={state.draft}
            onChange={(draft) => dispatch({ type: "setDraft", draft })}
            onSend={submitDraft}
            onVoice={startListening}
            voiceAvailable={speechSupported}
            disabled={submitting}
            placeholder={state.target === "followup" ? "answer the follow-up…" : "type your answer…"}
          />
        )}

        <div className="mt-5 flex items-center justify-between text-[14px] md:text-[15px]">
          <button
            type="button"
            disabled={submitting}
            onClick={skip}
            className="text-subtle hover:text-white disabled:opacity-40"
          >
            {state.target === "followup" ? "skip follow-up" : "skip question"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={next}
            className="inline-flex items-center gap-2 text-subtle hover:text-white disabled:opacity-40"
          >
            {state.index + 1 === total && state.target === "main" ? "finish" : "next question"}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      {state.phase === "listening" && state.listenStartedAt !== null && (
        <ListeningView
          prompt={prompt}
          transcript={speech.transcript}
          startedAt={state.listenStartedAt}
          error={speech.error}
          notice={notice}
          onCancel={cancelListening}
          onSubmit={submitVoice}
          onTypeInstead={typeInstead}
        />
      )}
    </main>
  );
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : "something went wrong — try again.";
}
