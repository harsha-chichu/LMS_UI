"use client";

import { Check, Keyboard, Mic, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useElapsed } from "@/hooks/useElapsed";
import { formatClock } from "@/lib/dates";

/** Full-screen voice capture: live transcript, cancel (✕) and submit (✓). */
export function ListeningView({
  prompt,
  transcript,
  startedAt,
  error,
  notice,
  onCancel,
  onSubmit,
  onTypeInstead,
}: {
  prompt: string;
  transcript: string;
  startedAt: number;
  error: string | null;
  notice: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  onTypeInstead: () => void;
}) {
  const elapsed = useElapsed(startedAt);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Keep the newest words in view as the transcript grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recording your answer"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pt-6 pb-8 md:px-0">
        <p className="text-center text-[14px] text-subtle tabular-nums">
          {error ? "stopped" : "listening"} · {formatClock(elapsed)}
        </p>
        <p className="mx-auto mt-4 max-w-[440px] text-center text-[14px] leading-relaxed text-white/75 md:text-[15px]">
          {prompt}
        </p>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="relative flex size-[190px] items-center justify-center">
            {!error && (
              <>
                <span aria-hidden className="absolute inset-0 rounded-full border border-brand/25 animate-ring-pulse" />
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-brand/25 animate-ring-pulse [animation-delay:1.2s]"
                />
              </>
            )}
            <span aria-hidden className="absolute inset-[16px] rounded-full border border-brand/20" />
            <span className="flex size-[128px] items-center justify-center rounded-full bg-bubble ring-1 ring-brand/80 ring-offset-4 ring-offset-black">
              <Mic className="size-8 text-brand" strokeWidth={1.75} />
            </span>
          </div>
        </div>

        <div ref={transcriptRef} aria-live="polite" className="max-h-[36dvh] overflow-y-auto">
          {error ? (
            <p className="text-[16px] text-brand">{error}</p>
          ) : transcript ? (
            <p className="text-[19px] leading-[1.45] font-medium md:text-[22px]">
              {transcript}
              <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-brand animate-caret" />
            </p>
          ) : (
            <p className="text-[17px] text-subtle">start speaking — your words will appear here.</p>
          )}
          {notice && !error && <p className="mt-3 text-[14px] text-brand">{notice}</p>}
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Discard answer"
            className="inline-flex size-[60px] items-center justify-center rounded-full bg-surface-2 text-white transition-colors hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X className="size-6" strokeWidth={1.75} />
          </button>
          {error ? (
            <button
              type="button"
              onClick={onTypeInstead}
              aria-label="Type instead"
              className="inline-flex size-[60px] items-center justify-center rounded-full bg-brand text-black hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <Keyboard className="size-6" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              aria-label="Submit answer"
              className="inline-flex size-[60px] items-center justify-center rounded-full bg-brand text-black hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <Check className="size-6" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
