import { Card, CardHead } from "@/components/common/Layout";
import { Bar } from "@/components/profile/parts";
import { domainShort } from "@/lib/constants";
import type { CompletedSession } from "@/lib/data";
import { domainAverages } from "@/lib/stats";

/** Average session score per domain, strongest first. Hidden until there's a session. */
export function DomainScores({ sessions }: { sessions: CompletedSession[] }) {
  const rows = domainAverages(sessions);
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHead label="score by domain">average out of 100</CardHead>
      <dl className="mt-4 space-y-3.5">
        {rows.map((row, i) => (
          <div key={row.domain} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5 text-[14px]">
            <dt>
              {domainShort(row.domain)}
              <span className="ml-1.5 text-[12px] text-subtle tabular-nums">
                {row.sessions} session{row.sessions === 1 ? "" : "s"}
              </span>
            </dt>
            <dd className="font-medium tabular-nums">{row.average}</dd>
            <dd className="col-span-2" aria-hidden>
              <Bar fraction={row.average / 100} color={i === 0 ? "var(--brand)" : "var(--brand-deep)"} className="h-1.5" />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
