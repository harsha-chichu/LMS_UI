import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PillLink } from "@/components/common/PillButton";
import { DemoCard } from "@/components/landing/DemoCard";


export function LandingNav() {
  return (
    <header className="flex h-20 items-center justify-between md:h-[104px]">
      <Logo />
      <nav className="flex items-center gap-4 md:gap-6">
        <Link href="/login" className="text-[14px] text-white hover:text-white/80 md:text-[15px]">
          log in
        </Link>
        <PillLink href="/signup" size="sm" className="h-9 px-4 text-[14px] md:h-11 md:px-5 md:text-[15px]">
          sign up
        </PillLink>
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section className="grid items-center gap-14 pt-8 pb-16 md:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:pb-28">
      <div>
        <p className="text-[13px] text-brand md:text-[14px]">interview practice</p>
        <h1 className="mt-5 text-[40px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[48px] md:text-[60px]">
          practice the interview before the interview.
        </h1>
        <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-white/70 md:text-[17px]">
          pick a domain and answer out loud. an evaluator asks the follow-up a real interviewer would, then scores
          the session out of 100 and tells you exactly what to fix.
        </p>
        <div className="mt-9 flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:gap-6">
          <PillLink href="/signup" arrow className="h-[52px] px-7 md:h-[56px] md:px-8">
            start practising
          </PillLink>
          <Link href="/login" className="text-[14px] text-subtle hover:text-white">
            i already have an account
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[460px] lg:ml-auto">
        <DemoCard />
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "pick your domain",
    body: "ai/ml, data science, backend, frontend, system design or behavioral. set the difficulty and how many questions.",
  },
  {
    n: "02",
    title: "answer out loud",
    body: "voice by default, typing when you need it. a thin answer gets a follow-up before you move on — skip anything you want.",
  },
  {
    n: "03",
    title: "get your report",
    body: "a score out of 100 — 70% what you said, 30% how you said it — with feedback on every question.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-line py-16 md:py-20">
      <h2 className="text-[26px] font-medium tracking-tight md:text-[30px]">how it works</h2>
      <ol className="mt-10 grid gap-10 md:mt-12 md:grid-cols-3 md:gap-8">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="text-[13px] text-brand md:text-[14px]">{s.n}</span>
            <h3 className="mt-3 text-[17px] font-medium md:text-[19px]">{s.title}</h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-white/65 md:text-[15px]">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const COVERS = [
  ["answers", "score, feedback and a next-time tip per question"],
  ["communication", "clarity, pace, confidence, filler words"],
  ["summary", "strengths and areas to improve"],
  ["progress", "every session saved to your profile"],
];

export function ReportCovers() {
  return (
    <section className="grid gap-10 border-t border-line py-16 md:grid-cols-2 md:gap-16 md:py-20">
      <div>
        <h2 className="text-[26px] font-medium tracking-tight md:text-[30px]">what the report covers</h2>
        <p className="mt-4 max-w-[400px] text-[14px] leading-relaxed text-white/65 md:text-[15px]">
          one page after every session. open any question to see why it scored the way it did.
        </p>
      </div>
      <dl className="border-b border-line">
        {COVERS.map(([term, desc]) => (
          <div key={term} className="flex items-start justify-between gap-6 border-t border-line py-4 md:items-center md:py-[18px]">
            <dt className="text-[15px] md:text-[16px]">{term}</dt>
            <dd className="max-w-[60%] text-right text-[13px] text-white/65 md:text-[14px]">{desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="flex flex-col items-center border-t border-line py-20 text-center md:py-24">
      <h2 className="max-w-[260px] text-[30px] leading-tight font-medium tracking-tight sm:max-w-none md:text-[42px]">
        your next interview is a few reps away.
      </h2>
      <PillLink href="/signup" className="mt-8 h-[52px] px-8 md:h-[56px]">
        create your account
      </PillLink>
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
