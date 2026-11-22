"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch, buttonCls } from "@/components/admin/actions";
import { AdminSelect, inputCls } from "@/components/admin/inputs";
import { cn } from "@/lib/utils";

type Audience = "contact_ok" | "inactive" | "all" | "one";
type DryRun = { recipients: number; sample: string[]; configured: boolean };
type Sent = { recipients: number; sent: number; failed: number; errors?: string[] };

const label = "flex flex-col gap-1 text-[12px] text-subtle";

/** Write an email, preview who gets it, then send. */
export function EmailComposer({ configured, defaultUserId }: { configured: boolean; defaultUserId?: string }) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>(defaultUserId ? "one" : "contact_ok");
  const [days, setDays] = useState(14);
  const [userId, setUserId] = useState(defaultUserId ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<DryRun | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const payload = (dryRun: boolean) => ({ audience, days, userId: audience === "one" ? userId.trim() : undefined, subject, body, dryRun });
  const reset = () => {
    setPreview(null);
    setSent(null);
  };

  const run = (dryRun: boolean) =>
    start(async () => {
      setError(null);
      try {
        const out = await adminFetch("/api/admin/email", "POST", payload(dryRun));
        if (dryRun) setPreview(out as unknown as DryRun);
        else {
          setSent(out as unknown as Sent);
          setPreview(null);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed");
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>
          send to
          <AdminSelect wrapperClassName="w-full"
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as Audience);
              reset();
            }}
            className={inputCls}
          >
            <option value="contact_ok">people who said ok to contact (feedback)</option>
            <option value="inactive">people inactive for a while</option>
            <option value="all">everyone (except opted out)</option>
            <option value="one">one user</option>
          </AdminSelect>
        </label>
        {audience === "inactive" && (
          <label className={label}>
            no session in the last … days
            <input type="number" min={1} max={365} value={days} onChange={(e) => (setDays(Number(e.target.value)), reset())} className={inputCls} />
          </label>
        )}
        {audience === "one" && (
          <label className={label}>
            user id (copy it from their page)
            <input value={userId} onChange={(e) => (setUserId(e.target.value), reset())} placeholder="00000000-0000-…" className={inputCls} />
          </label>
        )}
      </div>
      <label className={label}>
        subject
        <input value={subject} onChange={(e) => (setSubject(e.target.value), reset())} maxLength={150} className={inputCls} />
      </label>
      <label className={label}>
        message (plain text; &quot;Hi name,&quot; is added for you)
        <textarea value={body} onChange={(e) => (setBody(e.target.value), reset())} rows={8} maxLength={10000} className={inputCls} />
      </label>
      <p className="text-[12px] text-faint">
        People who turned off product emails are skipped (except a message to one user), and each email ends with how to turn them off.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || !subject.trim() || !body.trim()} onClick={() => run(true)} className={cn(buttonCls.base, buttonCls.default)}>
          {pending && !preview ? "checking…" : "preview recipients"}
        </button>
        {preview && preview.recipients > 0 && (
          <button
            type="button"
            disabled={pending || !configured}
            onClick={() => {
              if (window.confirm(`Send "${subject}" to ${preview.recipients} ${preview.recipients === 1 ? "person" : "people"}?`)) run(false);
            }}
            className={cn(buttonCls.base, buttonCls.primary)}
          >
            {pending ? "sending…" : `send to ${preview.recipients}`}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      )}
      {preview && (
        <p role="status" className="text-[13px]">
          {preview.recipients === 0
            ? "nobody matches this audience."
            : `${preview.recipients} recipient${preview.recipients === 1 ? "" : "s"}, e.g. ${preview.sample.join(", ")}${preview.recipients > preview.sample.length ? ", …" : ""}`}
          {!preview.configured && <span className="block text-[#fab219]">email isn&apos;t set up yet — add RESEND_API_KEY and EMAIL_FROM to send.</span>}
        </p>
      )}
      {sent && (
        <p role="status" className="text-[13px]">
          sent {sent.sent} of {sent.recipients}
          {sent.failed > 0 && <span className="text-[#ff8a8a]"> · {sent.failed} failed: {sent.errors?.join("; ")}</span>}
        </p>
      )}
    </div>
  );
}
