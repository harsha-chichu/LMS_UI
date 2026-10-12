"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { MAX_TOPIC_LENGTH, MAX_TOPICS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-brand";

/**
 * Multi-select topic chips for a domain, plus free-text topics the user adds.
 * Nothing selected means "any topic".
 */
export function TopicPicker({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string[];
  onChange: (topics: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= MAX_TOPICS;
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const custom = value.filter((v) => !options.some((o) => o.toLowerCase() === v.toLowerCase()));

  function toggle(topic: string) {
    if (has(topic)) onChange(value.filter((v) => v.toLowerCase() !== topic.toLowerCase()));
    else if (!full) onChange([...value, topic]);
  }

  function add() {
    const topic = draft.trim().toLowerCase();
    if (!topic || full) return;
    if (!has(topic)) onChange([...value, topic]);
    setDraft("");
  }

  return (
    <div className="mt-4">
      <div role="group" aria-label="topics" className="flex flex-wrap gap-2">
        {options.map((topic) => {
          const selected = has(topic);
          return (
            <button
              key={topic}
              type="button"
              aria-pressed={selected}
              disabled={!selected && full}
              onClick={() => toggle(topic)}
              className={cn(
                chip,
                selected
                  ? "border-brand bg-brand/15 text-white"
                  : "border-line text-white/70 hover:text-white disabled:opacity-40 disabled:hover:text-white/70",
              )}
            >
              {topic}
            </button>
          );
        })}
        {custom.map((topic) => (
          <button
            key={topic}
            type="button"
            aria-label={`remove ${topic}`}
            onClick={() => toggle(topic)}
            className={cn(chip, "border-brand bg-brand/15 text-white")}
          >
            {topic}
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TOPIC_LENGTH}
          disabled={full}
          placeholder={full ? `up to ${MAX_TOPICS} topics` : "add your own topic"}
          aria-label="add your own topic"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-white placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          aria-label="add topic"
          disabled={full || !draft.trim()}
          className="rounded-full p-1.5 text-brand transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand disabled:text-subtle"
        >
          <Plus className="size-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
