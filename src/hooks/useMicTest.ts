"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickMimeType } from "@/hooks/useRecorder";

export type MicStatus = "idle" | "requesting" | "live" | "blocked" | "no-device" | "error";

// RMS (0–1) above which we count the input as real sound rather than noise.
const SOUND_THRESHOLD = 0.02;
const SILENT_AFTER_MS = 4000;
const LEVEL_UPDATE_MS = 50;

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\bi'm\b/g, "i am")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when most of the target phrase's words were heard, in any order. */
export function matchesPhrase(heard: string, target: string, ratio = 0.7) {
  const words = new Set(normalizeWords(heard));
  const wanted = normalizeWords(target);
  if (wanted.length === 0) return false;
  const found = wanted.filter((w) => words.has(w)).length;
  return found / wanted.length >= ratio;
}

/**
 * Opens the microphone for a quick pre-session check: a live input level,
 * whether any sound came through, and a recording of the attempt to play back.
 */
export function useMicTest() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [silent, setSilent] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const urlRef = useRef<string | null>(null);
  // Bumped by stop/unmount so a permission prompt answered late doesn't reopen the mic.
  const runRef = useRef(0);

  const setUrl = useCallback((url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setRecordingUrl(url);
  }, []);

  const release = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    release();
    setUrl(null);
    setHeard(false);
    setSilent(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return false;
    }
    setStatus("requesting");
    const run = ++runRef.current;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (run !== runRef.current) return false;
      const name = err instanceof DOMException ? err.name : "";
      setStatus(
        name === "NotAllowedError" || name === "SecurityError"
          ? "blocked"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "no-device"
            : "error",
      );
      return false;
    }
    if (run !== runRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    streamRef.current = stream;

    // Live level meter.
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let lastSoundAt = startedAt;
    let lastUpdate = 0;
    let smoothed = 0;
    let wasSilent = false;
    let anySound = false;

    const tick = (now: number) => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const x = (v - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / data.length);
      smoothed = Math.max(rms, smoothed * 0.85);

      if (rms > SOUND_THRESHOLD) {
        lastSoundAt = now;
        if (!anySound) {
          anySound = true;
          setHeard(true);
        }
      }
      const isSilent = now - lastSoundAt > SILENT_AFTER_MS;
      if (isSilent !== wasSilent) {
        wasSilent = isSilent;
        setSilent(isSilent);
      }
      if (now - lastUpdate > LEVEL_UPDATE_MS) {
        lastUpdate = now;
        // Speech sits around 0.02–0.2 RMS; scale so normal talking fills most of the meter.
        setLevel(Math.min(1, smoothed * 6));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Record the attempt so the user can hear themselves back.
    const mimeType = pickMimeType();
    if (mimeType !== null) {
      try {
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
        rec.start(500);
        recorderRef.current = rec;
      } catch {
        recorderRef.current = null;
      }
    }

    setStatus("live");
    return true;
  }, [release, setUrl]);

  /** Releases the mic; resolves once the recording (if any) is ready to play. */
  const stop = useCallback(
    () =>
      new Promise<void>((resolve) => {
        runRef.current++;
        const rec = recorderRef.current;
        recorderRef.current = null;
        const finish = () => {
          release();
          setStatus((s) => (s === "live" || s === "requesting" ? "idle" : s));
          resolve();
        };
        if (!rec || rec.state === "inactive") return finish();
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          chunksRef.current = [];
          if (blob.size > 0) setUrl(URL.createObjectURL(blob));
          finish();
        };
        rec.stop();
      }),
    [release, setUrl],
  );

  useEffect(
    () => () => {
      runRef.current++;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      recorderRef.current = null;
      release();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [release],
  );

  return { status, level, heard, silent, recordingUrl, start, stop };
}
