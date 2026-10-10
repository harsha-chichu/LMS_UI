"use client";

import { ArrowUp, Mic } from "lucide-react";
import { useEffect, useRef } from "react";
import { RoundIconButton } from "@/components/session/parts";

/** Rounded input bar: autosizing textarea, switch-to-voice and send. */
export function TextComposer({
  value,
  onChange,
  onSend,
  onVoice,
  voiceAvailable,
  disabled,
  placeholder = "type your answer…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoice: () => void;
  voiceAvailable: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="flex items-end gap-2 rounded-[28px] bg-[#161616] py-2 pr-2 pl-5 ring-1 ring-white/5 focus-within:ring-white/15"
    >
      <label htmlFor="answer" className="sr-only">
        your answer
      </label>
      <textarea
        id="answer"
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        className="my-2 max-h-40 min-h-7 flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none placeholder:text-subtle md:text-[16px]"
      />
      {voiceAvailable && (
        <RoundIconButton aria-label="Answer by voice instead" onClick={onVoice} disabled={disabled}>
          <Mic className="size-[18px]" strokeWidth={1.75} />
        </RoundIconButton>
      )}
      <button
        type="submit"
        aria-label="Send answer"
        disabled={!canSend}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-black transition-[filter,opacity] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
      >
        <ArrowUp className="size-5" strokeWidth={2} />
      </button>
    </form>
  );
}
