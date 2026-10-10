"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthShell, FormError, GoogleButton, OrDivider, friendlyAuthError, safeNext } from "@/components/auth/parts";
import { PillButton } from "@/components/common/PillButton";
import { getSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "that link has expired or was already used — try again." : null,
  );

  return (
    <AuthShell
      title="welcome back"
      subtitle="log in to pick up where you left off."
      footer={
        <p className="text-[15px] text-white/80">
          new here?{" "}
          <Link href="/signup" className="text-brand hover:brightness-110">
            create an account
          </Link>
        </p>
      }
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const { error: err } = await getSupabase().auth.signInWithPassword({ email, password });
          if (err) {
            setError(friendlyAuthError(err.message));
            setPending(false);
            return;
          }
          router.replace(next);
          router.refresh();
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
        <AuthField
          id="password"
          label="password"
          type="password"
          autoComplete="current-password"
          placeholder="your password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aside={
            <Link href="/forgot-password" className="text-[14px] text-subtle hover:text-white">
              forgot password?
            </Link>
          }
        />
        {error && <FormError>{error}</FormError>}
        <PillButton type="submit" size="lg" arrow={!pending} disabled={pending} className="mt-1 md:h-[56px]">
          {pending ? "logging in…" : "log in"}
        </PillButton>
      </form>
      <OrDivider />
      <GoogleButton next={next} />
    </AuthShell>
  );
}
