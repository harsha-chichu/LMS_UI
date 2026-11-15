import { StreakFlame } from "@/components/common/StreakFlame";
import { Reveal } from "@/components/landing/Reveal";
import { ScoreRing } from "@/components/report/ScoreRing";
import { cn } from "@/lib/utils";

/** What you get after the answer, shown with example data in the app's own visuals. */
export function Bento() {
  return (
    <section className="border-t border-line py-12 md:py-20">
      <Reveal>
        <p className="text-[13px] text-brand md:text-[14px]">after every session</p>
        <h2 className="mt-3 max-w-[620px] text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance md:text-[38px]">
          not just a score. a plan for the next attempt.
        </h2>
        <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-foreground/70 md:text-[16px]">
          every session tells you what to fix, shows you how, and lets you prove you&apos;ve got it.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-6 lg:gap-5">
        <Cell
          className="lg:col-span-3"
          title="try again, watch the number move"
          body="retry the same questions and see before → after, for the session and for every question in it."
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ScoreRing score={68} size={116} />
            <div>
              <p className="text-[15px] text-subtle">
                52 → <span className="font-medium text-foreground">68</span>
              </p>
              <p className="mt-1 text-[22px] leading-none font-medium text-brand">+16</p>
              <p className="mt-1.5 text-[13px] text-subtle">vs the last try</p>
            </div>
          </div>
        </Cell>

        <Cell
          className="lg:col-span-3"
          delay={80}
          title="how you said it counts too"
          body="30% of the score is communication: clarity, pace, confidence and filler words."
        >
          <div className="w-full space-y-3">
            {COMMUNICATION.map(([label, level]) => (
              <div key={label} className="flex items-center justify-between gap-4 text-[14px]">
                <span className="text-foreground/80">{label}</span>
                <span className="flex gap-1" role="img" aria-label={`${level} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={cn("h-1.5 w-5 rounded-full sm:w-7", i < level ? "bg-brand" : "bg-track")} />
                  ))}
                </span>
              </div>
            ))}
            <p className="pt-1 text-[13px] text-subtle">said &ldquo;um&rdquo; 4 times — try a short pause instead</p>
          </div>
        </Cell>

        <Cell
          className="lg:col-span-2"
          title="practice that adapts to you"
          body="sessions lean towards your weakest topics, and never repeat a question from your last five."
        >
          <ul className="w-full space-y-3">
            {WEAK_AREAS.map(([topic, score]) => (
              <li key={topic} className="text-[14px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground/85">{topic}</span>
                  <span className="text-subtle tabular-nums">{score.toFixed(1)}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-track">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${score * 10}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Cell>

        <Cell
          className="lg:col-span-2"
          delay={80}
          title="track real progress"
          body="a daily streak, an activity heatmap, questions solved by difficulty and your score trend."
        >
          <div className="w-full">
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <StreakFlame className="size-5" />
              12 day streak
            </p>
            <div className="mt-4 grid grid-flow-col grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-7 gap-[3px]" aria-hidden>
              {HEAT.map((level, i) => (
                <span key={i} className={cn("aspect-square rounded-[3px]", HEAT_CLASS[level])} />
              ))}
            </div>
          </div>
        </Cell>

        <Cell
          className="md:col-span-2"
          delay={160}
          title="practise with friends"
          body="add friends and climb the weekly leaderboard. they see your scores, never your answers."
        >
          <ol className="w-full space-y-2.5">
            {LEADERBOARD.map(([name, score, you], i) => (
              <li
                key={name}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[14px]",
                  you ? "bg-bubble" : "bg-foreground/[0.03]",
                )}
              >
                <span className="w-4 text-subtle tabular-nums">{i + 1}</span>
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand text-[12px] font-medium text-primary-foreground">
                  {name[0]}
                </span>
                <span className="flex-1">{name}</span>
                <span className="font-medium tabular-nums">{score}</span>
              </li>
            ))}
          </ol>
        </Cell>
      </div>
    </section>
  );
}

const COMMUNICATION: [string, number][] = [
  ["clarity", 4],
  ["pace", 5],
  ["confidence", 3],
  ["filler words", 2],
];

const WEAK_AREAS: [string, number][] = [
  ["llms & rag", 4.5],
  ["evaluation", 5.8],
  ["mlops & production", 6.4],
];

const LEADERBOARD: [string, number, boolean][] = [
  ["priya", 82, false],
  ["you", 68, true],
  ["arjun", 61, false],
];

const HEAT_CLASS = ["bg-(--heat-0)", "bg-(--heat-1)", "bg-(--heat-2)", "bg-(--heat-3)", "bg-brand"];
/** 18 weeks of made-up activity that gets busier towards today. */
const HEAT = Array.from({ length: 18 * 7 }, (_, i) => {
  const week = Math.floor(i / 7);
  const noise = (i * 37 + week * 11) % 9;
  if (noise < 3 - Math.floor(week / 7)) return 0;
  return Math.min(4, Math.max(1, Math.round((noise / 8) * 2 + week / 6)));
});

function Cell({
  title,
  body,
  children,
  className,
  delay,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal className={cn("min-w-0", className)} delay={delay}>
      <article className="flex h-full flex-col rounded-3xl border border-line bg-surface/60 p-5 transition-colors hover:border-brand/40 md:p-6">
        <div className="flex min-h-[120px] flex-1 items-center">{children}</div>
        <h3 className="mt-5 text-[17px] font-medium md:text-[18px]">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground/65">{body}</p>
      </article>
    </Reveal>
  );
}
