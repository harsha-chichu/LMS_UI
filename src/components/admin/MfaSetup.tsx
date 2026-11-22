"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonCls } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Factor = { id: string; status: string; factor_type: string };
type Enrollment = { factorId: string; qr: string; secret: string };

/**
 * Two-factor sign-in for admins, with an authenticator app (TOTP, built into
 * Supabase Auth). "enroll": scan a QR code, then enter a code. "verify": enter
 * a code from the app already set up.
 */
export function MfaSetup({ step }: { step: "enroll" | "verify" }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return !cancelled && setError(listError.message);
      if (step === "verify") {
        const f = data.totp.find((x: Factor) => x.status === "verified");
        if (!cancelled) setFactorId(f?.id ?? null);
        return;
      }
      // A half-finished setup from earlier would block a new one.
      for (const f of data.all.filter((x: Factor) => x.factor_type === "totp" && x.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `LMS admin ${new Date().toISOString().slice(0, 10)}` });
      if (cancelled) return;
      if (enrollError) return setError(`${enrollError.message} — check that TOTP is enabled under Authentication → Multi-factor in Supabase.`);
      setEnrollment({ factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret });
      setFactorId(en.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const verify = () =>
    start(async () => {
      if (!factorId) return;
      setError(null);
      const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
      if (verifyError) {
        setError(verifyError.message.includes("Invalid") ? "that code didn't match — try the newest one from your app." : verifyError.message);
        return;
      }
      router.replace("/admin");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {step === "enroll" && (
        <div className="flex flex-col gap-3 text-[14px]">
          <p>1. Open an authenticator app (Google Authenticator, 1Password, Authy…) and scan this code.</p>
          {enrollment ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL */}
              <img src={enrollment.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-[12px] bg-white p-2" />
              <p className="text-[12px] text-subtle">
                Can&apos;t scan? Enter this key instead: <code className="break-all text-foreground">{enrollment.secret}</code>
              </p>
            </>
          ) : (
            !error && <div className="size-[180px] animate-pulse rounded-[12px] bg-surface-2" aria-label="loading QR code" />
          )}
          <p>2. Enter the 6-digit code it shows.</p>
        </div>
      )}
      {step === "verify" && <p className="text-[14px]">Enter the 6-digit code from your authenticator app.</p>}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          placeholder="123456"
          aria-label="6-digit code"
          className={cn(inputCls, "w-40 text-center text-[18px] tracking-[0.3em]")}
          autoFocus
        />
        <button type="submit" disabled={pending || !factorId} className={cn(buttonCls.base, buttonCls.primary, "h-11")}>
          {pending ? "checking…" : "verify"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[13px] text-[#ff8a8a]">
          {error}
        </p>
      )}
    </div>
  );
}
