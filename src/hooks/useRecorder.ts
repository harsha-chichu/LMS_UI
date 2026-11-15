"use client";

import { useCallback, useEffect, useRef } from "react";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/**
 * Records the microphone alongside live speech recognition, so the eval agent
 * can judge delivery (pronunciation, fluency, pauses) from the real audio.
 * Failures are silent: the answer still goes through with its transcript.
 */
export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Bumped by stop/cancel so a mic that opens after them is closed again.
  const runRef = useRef(0);

  const release = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    rec?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  /** True once recording; false if the mic couldn't open; null if stopped/cancelled meanwhile. */
  const start = useCallback(async (): Promise<boolean | null> => {
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) return false;
    const run = ++runRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (run !== runRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start(1000);
      recorderRef.current = rec;
      return true;
    } catch {
      return run === runRef.current ? false : null;
    }
  }, []);

  /** Stops and returns the recording, or null if nothing was captured. */
  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        runRef.current++;
        const rec = recorderRef.current;
        if (!rec || rec.state === "inactive") {
          release();
          return resolve(null);
        }
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          chunksRef.current = [];
          release();
          resolve(blob.size > 0 ? blob : null);
        };
        rec.stop();
      }),
    [release],
  );

  const cancel = useCallback(() => {
    runRef.current++;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    chunksRef.current = [];
    release();
  }, [release]);

  useEffect(() => cancel, [cancel]);

  return { start, stop, cancel };
}
