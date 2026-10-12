"use client";

import { Mic, Play, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchesPhrase, useMicTest, type MicStatus } from "@/hooks/useMicTest";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

const PHRASE = "Hi, I'm ready to begin the session";
const TEST_LIMIT_MS = 10_000;
const BARS = 12;

type Phase = "idle" | "testing" | "done";
type Result = "ok" | "mismatch" | "no-words" | "silent" | "speech-error";

const MIC_ERROR: Partial<Record<MicStatus, string>> = {
  blocked: "microphone access was blocked — allow it in your browser settings, then try again.",
  "no-device": "no microphone found — plug one in or check your system settings.",
  error: "couldn't open the microphone in this browser.",
};

const btn =
  "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50";

/** Pre-session check: level meter, say-the-phrase recognition test, and playback. */
export function MicCheck() {
  const mic = useMicTest();
  const speech = useSpeechRecognition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [heardText, setHeardText] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishingRef = useRef(false);

  const { stop: stopMic, heard: micHeard } = mic;
  const { stop: stopSpeech, error: speechError } = speech;

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const text = stopSpeech();
    await stopMic();
    setHeardText(text);
    setResult(
      matchesPhrase(text, PHRASE)
        ? "ok"
        : speechError
          ? "speech-error"
          : text
            ? "mismatch"
            : micHeard
              ? "no-words"
              : "silent",
    );
    setPhase("done");
  }, [stopSpeech, stopMic, speechError, micHeard]);

  async function test() {
    audioRef.current?.pause();
    setPlaying(false);
    setResult(null);
    setHeardText("");
    finishingRef.current = false;
    setPhase("testing");
    if (!(await mic.start())) {
      setPhase("idle");
      return;
    }
    speech.start();
  }

  // Done as soon as the phrase comes through, or after the time limit.
  const matched = phase === "testing" && matchesPhrase(speech.transcript, PHRASE);
  useEffect(() => {
    if (matched) void finish();
  }, [matched, finish]);

  useEffect(() => {
    if (phase !== "testing" || mic.status !== "live") return;
    const t = setTimeout(() => void finish(), TEST_LIMIT_MS);
    return () => clearTimeout(t);
  }, [phase, mic.status, finish]);

  useEffect(() => () => audioRef.current?.pause(), []);

  function playBack() {
    if (!mic.recordingUrl) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = new Audio(mic.recordingUrl);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onpause = () => setPlaying(false);
    audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  const live = phase === "testing" && mic.status === "live";
  const micError = MIC_ERROR[mic.status];
  const lit = Math.round(mic.level * BARS);

  let status: { text: string; tone: "ok" | "warn" | "muted" } | null = null;
  if (micError) status = { text: micError, tone: "warn" };
  else if (phase === "testing" && mic.status === "requesting")
    status = { text: "allow microphone access in your browser…", tone: "muted" };
  else if (live && speech.error) status = { text: speech.error, tone: "warn" };
  else if (live && mic.silent)
    status = { text: "we can't hear anything — check the mic isn't muted or try another input.", tone: "warn" };
  else if (live) status = { text: mic.heard ? "mic is picking you up — keep going…" : "listening…", tone: "muted" };
  else if (phase === "done" && result) status = RESULT_TEXT[result](heardText, speechError);

  return (
    <div className="border-b border-line py-6 md:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-[17px]">mic check</span>
          <p className="mt-1 text-[14px] text-subtle">make sure we can hear you before you start</p>
        </div>
        {phase === "testing" ? (
          <button type="button" onClick={() => void finish()} className={cn(btn, "bg-surface-2 text-white hover:bg-[#2a2a2a]")}>
            <Square className="size-4" strokeWidth={2} />
            stop
          </button>
        ) : (
          <button type="button" onClick={test} className={cn(btn, "bg-surface-2 text-brand hover:bg-[#2a2a2a]")}>
            {phase === "done" ? <RotateCcw className="size-4" strokeWidth={2} /> : <Mic className="size-4" strokeWidth={2} />}
            {phase === "done" ? "try again" : "test mic"}
          </button>
        )}
      </div>

      {phase !== "idle" && (
        <div className="mt-5">
          <p className="text-[14px] text-subtle">say out loud:</p>
          <p className="mt-1 text-[17px] font-medium">&ldquo;{PHRASE}&rdquo;</p>

          <div aria-hidden className="mt-4 flex h-7 items-end gap-1">
            {Array.from({ length: BARS }, (_, i) => (
              <span
                key={i}
                className={cn("w-1.5 rounded-full transition-colors", i < lit ? "bg-brand" : "bg-white/15")}
                style={{ height: `${30 + (i / (BARS - 1)) * 70}%` }}
              />
            ))}
          </div>

          {live && (
            <p className="mt-4 min-h-[1.5em] text-[15px] leading-relaxed text-white/85">
              {speech.transcript || <span className="text-subtle">your words will appear here…</span>}
            </p>
          )}
        </div>
      )}

      {status && (
        <p
          aria-live="polite"
          className={cn(
            "mt-4 text-[14px] leading-relaxed",
            status.tone === "ok" ? "text-brand" : status.tone === "warn" ? "text-white/80" : "text-subtle",
          )}
        >
          {status.text}
        </p>
      )}

      {phase === "done" && mic.recordingUrl && (
        <button type="button" onClick={playBack} className={cn(btn, "mt-4 -ml-1 px-3 text-white/85 hover:bg-white/5")}>
          {playing ? <Square className="size-4" strokeWidth={2} /> : <Play className="size-4" strokeWidth={2} />}
          {playing ? "stop playback" : "play back your recording"}
        </button>
      )}
    </div>
  );
}

const RESULT_TEXT: Record<
  Result,
  (heard: string, speechError: string | null) => { text: string; tone: "ok" | "warn" | "muted" }
> = {
  ok: () => ({ text: "we heard you clearly — you're ready ✓", tone: "ok" }),
  mismatch: (heard) => ({
    text: `we heard: “${heard}” — try again a little slower, or closer to the mic.`,
    tone: "warn",
  }),
  "no-words": () => ({
    text: "your mic works, but speech isn't being recognized — check your browser's speech settings, or answer by typing.",
    tone: "warn",
  }),
  silent: () => ({
    text: "we couldn't hear anything — check the mic isn't muted or try another input.",
    tone: "warn",
  }),
  "speech-error": (_, err) => ({ text: err ?? "voice input stopped.", tone: "warn" }),
};
