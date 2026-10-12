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

  const release = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    rec?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start(1000);
      recorderRef.current = rec;
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Stops and returns the recording, or null if nothing was captured. */
  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
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
