"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch, buttonCls } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";
import { cn } from "@/lib/utils";

/** On/off switch with a user-facing message for one lms_app_settings key. */
export function SettingToggle({
  settingKey,
  title,
  help,
  enabled,
  message,
}: {
  settingKey: "maintenance" | "sessions_paused";
  title: string;
  help: string;
  enabled: boolean;
  message: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(message);
  const [error, setError] = useState<string | null>(null);

  const save = (next: boolean) => {
    if (next && !window.confirm(`Turn on "${title}" for every user?`)) return;
    start(async () => {
      setError(null);
      try {
        await adminFetch("/api/admin/settings", "POST", { key: settingKey, enabled: next, message: draft });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px]">{title}</div>
          <div className="text-[12px] text-subtle">{help}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          disabled={pending}
          onClick={() => save(!enabled)}
          className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", enabled ? "bg-brand" : "bg-surface-3")}
        >
          <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white transition-transform", enabled && "translate-x-5")} />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder="message shown to users (optional)"
          aria-label={`${title} message`}
          className={cn(inputCls, "text-[13px]")}
        />
        {draft !== message && (
          <button type="button" disabled={pending} onClick={() => save(enabled)} className={cn(buttonCls.base, buttonCls.default)}>
            save
          </button>
        )}
      </div>
      {error && (
        <span role="alert" className="text-[12px] text-[#ff8a8a]">
          {error}
        </span>
      )}
    </div>
  );
}
