"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";
import { isSaved, toggleSaved, useSavedQuestions, type SaveTarget } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Bookmark toggle for a session question. Hidden if saved questions never loaded. */
export function SaveButton({ label, className, ...target }: SaveTarget & { label?: boolean; className?: string }) {
  const { data: saved, error } = useSavedQuestions();
  const [busy, setBusy] = useState(false);
  // Missing table / offline: hide rather than show a button that can't work.
  if (error && !saved) return null;

  const on = saved ? isSaved(saved, target) : false;

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "unsave question" : "save question"}
      title={on ? "saved — tap to remove" : "save this question"}
      disabled={!saved}
      onClick={async () => {
        if (!saved || busy) return;
        setBusy(true);
        await toggleSaved(target, saved).catch(() => {});
        setBusy(false);
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full p-2 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60",
        on ? "text-brand" : "text-subtle hover:text-white",
        label && "pr-3",
        className,
      )}
    >
      <Bookmark className={cn("size-[18px]", on && "fill-current")} strokeWidth={1.75} />
      {label && <span className="text-[13px]">{on ? "saved" : "save"}</span>}
    </button>
  );
}
