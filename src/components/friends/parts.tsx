import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/common/UserBits";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50";

/** Small pill used for add / accept / cancel actions. */
export function Chip({
  tone = "brand",
  className,
  ...props
}: { tone?: "brand" | "muted" } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        chipBase,
        tone === "brand" ? "bg-brand text-black hover:brightness-110" : "bg-surface-2 text-white/85 hover:bg-[#2a2a2a]",
        className,
      )}
      {...props}
    />
  );
}

/** Avatar + name (+ optional detail line) with an action on the right. */
export function PersonRow({
  name,
  detail,
  href,
  children,
}: {
  name: string;
  detail?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <Avatar name={name || "?"} size={36} />
      <span className="min-w-0">
        <span className="block truncate text-[16px]">{name || "unnamed"}</span>
        {detail && <span className="mt-0.5 block text-[13px] text-subtle">{detail}</span>}
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:text-white/80">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {children}
    </li>
  );
}
