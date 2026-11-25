"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch, buttonCls } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";
import { cn } from "@/lib/utils";
import { DEFAULT_WELCOME_TITLE, personalize, type WelcomeSetting } from "@/lib/welcome";

const label = "flex flex-col gap-1 text-[12px] text-subtle";

/** Edits the welcome note (popup + email) with a live preview. */
export function WelcomeForm({ initial, emailReady }: { initial: WelcomeSetting; emailReady: boolean }) {
  const router = useRouter();
  const [w, setW] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof WelcomeSetting>(k: K, v: WelcomeSetting[K]) => {
    setSaved(false);
    setW((prev) => ({ ...prev, [k]: v }));
  };

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        await adminFetch("/api/admin/config", "POST", { key: "welcome", value: w });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className={label}>
          title
          <input value={w.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder={DEFAULT_WELCOME_TITLE} className={inputCls} />
        </label>
        <label className={label}>
          message
          <textarea
            value={w.body}
            onChange={(e) => set("body", e.target.value)}
            maxLength={5000}
            rows={9}
            placeholder="Hi {name}, thanks for signing up! …"
            className={cn(inputCls, "resize-y leading-relaxed")}
          />
          <span className="text-faint">
            {"{name}"} becomes the user&apos;s first name. {w.body.length}/5000
          </span>
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={w.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-[var(--brand)]" />
          send the welcome note to new users
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={w.sendEmail} onChange={(e) => set("sendEmail", e.target.checked)} className="size-4 accent-[var(--brand)]" />
          also email it
          {!emailReady && <span className="text-[12px] text-faint">(email isn&apos;t set up: RESEND_API_KEY / EMAIL_FROM)</span>}
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={cn(buttonCls.base, buttonCls.primary)}>
            {pending ? "saving…" : "save welcome note"}
          </button>
          {saved && !pending && <span className="text-[12px] text-subtle">saved</span>}
          {error && (
            <span role="alert" className="text-[12px] text-[#ff8a8a]">
              {error}
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-subtle">preview (as “Alex Smith”)</span>
        <div className="rounded-[20px] border border-line bg-surface-2 p-6">
          <h3 className="text-[20px] font-medium">{personalize(w.title.trim() || DEFAULT_WELCOME_TITLE, "Alex Smith")}</h3>
          <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-line text-foreground/85">
            {w.body.trim() ? personalize(w.body, "Alex Smith") : <span className="text-faint">your message will appear here.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
