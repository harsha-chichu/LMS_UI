import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AdminNav, AdminNavLinks } from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { template: "%s · admin · LMS.", default: "admin · LMS." },
  robots: { index: false, follow: false },
};

/**
 * Checks admin access before any of the admin UI renders, so non-admins never
 * see the shell. Each page checks again (a layout alone doesn't protect pages).
 */
async function AdminShell({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 py-6 lg:px-8">
      <header className="mb-5 flex items-center justify-between gap-4">
        <Link href="/admin" className="text-[17px] font-medium tracking-tight">
          LMS<span className="text-brand">.</span> <span className="text-subtle">admin</span>
        </Link>
        <span className="hidden truncate text-[12px] text-faint lg:block">signed in as {user.email}</span>
        <Link href="/setup" className="text-[13px] text-subtle hover:text-foreground lg:hidden">
          back to app
        </Link>
      </header>
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:gap-10">
        <Suspense fallback={<AdminNavLinks path="" />}>
          <AdminNav />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
