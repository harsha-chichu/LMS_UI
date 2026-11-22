"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpen,
  Bot,
  Bug,
  CheckCheck,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  ScrollText,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; Icon: LucideIcon };

export const ADMIN_GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "monitor",
    links: [
      { href: "/admin", label: "overview", Icon: LayoutDashboard },
      { href: "/admin/ai", label: "ai & scoring", Icon: Bot },
      { href: "/admin/errors", label: "errors", Icon: Bug },
      { href: "/admin/alerts", label: "alerts", Icon: Bell },
      { href: "/admin/system", label: "system", Icon: Server },
    ],
  },
  {
    label: "people",
    links: [
      { href: "/admin/users", label: "users", Icon: Users },
      { href: "/admin/sessions", label: "sessions", Icon: Activity },
      { href: "/admin/feedback", label: "feedback", Icon: MessageSquare },
      { href: "/admin/email", label: "email", Icon: Mail },
      { href: "/admin/announcements", label: "announcements", Icon: Megaphone },
    ],
  },
  {
    label: "content",
    links: [
      { href: "/admin/questions", label: "questions", Icon: BookOpen },
      { href: "/admin/quality", label: "quality", Icon: CheckCheck },
      { href: "/admin/audit", label: "audit log", Icon: ScrollText },
    ],
  },
];

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
      <nav aria-label="admin" className="hidden w-52 shrink-0 flex-col lg:flex">
        {ADMIN_GROUPS.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="px-4 pb-1 text-[11px] tracking-wide text-faint uppercase">{g.label}</div>
            {g.links.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(path, href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-1.5 text-[14px] text-subtle transition-colors hover:text-foreground",
                  isActive(path, href) && "bg-surface text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        ))}
        <Link href="/setup" className="mt-2 flex items-center gap-3 px-4 py-2 text-[13px] text-faint hover:text-subtle">
          <ArrowLeft className="size-4" aria-hidden />
          back to app
        </Link>
      </nav>
      <nav aria-label="admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-4 lg:hidden">
        {ADMIN_GROUPS.flatMap((g) => g.links).map(({ href, label }) => (
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
