import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MfaSetup } from "@/components/admin/MfaSetup";
import { requireAdminForMfa } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "two-factor sign-in · admin · LMS.", robots: { index: false, follow: false } };

/** Two-factor sign-in, required before the admin dashboard opens. */
export default function AdminMfaPage() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 py-12">
      <Link href="/admin" className="text-[17px] font-medium tracking-tight">
        LMS<span className="text-brand">.</span> <span className="text-subtle">admin</span>
      </Link>
      <Suspense fallback={<div className="mt-10 h-64 animate-pulse rounded-[18px] bg-surface" />}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  const me = await requireAdminForMfa();
  if (me.step === "ok") redirect("/admin");
  return (
    <section className="mt-10 rounded-[18px] bg-surface p-6">
      <h1 className="text-[20px] font-medium">{me.step === "enroll" ? "set up two-factor sign-in" : "confirm it's you"}</h1>
      <p className="mt-1 mb-6 text-[13px] text-subtle">
        {me.step === "enroll"
          ? "Admin accounts need a second step at sign-in. It takes a minute, once."
          : "Admin access needs your authenticator code once per sign-in."}
      </p>
      <MfaSetup step={me.step} />
      <p className="mt-6 text-[12px] text-faint">
        signed in as {me.user.email} · <Link href="/setup" className="underline underline-offset-4">back to app</Link>
      </p>
    </section>
  );
}
