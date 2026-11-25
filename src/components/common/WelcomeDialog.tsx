"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/common/Confetti";

type Note = { title: string; body: string };

/**
 * The one-time welcome note, written on /admin/welcome. Asking for it also
 * records the user's first visit (that's what alerts admins of a new sign-up),
 * so it runs on every signed-in page; it opens only until the user closes it.
 */
export function WelcomeDialog() {
  const [note, setNote] = useState<Note | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/welcome", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ({ show: boolean } & Partial<Note>) | null) => {
        if (!cancelled && d?.show && d.body)
          setNote({ title: d.title ?? "", body: d.body });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const close = useCallback(() => {
    setNote(null);
    void fetch("/api/welcome/dismiss", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!note) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note, close]);

  if (!note) return null;

  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-[20px] border border-line bg-surface-2 p-6 shadow-xl"
        >
          <button
            type="button"
            onClick={close}
            aria-label="close"
            className="absolute top-4 right-4 rounded-full p-1 text-subtle hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
          <h2 id="welcome-title" className="pr-8 text-[20px] font-medium">
            {note.title}
          </h2>
          <p className="mt-3 overflow-y-auto text-[14px] leading-relaxed whitespace-pre-line text-foreground/85">
            {note.body}
          </p>
          <button
            ref={button}
            type="button"
            onClick={close}
            className="mt-6 inline-flex h-10 items-center justify-center self-end rounded-full bg-brand px-5 text-[14px] font-medium text-primary-foreground hover:brightness-110"
          >
            get started
          </button>
        </div>
      </div>
    </>
  );
}
