"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

/** True when the browser has speech recognition (Chrome, Edge, Safari). */
export function useSpeechSupported() {
  return useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => true);
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "microphone access was blocked — allow it in your browser, or type instead.",
  "service-not-allowed": "speech recognition isn't allowed here — type your answer instead.",
  "audio-capture": "no microphone found — type your answer instead.",
  network: "the speech service couldn't be reached — type your answer instead.",
  unsupported: "this browser doesn't support voice answers — type instead.",
};

export function useSpeechRecognition() {
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  // Read synchronously by stop(), which can't wait for a re-render.
  const interimRef = useRef("");
  // Chrome ends recognition after a pause; restart while the user still wants it.
  const wantRef = useRef(false);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError(ERROR_TEXT.unsupported);
      return false;
    }
    recRef.current?.abort();
    finalRef.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterim("");
    setError(null);
    wantRef.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += `${r[0].transcript.trim()} `;
        else pending += r[0].transcript;
      }
      interimRef.current = pending;
      setFinalText(finalRef.current);
      setInterim(pending);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      setError(ERROR_TEXT[e.error] ?? `voice input stopped (${e.error}).`);
    };
    rec.onend = () => {
      if (wantRef.current && recRef.current === rec) {
        try {
          rec.start();
          return;
        } catch {
          // fall through to stopped state
        }
      }
      if (recRef.current === rec) {
        setListening(false);
        setInterim("");
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      return true;
    } catch {
      setError(ERROR_TEXT["service-not-allowed"]);
      return false;
    }
  }, []);

  /** Stop and discard; returns whatever was heard so far. */
  const stop = useCallback(() => {
    wantRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    rec?.abort();
    setListening(false);
    const heard = `${finalRef.current} ${interimRef.current}`.replace(/\s+/g, " ").trim();
    interimRef.current = "";
    setInterim("");
    return heard;
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
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
  };
}
