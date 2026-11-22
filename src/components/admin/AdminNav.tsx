"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Bot,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ScrollText,
  Server,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ADMIN_LINKS = [
  { href: "/admin", label: "overview", Icon: LayoutDashboard },
  { href: "/admin/users", label: "users", Icon: Users },
  { href: "/admin/sessions", label: "sessions", Icon: Activity },
  { href: "/admin/questions", label: "questions", Icon: BookOpen },
  { href: "/admin/feedback", label: "feedback", Icon: MessageSquare },
  { href: "/admin/ai", label: "ai & scoring", Icon: Bot },
  { href: "/admin/system", label: "system", Icon: Server },
  { href: "/admin/announcements", label: "announcements", Icon: Megaphone },
  { href: "/admin/audit", label: "audit log", Icon: ScrollText },
] as const;

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
}

/** Sidebar on desktop, a scrollable tab strip on phones. */
export function AdminNav() {
  return <AdminNavLinks path={usePathname()} />;
}

/** The nav without an active item: the static shell shown until the URL is known. */
export function AdminNavLinks({ path }: { path: string }) {
  return (
    <>
      <nav aria-label="admin" className="hidden w-52 shrink-0 flex-col gap-0.5 lg:flex">
        {ADMIN_LINKS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-2 text-[14px] text-subtle transition-colors hover:text-foreground",
              isActive(path, href) && "bg-surface text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
        <Link href="/setup" className="mt-6 flex items-center gap-3 px-4 py-2 text-[13px] text-faint hover:text-subtle">
          <ArrowLeft className="size-4" aria-hidden />
          back to app
        </Link>
      </nav>
      <nav aria-label="admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-4 lg:hidden">
        {ADMIN_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] text-subtle",
              isActive(path, href) ? "bg-surface-3 text-foreground" : "bg-surface",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
