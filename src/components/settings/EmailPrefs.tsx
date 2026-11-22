"use client";

import { useEffect, useState } from "react";
import { Section, SectionLabel } from "@/components/common/Layout";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** "Product emails" on/off (lms_profiles.email_opt_out). Hidden until loaded, or if the column isn't there yet. */
export function EmailPrefs({ userId }: { userId: string }) {
  const [optOut, setOptOut] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("lms_profiles")
      .select("email_opt_out")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error: e }: { data: { email_opt_out: boolean } | null; error: unknown }) => {
        if (!cancelled && !e && data) setOptOut(Boolean(data.email_opt_out));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (optOut === null) return null;
  const on = !optOut;

  return (
    <Section>
      <SectionLabel>email</SectionLabel>
      <div className="mt-2 flex items-center justify-between gap-4 py-2">
        <div>
          <div className="text-[16px]">product emails</div>
          <div className="text-[13px] text-subtle">occasional news and tips from LMS</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="product emails"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            const next = !optOut;
            const { error: e } = await getSupabase().from("lms_profiles").update({ email_opt_out: next }).eq("id", userId);
            if (e) setError("couldn't save — try again.");
            else setOptOut(next);
            setSaving(false);
          }}
          className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-brand" : "bg-surface-3")}
        >
          <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white transition-transform", on && "translate-x-5")} />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      )}
    </Section>
  );
}
