import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="LMS home"
      className={cn("text-xl font-semibold tracking-tight text-white", className)}
    >
      LMS<span className="text-brand">.</span>
    </Link>
  );
}
