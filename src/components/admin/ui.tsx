import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { AdminSelect } from "@/components/admin/inputs";
import { cn } from "@/lib/utils";

/** Status colours from the dataviz status palette; always shown with an icon and a label. */
const STATUS = {
  good: { color: "#0ca30c", Icon: CheckCircle2 },
  warning: { color: "#fab219", Icon: AlertTriangle },
  critical: { color: "#d03b3b", Icon: XCircle },
  neutral: { color: "#8c8c8c", Icon: CircleDashed },
} as const;
export type StatusTone = keyof typeof STATUS;

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-medium tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-subtle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  note,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-[18px] bg-surface p-5", className)}>
      {(title || note) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[13px] text-subtle">{title}</h2>}
          {note && <div className="text-right text-[12px] text-faint">{note}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  tone?: StatusTone;
}) {
  const body = (
    <>
      <div className="text-[12px] text-subtle">{label}</div>
      <div className="mt-1.5 flex items-center gap-2 text-[26px] font-medium tabular-nums leading-none">
        {tone && <StatusIcon tone={tone} />}
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-faint">{sub}</div>}
    </>
  );
  const cls = "block rounded-[18px] bg-surface p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}

export function StatusIcon({ tone }: { tone: StatusTone }) {
  const { color, Icon } = STATUS[tone];
  return <Icon className="size-[0.8em] shrink-0" style={{ color }} aria-hidden />;
}

export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <StatusIcon tone={tone} />
      <span>{children}</span>
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "brand" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap",
        tone === "brand" && "bg-bubble text-brand",
        tone === "default" && "bg-surface-3 text-foreground/85",
        tone === "muted" && "bg-surface-2 text-subtle",
      )}
    >
      {children}
    </span>
  );
}

/** A horizontally scrollable table that never widens the page. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-subtle">
            {head.map((h, i) => (
              <th key={i} scope="col" className="py-2 pr-4 font-normal whitespace-nowrap last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <EmptyState>nothing here yet.</EmptyState>}
    </div>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b border-line/70 align-top last:border-0", className)}>{children}</tr>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("py-2.5 pr-4 last:pr-0", className)}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[13px] text-subtle">{children}</p>;
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("text-foreground underline decoration-line underline-offset-4 hover:decoration-brand", className)}>
      {children}
    </Link>
  );
}

type Params = Record<string, string | undefined>;

export function withParams(path: string, params: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Segmented links that set one search param, keeping the others. */
export function ParamTabs({
  path,
  params,
  name,
  options,
  value,
}: {
  path: string;
  params: Params;
  name: string;
  options: { value: string; label: string }[];
  value: string;
}) {
  return (
    <nav aria-label={name} className="inline-flex rounded-full bg-surface p-1 text-[13px]">
      {options.map((o) => (
        <Link
          key={o.value}
          href={withParams(path, { ...params, [name]: o.value || undefined, page: undefined })}
          aria-current={o.value === value ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-subtle transition-colors hover:text-foreground",
            o.value === value && "bg-surface-3 text-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

export function RangeTabs({ path, params, days }: { path: string; params: Params; days: number }) {
  return (
    <ParamTabs
      path={path}
      params={params}
      name="range"
      value={String(days)}
      options={[
        { value: "7", label: "7 days" },
        { value: "30", label: "30 days" },
        { value: "90", label: "90 days" },
      ]}
    />
  );
}

export function Pager({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string;
  params: Params;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-4 text-[12px] text-faint">{total} total</p>;
  const link = (p: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="rounded-full px-3 py-1.5 text-faint">{label}</span>
    ) : (
      <Link href={withParams(path, { ...params, page: String(p) })} className="rounded-full bg-surface-2 px-3 py-1.5 hover:bg-surface-3">
        {label}
      </Link>
    );
  return (
    <div className="mt-4 flex items-center justify-between text-[13px]">
      <span className="text-[12px] text-faint">
        page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {link(page - 1, "previous", page <= 1)}
        {link(page + 1, "next", page >= pages)}
      </div>
    </div>
  );
}

const fieldCls =
  "h-9 rounded-full border border-line bg-surface-2 px-3 text-[13px] text-foreground outline-none focus-visible:border-brand";

/** A plain GET form, so filters work without JavaScript and live in the URL. */
export function FilterBar({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      <button type="submit" className="h-9 rounded-full bg-surface-3 px-4 text-[13px] hover:bg-surface-2">
        apply
      </button>
    </form>
  );
}

export function FilterSearch({ name, defaultValue, placeholder }: { name: string; defaultValue?: string; placeholder: string }) {
  return (
    <input
      type="search"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(fieldCls, "w-full min-w-0 sm:w-64")}
    />
  );
}

export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <AdminSelect name={name} defaultValue={value ?? ""} aria-label={label} className={fieldCls}>
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </AdminSelect>
  );
}

export { inputCls } from "@/components/admin/inputs";

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-[18px] bg-surface" />
      ))}
    </div>
  );
}

/** Key / value list for detail pages. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[12px] text-subtle">{i.label}</dt>
          <dd className="mt-0.5 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
