"use client";

import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PASSWORD_RULES } from "@/lib/credentials";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Back chevron + centred logo + the 520px column, as in the log in / sign up designs. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  back = "/",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[464px] flex-col px-5 pb-8 md:px-0">
      <header className="relative flex h-20 items-center justify-center md:h-24">
        <Link
          href={back}
          aria-label="Back"
          className="absolute left-0 -ml-2 rounded-full p-2 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <Logo />
      </header>
      <main className="flex flex-1 flex-col">
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight md:mt-8 md:text-[30px]">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/75">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </main>
      {footer && <footer className="mt-12 text-center">{footer}</footer>}
    </div>
  );
}

export function AuthField({
  label,
  aside,
  className,
  id,
  ...props
}: { label: string; aside?: ReactNode; id: string } & ComponentProps<"input">) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] text-white/90">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={id}
        className="h-[52px] w-full rounded-2xl border border-white/15 bg-transparent px-4 text-[16px] text-white outline-none transition-colors placeholder:text-faint focus:border-brand"
        {...props}
      />
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4 text-[13px] text-subtle" role="separator">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const { error: err } = await getSupabase().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          });
          if (err) {
            setError(friendlyAuthError(err.message));
            setPending(false);
          }
        }}
        className="h-[52px] w-full rounded-full border border-white/15 text-[16px] font-medium transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
      >
        {pending ? "redirecting to google…" : "continue with google"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] text-brand">
          {error}
        </p>
      )}
    </>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[14px] text-brand">
      {children}
    </p>
  );
}

/** The password rules, ticked off as the user types. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]" aria-label="password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className={cn("flex items-center gap-1.5", ok ? "text-white/90" : "text-subtle")}>
            <Check className={cn("size-3.5 shrink-0", ok ? "text-brand" : "opacity-30")} strokeWidth={2} />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Supabase messages are sentence-case and sometimes cryptic; keep the product voice. */
export function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "that email and password don't match.";
  if (m.includes("email not confirmed")) return "confirm your email first — check your inbox for the link.";
  if (m.includes("already registered")) return "an account with that email already exists — log in instead.";
  if (m.includes("provider is not enabled")) return "google sign-in isn't set up yet — use email for now.";
  if (m.includes("rate limit")) return "too many attempts — wait a minute and try again.";
  if (m.includes("pwned") || m.includes("known to be weak") || m.includes("easy to guess"))
    return "that password has shown up in a data breach — pick a different one.";
  if (m.includes("password should contain") || m.includes("password should be at least"))
    return "that password is too weak — use upper and lowercase letters, a number and a symbol.";
  if (m.includes("same as the old") || m.includes("different from the old")) return "pick a password you haven't used here before.";
  if (m.includes("password")) return m;
  if (m.includes("email") && (m.includes("invalid") || m.includes("not authorized") || m.includes("validate")))
    return "enter a valid email address, like you@example.com.";
  return "something went wrong — try again.";
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/setup";
}
