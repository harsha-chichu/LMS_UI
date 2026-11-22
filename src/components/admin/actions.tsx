"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export async function adminFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `request failed (${res.status})`);
  return data;
}

export const buttonCls = {
  base: "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand",
  default: "bg-surface-3 hover:bg-surface-2",
  primary: "bg-brand text-primary-foreground font-medium hover:brightness-110",
  danger: "bg-[#3a1515] text-[#ff8a8a] hover:bg-[#4a1a1a]",
};

/**
 * Calls an admin API, after a confirm for anything destructive, then refreshes
 * the server-rendered page. `confirmText` set → the admin must type it first.
 */
export function ActionButton({
  url,
  method = "POST",
  body,
  children,
  confirm,
  confirmText,
  variant = "default",
  redirectTo,
  disabled,
}: {
  url: string;
  method?: string;
  body?: unknown;
  children: ReactNode;
  confirm?: string;
  confirmText?: string;
  variant?: "default" | "primary" | "danger";
  redirectTo?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (confirmText) {
      const typed = window.prompt(`${confirm ?? "Are you sure?"}\n\nType "${confirmText}" to confirm.`);
      if (typed?.trim() !== confirmText) return;
    } else if (confirm && !window.confirm(confirm)) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await adminFetch(url, method, body);
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed");
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={pending || disabled} className={cn(buttonCls.base, buttonCls[variant])}>
        {pending ? "working…" : children}
      </button>
      {error && (
        <span role="alert" className="text-[12px] text-[#ff8a8a]">
          {error}
        </span>
      )}
    </span>
  );
}

/** Wraps a form whose fields are sent as JSON to an admin API. */
export function JsonForm({
  url,
  method = "POST",
  children,
  submitLabel,
  className,
  transform,
  resetOnSuccess,
}: {
  url: string;
  method?: string;
  children: ReactNode;
  submitLabel: string;
  className?: string;
  /** Turns the form's fields into the request body. */
  transform?: (fields: Record<string, string>) => unknown;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const fields: Record<string, string> = {};
        fd.forEach((v, k) => {
          if (typeof v === "string") fields[k] = v;
        });
        setError(null);
        setSaved(false);
        start(async () => {
          try {
            await adminFetch(url, method, transform ? transform(fields) : fields);
            if (resetOnSuccess) form.reset();
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "failed");
          }
        });
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={cn(buttonCls.base, buttonCls.primary)}>
          {pending ? "saving…" : submitLabel}
        </button>
        {saved && !pending && <span className="text-[12px] text-subtle">saved</span>}
        {error && (
          <span role="alert" className="text-[12px] text-[#ff8a8a]">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
