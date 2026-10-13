"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthShell, FormError, PasswordChecklist, friendlyAuthError } from "@/components/auth/parts";
import { passwordProblem } from "@/lib/credentials";
import { PillButton } from "@/components/common/PillButton";
import { getSupabase } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <AuthShell
      back="/login"
      title={sent ? "check your inbox" : "reset your password"}
      subtitle={
        sent
          ? `if an account exists for ${email}, a reset link is on its way.`
          : "enter your email and we'll send you a link to set a new password."
      }
      footer={
        <Link href="/login" className="text-[15px] text-brand hover:brightness-110">
          back to log in
        </Link>
      }
    >
      {!sent && (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const { error: err } = await getSupabase().auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });
            setPending(false);
            if (err) setError(friendlyAuthError(err.message));
            else setSent(true);
          }}
        >
          <AuthField
            id="email"
            label="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <FormError>{error}</FormError>}
          <PillButton type="submit" size="lg" arrow={!pending} disabled={pending} className="md:h-[56px]">
            {pending ? "sending…" : "send reset link"}
          </PillButton>
        </form>
      )}
    </AuthShell>
  );
}

/** Reached from the reset email via /auth/callback, which signs the user in first. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell back="/setup" title="set a new password" subtitle="choose something you haven't used here before.">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const problem = passwordProblem(password);
          if (problem) return setError(problem);
          setPending(true);
          setError(null);
          const { error: err } = await getSupabase().auth.updateUser({ password });
          if (err) {
            setError(friendlyAuthError(err.message));
            setPending(false);
            return;
          }
          router.replace("/setup");
        }}
      >
        <AuthField
          id="password"
          label="new password"
          type="password"
          autoComplete="new-password"
          placeholder="create a strong password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {password && <PasswordChecklist password={password} />}
        {error && <FormError>{error}</FormError>}
        <PillButton type="submit" size="lg" arrow={!pending} disabled={pending} className="md:h-[56px]">
          {pending ? "saving…" : "save password"}
        </PillButton>
      </form>
    </AuthShell>
  );
}
