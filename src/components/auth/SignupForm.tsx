"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AuthField,
  AuthShell,
  FormError,
  GoogleButton,
  OrDivider,
  PasswordChecklist,
  friendlyAuthError,
} from "@/components/auth/parts";
import { PillButton } from "@/components/common/PillButton";
import { emailProblem, normalizeEmail, passwordProblem } from "@/lib/credentials";
import { getSupabase } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <AuthShell
        title="check your inbox"
        subtitle={`we sent a confirmation link to ${sentTo}. open it on this device to finish creating your account.`}
        footer={
          <p className="text-[15px] text-white/80">
            already confirmed?{" "}
            <Link href="/login" className="text-brand hover:brightness-110">
              log in
            </Link>
          </p>
        }
      >
        <button type="button" onClick={() => setSentTo(null)} className="text-[14px] text-subtle hover:text-white">
          wrong email? go back
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="create your account"
      subtitle="takes a minute. your sessions and reports are saved to your profile."
      footer={
        <>
          <p className="text-[15px] text-white/80">
            already have an account?{" "}
            <Link href="/login" className="text-brand hover:brightness-110">
              log in
            </Link>
          </p>
          <p className="mt-4 text-[13px] text-subtle">by signing up you agree to the terms and privacy policy.</p>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const problem = emailProblem(email) ?? passwordProblem(password, email);
          if (problem) return setError(problem);
          setPending(true);
          setError(null);
          const { data, error: err } = await getSupabase().auth.signUp({
            email: normalizeEmail(email),
            password,
            options: {
              data: { name: name.trim() },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/setup`,
            },
          });
          if (err) {
            setError(friendlyAuthError(err.message));
            setPending(false);
            return;
          }
          // With email confirmation on, there's no session until the link is opened.
          if (!data.session) {
            setSentTo(normalizeEmail(email));
            setPending(false);
            return;
          }
          router.replace("/setup");
          router.refresh();
        }}
      >
        <AuthField
          id="name"
          label="name"
          autoComplete="given-name"
          placeholder="sam"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
        <AuthField
          id="password"
          label="password"
          type="password"
          autoComplete="new-password"
          placeholder="create a strong password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {password && <PasswordChecklist password={password} />}
        {error && <FormError>{error}</FormError>}
        <PillButton type="submit" size="lg" arrow={!pending} disabled={pending} className="mt-1 md:h-[56px]">
          {pending ? "creating your account…" : "create account"}
        </PillButton>
      </form>
      <OrDivider />
      <GoogleButton next="/setup" />
    </AuthShell>
  );
}
