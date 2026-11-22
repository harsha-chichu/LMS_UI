"use client";

import { useState, useTransition } from "react";
import { adminFetch, buttonCls } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";
import { cn } from "@/lib/utils";

const VERDICTS = [
  { value: "fair", label: "fair" },
  { value: "too_high", label: "too high" },
  { value: "too_low", label: "too low" },
] as const;

/** Fair / too high / too low buttons for one scored answer. */
export function ScoreReview({ sessionId, questionIndex, readOnly }: { sessionId: string; questionIndex: number; readOnly?: boolean }) {
  const [done, setDone] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (readOnly) return null;
  if (done) return <p className="text-[13px] text-subtle" role="status">saved: {done.replace("_", " ")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="note (optional)" aria-label="note" className={cn(inputCls, "text-[13px]")} />
      <div className="flex flex-wrap gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  await adminFetch("/api/admin/reviews", "POST", { sessionId, questionIndex, verdict: v.value, note: note || undefined });
                  setDone(v.value);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "failed");
                }
              })
            }
            className={cn(buttonCls.base, v.value === "fair" ? buttonCls.default : buttonCls.default)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-[12px] text-[#ff8a8a]">
          {error}
        </span>
      )}
    </div>
  );
}
