import Link from "next/link";
import { ArrowRight, Mic, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PillLink } from "@/components/common/PillButton";
import { Faq } from "@/components/landing/Faq";
import { FeedbackPreview } from "@/components/landing/FeedbackPreview";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { NavActions } from "@/components/landing/NavActions";
import { Reveal } from "@/components/landing/Reveal";
import { DOMAINS, TOPICS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const EYEBROW = "text-[13px] text-brand md:text-[14px]";
const H2 = "mt-3 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance md:text-[38px]";
const SECTION = "border-t border-line py-12 md:py-20";
const GRID_GAP = "mt-8 md:mt-12";
const LEAD = "mt-4 text-[15px] leading-relaxed text-foreground/70 md:text-[16px]";

export function LandingNav() {
  return (
    <header className="flex h-16 items-center justify-between gap-3 md:h-20">
      <Logo />
      <nav className="flex items-center gap-3 md:gap-5">
        <NavActions />
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section className="grid items-center gap-10 pt-4 pb-14 md:pt-8 md:pb-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div className="min-w-0">
        <p className={EYEBROW}>interview practice</p>
        <h1 className="mt-5 text-[36px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-[48px] lg:text-[60px]">
          say it out loud. get the follow-up. <span className="text-brand-gradient">get better.</span>
        </h1>
        <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-foreground/70 md:text-[17px]">
          interview practice that talks back. answer real questions by voice, get the follow-up a real interviewer
          would ask, then a score out of 100 and the answer you should have given.
        </p>
        <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
          <PillLink href="/signup" arrow className="h-[52px] px-7 md:h-[56px] md:px-8">
            start practising
          </PillLink>
          <Link href="/login" className="text-[14px] text-subtle hover:text-foreground">
            i already have an account
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-subtle md:text-[14px]">
          {["7 domains", "voice or text", "follow-ups on thin answers", "scored out of 100"].map((fact) => (
            <li key={fact} className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-brand" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto w-full max-w-[440px] min-w-0 lg:ml-auto">
        <LiveDemo />
      </div>
    </section>
  );
}

const WHY = [
  {
    before: "you rehearse in your head",
    after: "you say it out loud",
    body: "talking through an answer is a different skill from knowing it. here you speak, then check the transcript before it's scored.",
  },
  {
    before: "nobody pushes back",
    after: "you get the follow-up",
    body: "a thin or vague answer gets the probing question a real interviewer would ask next, before any score.",
  },
  {
    before: "you never hear what good sounds like",
    after: "you see the strong answer",
    body: "every question comes with a suggested answer: the key points first, the full answer one tap away.",
  },
];

export function Why() {
  return (
    <section className={SECTION}>
      <Reveal>
        <p className={EYEBROW}>why it works</p>
        <h2 className={cn(H2, "max-w-[620px]")}>reading model answers isn&apos;t practice.</h2>
      </Reveal>
      <ul className={cn(GRID_GAP, "grid gap-4 lg:grid-cols-3 lg:gap-5")}>
        {WHY.map(({ before, after, body }, i) => (
          <li key={after}>
            <Reveal delay={i * 80} className="h-full">
              <div className="h-full rounded-3xl border border-line bg-surface/60 p-5 md:p-6">
                <p className="flex items-center gap-2 text-[14px] text-subtle line-through decoration-faint">
                  <X className="size-3.5 shrink-0" />
                  {before}
                </p>
                <h3 className="mt-3 flex items-center gap-2 text-[20px] font-medium tracking-tight md:text-[22px]">
                  <ArrowRight className="size-[18px] shrink-0 text-brand" />
                  {after}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-foreground/65 md:text-[15px]">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className={SECTION}>
      <Reveal>
        <p className={EYEBROW}>how it works</p>
        <h2 className={H2}>three steps, one session.</h2>
      </Reveal>
      <ol className={cn(GRID_GAP, "grid gap-8 lg:grid-cols-3")}>
        <Step
          n="01"
          title="pick your domain"
          body="seven domains at three difficulties, with 3 to 10 questions. narrow it to the topics you want, or let it lean towards your weakest."
        >
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map((d, i) => (
              <span
                key={d.value}
                className={cn(
                  "rounded-full border px-3 py-1 text-[13px]",
                  i === 0 ? "border-brand bg-bubble text-brand" : "border-line text-foreground/70",
                )}
              >
                {d.short}
              </span>
            ))}
          </div>
        </Step>
        <Step
          n="02"
          delay={80}
          title="answer out loud"
          body="voice by default, typing when you need it. fix anything misheard in the transcript before it's scored."
        >
          <div className="flex items-center gap-4">
            <span className="relative inline-flex size-12 shrink-0 items-center justify-center">
              <span className="absolute inset-0 animate-ring-pulse rounded-full border border-brand" />
              <span className="relative inline-flex size-full items-center justify-center rounded-full bg-brand text-primary-foreground">
                <Mic className="size-5" strokeWidth={1.75} />
              </span>
            </span>
            <p className="text-[14px] leading-relaxed text-foreground/80">
              &ldquo;so first i&apos;d look at the retrieval step
              <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret bg-brand" />
              &rdquo;
            </p>
          </div>
        </Step>
        <Step
          n="03"
          delay={160}
          title="get your report"
          body="a score out of 100, with a tip, strengths, gaps and a suggested answer for every question."
        >
          <div className="w-full">
            <p className="text-[28px] leading-none font-medium tabular-nums">
              68<span className="text-[15px] text-subtle"> / 100</span>
            </p>
            <SplitBar className="mt-4" />
          </div>
        </Step>
      </ol>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  children,
  delay,
}: {
  n: string;
  title: string;
  body: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <li className="min-w-0">
      <Reveal delay={delay}>
        <div className="flex min-h-[112px] items-center rounded-3xl border border-line bg-surface/60 p-5">{children}</div>
        <span className="mt-5 block text-[13px] text-brand md:text-[14px]">{n}</span>
        <h3 className="mt-2 text-[18px] font-medium md:text-[20px]">{title}</h3>
        <p className="mt-2.5 text-[14px] leading-relaxed text-foreground/65 md:text-[15px]">{body}</p>
      </Reveal>
    </li>
  );
}

/** The 70 / 30 split behind every session score. */
function SplitBar({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-2 gap-1" aria-hidden>
        <span className="w-[70%] rounded-full bg-brand" />
        <span className="w-[30%] rounded-full bg-brand/40" />
      </div>
      <div className="mt-2 flex text-[12px] text-subtle md:text-[13px]">
        <span className="w-[70%]">70% what you said</span>
        <span className="w-[30%] whitespace-nowrap">30% how</span>
      </div>
    </div>
  );
}

const COVERS = [
  ["answers", "score, next-time tip, strengths, gaps and a suggested answer per question"],
  ["communication", "clarity, pace, filler words — plus grammar, pronunciation and fluency from your recording"],
  ["summary", "what you do well and where points drop"],
  ["progress", "before → after on retries, every session saved to your profile"],
];

export function ReportCovers() {
  return (
    <section className={cn(SECTION, "grid gap-10 lg:grid-cols-2 lg:gap-16")}>
      <Reveal className="min-w-0">
        <p className={EYEBROW}>the report</p>
        <h2 className={H2}>see exactly why it scored the way it did.</h2>
        <p className={cn(LEAD, "max-w-[440px]")}>
          one page after every session. open any question to see what landed, what was missing, and what a strong
          answer looks like.
        </p>
        <SplitBar className="mt-8 max-w-[440px]" />
        <dl className="mt-8 border-b border-line">
          {COVERS.map(([term, desc]) => (
            <div key={term} className="flex items-start justify-between gap-6 border-t border-line py-4 md:py-[18px]">
              <dt className="text-[15px] md:text-[16px]">{term}</dt>
              <dd className="max-w-[64%] min-w-0 text-right text-[13px] text-foreground/65 md:text-[14px]">{desc}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
      <Reveal delay={120} className="mx-auto w-full max-w-[460px] min-w-0 lg:ml-auto">
        <FeedbackPreview />
      </Reveal>
    </section>
  );
}

const TOPIC_CHIPS = DOMAINS.flatMap((d) => TOPICS[d.value].map((topic) => ({ domain: d.short, topic })));
const HALF = Math.ceil(TOPIC_CHIPS.length / 2);

export function Domains() {
  return (
    <section className={SECTION}>
      <Reveal>
        <p className={EYEBROW}>what you can practise</p>
        <h2 className={cn(H2, "max-w-[620px]")}>seven domains, {TOPIC_CHIPS.length} topics, or type your own.</h2>
      </Reveal>
      {/* The rows are wider than the column; the sides fade out. */}
      <div className={cn(GRID_GAP, "space-y-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]")}>
        <ChipRow chips={TOPIC_CHIPS.slice(0, HALF)} />
        <ChipRow chips={TOPIC_CHIPS.slice(HALF)} reverse />
      </div>
    </section>
  );
}

function ChipRow({ chips, reverse }: { chips: typeof TOPIC_CHIPS; reverse?: boolean }) {
  return (
    <div className={cn("marquee", reverse && "marquee-reverse")}>
      {/* Twice, so the loop has no seam; the copy is hidden from screen readers. */}
      {[false, true].map((copy) => (
        <ul key={String(copy)} aria-hidden={copy} className="flex shrink-0 gap-3 pr-3">
          {chips.map(({ domain, topic }) => (
            <li
              key={`${domain}-${topic}`}
              className="rounded-full border border-line bg-surface/60 px-4 py-2 text-[14px] whitespace-nowrap"
            >
              <span className="text-subtle">{domain} · </span>
              {topic}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export function FaqSection() {
  return (
    <section className={cn(SECTION, "grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16")}>
      <Reveal>
        <p className={EYEBROW}>questions</p>
        <h2 className={H2}>before you start.</h2>
      </Reveal>
      <Reveal delay={80} className="min-w-0">
        <Faq />
      </Reveal>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative border-t border-line">
      <div className="landing-glow-center pointer-events-none absolute inset-0" aria-hidden />
      <Reveal className="relative flex flex-col items-center py-16 text-center md:py-24">
        <h2 className="max-w-[640px] text-[30px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-[48px]">
          your next interview is a few <span className="text-brand-gradient">reps</span> away.
        </h2>
        <p className={cn(LEAD, "max-w-[420px]")}>pick a domain, answer three questions, and see where you stand.</p>
        <PillLink href="/signup" arrow className="mt-8 h-[52px] px-8 md:h-[56px]">
          create your account
        </PillLink>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="flex items-center justify-between border-t border-line py-8 md:py-10">
      <Logo className="text-[17px]" />
      <span className="text-[13px] text-subtle">interview practice</span>
    </footer>
  );
}
