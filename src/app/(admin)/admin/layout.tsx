import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { AdminNav, AdminNavLinks } from "@/components/admin/AdminNav";
import { Badge } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { template: "%s · admin · LMS.", default: "admin · LMS." },
  robots: { index: false, follow: false },
};

/**
 * Checks admin access (and two-factor sign-in) before any admin UI renders, so
 * others never see the shell. Each page checks again (a layout alone doesn't protect pages).
 */
async function AdminShell({ children }: { children: ReactNode }) {
  const { user, access } = await requireAdminPage();
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 py-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link href="/admin" className="text-[17px] font-medium tracking-tight">
          LMS<span className="text-brand">.</span> <span className="text-subtle">admin</span>
        </Link>
        {access === "support" && <Badge>support · read-only</Badge>}
        <form action="/admin/search" method="get" role="search" className="order-last w-full sm:order-none sm:ml-auto sm:w-72">
          <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] focus-within:border-brand">
            <Search className="size-4 shrink-0 text-subtle" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="search users, sessions, questions"
              aria-label="search users, sessions and questions"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-faint"
            />
          </label>
        </form>
        <span className="hidden max-w-[14rem] truncate text-[12px] text-faint xl:block">{user.email}</span>
        <Link href="/setup" className="ml-auto text-[13px] text-subtle hover:text-foreground sm:ml-0 lg:hidden">
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
