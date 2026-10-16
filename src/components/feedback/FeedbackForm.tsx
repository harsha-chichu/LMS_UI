"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Category = "idea" | "problem" | "praise" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "idea", label: "an idea" },
  { value: "problem", label: "something isn't working" },
  { value: "praise", label: "something you liked" },
  { value: "other", label: "something else" },
];

const RATING_LABELS = ["not useful", "a little useful", "okay", "useful", "very useful"];

/** Reusable signed-in product-feedback form for Settings and completed reports. */
export function FeedbackForm({
  sessionId,
  reportContext = false,
  className,
}: {
  sessionId?: string;
  /** Uses report-focused copy and sensible initial values after a completed session. */
  reportContext?: boolean;
  className?: string;
}) {
  const [category, setCategory] = useState<Category>("idea");
  const [rating, setRating] = useState(reportContext ? 3 : 4);
  const [message, setMessage] = useState("");
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = message.trim();
    if (!text) {
      setError("tell us what happened or what you'd improve.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, rating, message: text, followUpConsent, sessionId }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "couldn't send feedback");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't send feedback. try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className={cn("rounded-2xl border border-line bg-white/[0.03] p-5", className)} role="status">
        <p className="text-[16px] font-medium">thanks — your feedback was sent.</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-subtle">it helps shape what we improve next.</p>
      </div>
    );
  }

  const title = reportContext ? "was this session useful?" : "send feedback";
  const description = reportContext
    ? "tell us what helped or what you’d improve about this session and report."
    : "tell us what’s working, missing, or getting in your way.";

  return (
    <form
      className={cn("rounded-2xl border border-line bg-white/[0.03] p-5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-[17px] font-medium">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-subtle">{description}</p>

      <label className="mt-5 block">
        <span className="text-[13px] text-subtle">what is this about?</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          className="mt-2 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand"
        >
          {CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-5">
        <legend className="text-[13px] text-subtle">how useful was LMS?</legend>
        <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="How useful was LMS?">
          {RATING_LABELS.map((label, index) => {
            const value = index + 1;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} out of 5 — ${label}`}
                onClick={() => setRating(value)}
                className={cn(
                  "h-10 rounded-xl border text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                  rating === value
                    ? "border-brand bg-brand/15 text-white"
                    : "border-line bg-surface-2 text-subtle hover:text-white",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-subtle">{RATING_LABELS[rating - 1]}</p>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-[13px] text-subtle">tell us what happened or what you’d improve</span>
        <textarea
          required
          rows={4}
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="the more specific, the more helpful it is."
          className="mt-2 w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-3 text-[15px] leading-relaxed outline-none placeholder:text-subtle focus:ring-2 focus:ring-brand"
        />
      </label>

      <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed text-white/80">
        <input
          type="checkbox"
          checked={followUpConsent}
          onChange={(event) => setFollowUpConsent(event.target.checked)}
          className="mt-1 size-4 accent-[var(--brand)]"
        />
        <span>you can contact me about this</span>
      </label>

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-brand">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 h-10 rounded-full bg-brand px-5 text-[14px] font-medium text-black transition-[filter,opacity] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
      >
        {pending ? "sending…" : "send feedback"}
      </button>
    </form>
  );
}
