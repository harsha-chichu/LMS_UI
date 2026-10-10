import { scoreTrend } from "@/lib/stats";
import type { Report } from "@/types";

export function ScoreTrend({ reports }: { reports: Report[] }) {
  const { points, delta } = scoreTrend(reports);

  const lo = Math.max(0, Math.min(...points) - 20);
  const hi = Math.min(100, Math.max(...points) + 20);
  const W = 100;
  const H = 40;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : (i / (points.length - 1)) * W;
    const y = H - ((p - lo) / Math.max(hi - lo, 1)) * H;
    return [x, y] as const;
  });

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] text-subtle">score trend</h2>
        <p className="text-[13px] text-white/85">
          {points.length < 2
            ? "complete two sessions to see a trend"
            : `${delta >= 0 ? "+" : ""}${delta} since your first session`}
        </p>
      </div>
      {points.length > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="mt-6 h-20 w-full overflow-visible"
          role="img"
          aria-label={`scores over time: ${points.join(", ")}`}
        >
          {coords.length > 1 && (
            <polyline
              points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {coords.map(([x, y], i) => (
            <line
              key={i}
              x1={x}
              y1={y}
              x2={x}
              y2={y}
              stroke="var(--brand)"
              strokeWidth={6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            >
              <title>{points[i]}</title>
            </line>
          ))}
        </svg>
      )}
    </div>
  );
}
