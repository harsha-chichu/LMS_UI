import { heatmap, longestStreak } from "@/lib/stats";
import { cn } from "@/lib/utils";

const LEVEL_CLASS = ["bg-[#1a1a1a]", "bg-[#4a2108]", "bg-[#8a3a06]", "bg-[#c95207]", "bg-brand"];

export function ActivityHeatmap({ activity }: { activity: Record<string, number> }) {
  const { columns, months, total } = heatmap(activity);
  const longest = longestStreak(activity);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] text-subtle">activity</h2>
        <p className="text-[13px] text-white/85">
          {total} session{total === 1 ? "" : "s"} in the last 6 months
        </p>
      </div>

      <div className="mt-4" style={{ "--cols": columns.length } as React.CSSProperties}>
        <div className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-[3px] text-[10px] text-subtle md:gap-1 md:text-[11px]">
          {months.map((m) => (
            <span key={`${m.col}-${m.label}`} style={{ gridColumnStart: m.col + 1 }} className="col-span-3 leading-none">
              {m.label}
            </span>
          ))}
        </div>
        <div
          className="mt-2 grid grid-flow-col grid-cols-[repeat(var(--cols),minmax(0,1fr))] grid-rows-7 gap-[3px] md:gap-1"
          role="img"
          aria-label={`${total} sessions in the last 6 months`}
        >
          {columns.flatMap((col, w) =>
            col.map((cell, d) =>
              cell ? (
                <span
                  key={cell.key}
                  title={`${cell.key}: ${cell.count} session${cell.count === 1 ? "" : "s"}`}
                  className={cn(
                    "aspect-square rounded-[3px]",
                    LEVEL_CLASS[cell.level],
                    cell.isToday && "ring-1 ring-white ring-offset-1 ring-offset-black",
                  )}
                />
              ) : (
                <span key={`empty-${w}-${d}`} className="aspect-square" />
              ),
            ),
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px] text-subtle md:text-[13px]">
        <span>
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
    </div>
  );
}
