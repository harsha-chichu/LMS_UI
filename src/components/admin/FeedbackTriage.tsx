"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch, buttonCls } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";
import { cn } from "@/lib/utils";

/** Status switch and private note for one feedback item. */
export function FeedbackTriage({ id, status, note }: { id: string; status: string; note: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = (changes: { status?: string; adminNote?: string }) =>
    start(async () => {
      setError(null);
      try {
        await adminFetch(`/api/admin/feedback/${id}`, "PATCH", changes);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed");
      }
    });

  return (
    <div className="flex min-w-[14rem] flex-col gap-2">
      <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-[12px]">
        {(["new", "triaged", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            aria-pressed={status === s}
            onClick={() => save({ status: s })}
            className={cn("flex-1 rounded-full px-2.5 py-1 text-subtle hover:text-foreground", status === s && "bg-surface-3 text-foreground")}
          >
            {s}
          </button>
        ))}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="private note"
        aria-label="private note"
        className={cn(inputCls, "text-[13px]")}
      />
      {draft !== (note ?? "") && (
        <button type="button" disabled={pending} onClick={() => save({ adminNote: draft })} className={cn(buttonCls.base, buttonCls.default, "h-8 self-start")}>
          save note
        </button>
      )}
      {error && (
        <span role="alert" className="text-[12px] text-[#ff8a8a]">
          {error}
        </span>
      )}
    </div>
  );
}
