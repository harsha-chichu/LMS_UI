"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { liveCaptureSupported, startDeepgram, type LiveCallbacks, type LiveEngine } from "./deepgram";

// Minimal Web Speech API typings; TypeScript's DOM lib doesn't ship them.
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlternative;
}
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface SpeechErrorEvent {
  error: string;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** True when voice answers can work here: live streaming capture, or the browser's own recognition. */
export function useSpeechSupported() {
  return useSyncExternalStore(noopSubscribe, () => liveCaptureSupported() || getCtor() !== null, () => true);
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "microphone access was blocked — allow it in your browser, or type instead.",
  "service-not-allowed": "speech recognition isn't allowed here — type your answer instead.",
  "audio-capture": "no microphone found — type your answer instead.",
  network: "the speech service couldn't be reached — type your answer instead.",
  unsupported: "this browser doesn't support voice answers — type instead.",
};

/** The browser's built-in recognition (Chrome, Edge, Safari): the fallback when Deepgram isn't available. */
function startBrowser(cb: LiveCallbacks): LiveEngine | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  let finalText = "";
  let interim = "";
  // Chrome ends recognition after a pause; restart while the user still wants it.
  let want = true;
  const heard = () => `${finalText} ${interim}`.replace(/\s+/g, " ").trim();

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language || "en-US";
  rec.onresult = (e) => {
    let pending = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += `${r[0].transcript.trim()} `;
      else pending += r[0].transcript;
    }
    interim = pending;
    cb.onText(finalText, interim);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    want = false;
    cb.onError(ERROR_TEXT[e.error] ?? `voice input stopped (${e.error}).`);
  };
  rec.onend = () => {
    if (want) {
      try {
        rec.start();
        return;
      } catch {
        // fall through to stopped state
      }
    }
    cb.onEnd();
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  const abort = () => {
    want = false;
    rec.abort();
  };
  return {
    // Return what's been heard now: Chrome's own stop can hang on to the last words for seconds.
    stop: async () => {
      const text = heard();
      abort();
      return text;
    },
    abort,
  };
}

// Set once Deepgram turns out not to be configured, so later answers skip the round trip.
let deepgramUnavailable = false;

export interface StartOptions {
  /** Technical words to bias recognition toward (Deepgram only). */
  keyterms?: string[];
}

/**
 * Live speech-to-text for voice answers. Streams to Deepgram when the server has a
 * key (accurate, accent-robust, knows the question's terms) and falls back to the
 * browser's recognition otherwise. Words appear in `transcript` as they're spoken.
 */
export function useSpeechRecognition() {
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<LiveEngine | null>(null);
  // Bumped on every start/stop so callbacks from an old engine are ignored.
  const genRef = useRef(0);

  const callbacks = useCallback((gen: number): LiveCallbacks => {
    const live = () => gen === genRef.current;
    return {
      onText: (f, i) => {
        if (!live()) return;
        setFinalText(f);
        setInterim(i);
      },
      onError: (msg) => live() && setError(msg),
      onEnd: () => {
        if (!live()) return;
        engineRef.current = null;
        setListening(false);
        setInterim("");
      },
    };
  }, []);

  /** Must be called from a click/tap. Resolves false (with `error` set) if voice can't start. */
  const start = useCallback(
    async (opts: StartOptions = {}) => {
      engineRef.current?.abort();
      engineRef.current = null;
      const gen = ++genRef.current;
      setFinalText("");
      setInterim("");
      setError(null);
      setListening(true);

      let engine: LiveEngine | null = null;
      if (!deepgramUnavailable) {
        const res = await startDeepgram(callbacks(gen), opts.keyterms);
        if ("engine" in res) engine = res.engine;
        else if ("error" in res) {
          if (gen === genRef.current) {
            setError(res.error);
            setListening(false);
          }
          return false;
        } else deepgramUnavailable = true;
      }
      if (gen !== genRef.current) {
        // Stopped or restarted while connecting.
        engine?.abort();
        return false;
      }
      engine ??= startBrowser(callbacks(gen));
      if (!engine) {
        setError(getCtor() ? ERROR_TEXT["service-not-allowed"] : ERROR_TEXT.unsupported);
        setListening(false);
        return false;
      }
      engineRef.current = engine;
      return true;
    },
    [callbacks],
  );

  /** Stop listening and resolve with everything heard, including the last words still in flight. */
  const stop = useCallback(async () => {
    const engine = engineRef.current;
    engineRef.current = null;
    ++genRef.current;
    setListening(false);
    setInterim("");
    const heard = engine ? await engine.stop() : "";
    setFinalText(heard);
    return heard;
  }, []);

  /** Stop listening and throw away what was heard. */
  const cancel = useCallback(() => {
    engineRef.current?.abort();
    engineRef.current = null;
    ++genRef.current;
    setListening(false);
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      ++genRef.current;
      engineRef.current?.abort();
    },
    [],
  );

  return {
    transcript: `${finalText} ${interim}`.replace(/\s+/g, " ").trim(),
    listening,
    error,
    clearError: useCallback(() => setError(null), []),
    start,
    stop,
    cancel,
  };
}
