import { Check } from "lucide-react";
import { Card, CardHead } from "@/components/common/Layout";
import { Arc } from "@/components/profile/parts";
import { milestones } from "@/lib/stats";
import { cn } from "@/lib/utils";

/** The latest milestone reached on each ladder, and how far along the next one is. */
export function Milestones(props: { sessions: number; solved: number; streak: number; best: number }) {
  const { items, reached } = milestones(props);

  return (
    <Card>
      <CardHead label="milestones">{reached === 0 ? "none reached yet" : `${reached} reached`}</CardHead>
      <ul className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-4">
        {items.map((m) => (
          <li key={m.key} className="flex min-w-0 items-center gap-3">
            <Arc
              size={42}
              stroke={3.5}
              fraction={m.progress}
              color={m.done ? "var(--brand)" : "var(--brand-deep)"}
              className={cn(m.done && "rounded-full bg-brand/15")}
            >
              {m.done ? (
                <Check className="size-4 text-brand" strokeWidth={2.25} />
              ) : (
                <span className="text-[11px] text-subtle tabular-nums">{Math.floor(m.progress * 100)}%</span>
              )}
            </Arc>
            <span className="min-w-0">
              <span className={cn("block text-[14px] leading-snug", m.done ? "font-medium" : "text-foreground/85")}>{m.label}</span>
              <span className="block truncate text-[12px] text-subtle tabular-nums">{m.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
