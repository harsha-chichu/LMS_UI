"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardHead } from "@/components/common/Layout";
import { domainShort } from "@/lib/constants";
import { dayKey } from "@/lib/dates";
import { activityFromSessions, heatmap, longestStreak } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { SessionConfig } from "@/types";

const LEVEL_CLASS = ["bg-(--heat-0)", "bg-(--heat-1)", "bg-(--heat-2)", "bg-(--heat-3)", "bg-brand"];

interface DaySession {
  id: string;
  total: number;
  completed_at: string;
  config: SessionConfig;
}

const plural = (n: number) => `${n} session${n === 1 ? "" : "s"}`;
const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }).toLowerCase();

/** Six months of sessions per day. Tap a day to list its sessions; today is open to start with. */
export function ActivityHeatmap({ sessions, reportHref }: { sessions: DaySession[]; reportHref: (id: string) => string }) {
  const activity = useMemo(() => activityFromSessions(sessions), [sessions]);
  const { columns, months, total } = heatmap(activity);
  const longest = longestStreak(activity);

  const today = dayKey(new Date());
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? today;
  const onDay = sessions.filter((s) => dayKey(new Date(s.completed_at)) === selected);

  return (
    <Card>
      <CardHead label="activity">{plural(total)} in the last 6 months</CardHead>

      <div className="mt-4" style={{ "--cols": columns.length } as React.CSSProperties}>
        <div className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-[3px] text-[10px] text-subtle md:text-[11px]">
          {months.map((m) => (
            <span key={`${m.col}-${m.label}`} style={{ gridColumnStart: m.col + 1 }} className="col-span-3 leading-none">
              {m.label}
            </span>
          ))}
        </div>
        <div
          className="mt-2 grid grid-flow-col grid-cols-[repeat(var(--cols),minmax(0,1fr))] grid-rows-7 gap-[3px]"
          role="group"
          aria-label={`${plural(total)} in the last 6 months, by day`}
        >
          {columns.flatMap((col, w) =>
            col.map((cell, d) =>
              cell ? (
                <button
                  key={cell.key}
                  type="button"
                  aria-pressed={cell.key === selected}
                  aria-label={`${dayLabel(cell.key)}, ${plural(cell.count)}`}
                  title={`${dayLabel(cell.key)}: ${plural(cell.count)}`}
                  onClick={() => setPicked(cell.key)}
                  className={cn(
                    "aspect-square rounded-[3px] outline-offset-1 hover:outline hover:outline-1 hover:outline-subtle focus-visible:outline-2 focus-visible:outline-brand",
                    LEVEL_CLASS[cell.level],
                    cell.key === selected && "outline outline-[1.5px] outline-foreground hover:outline-foreground",
                  )}
                />
              ) : (
                <span key={`empty-${w}-${d}`} className="aspect-square" />
              ),
            ),
          )}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between text-[12px] text-subtle">
        <span className="tabular-nums">
          longest streak · {longest} day{longest === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5">
          less
          {LEVEL_CLASS.map((c) => (
            <span key={c} className={cn("size-2.5 rounded-[2px]", c)} />
          ))}
          more
        </span>
      </div>

      <div className="mt-3.5 rounded-[14px] bg-surface-2 px-3.5 py-3" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <p className="font-medium">
            {dayLabel(selected)}
            {selected === today && " · today"}
          </p>
          <p className="text-subtle tabular-nums">{onDay.length ? plural(onDay.length) : "no sessions"}</p>
        </div>
        {onDay.length > 0 && (
          <ul className="-mx-1.5 mt-1.5 -mb-1">
            {onDay.map((s) => (
              <li key={s.id}>
                <Link
                  href={reportHref(s.id)}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[14px] text-foreground/85 transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {domainShort(s.config.domain)} · {s.config.difficulty}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">{s.total}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-subtle" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
