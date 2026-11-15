import { Bento } from "@/components/landing/Bento";
import {
  Domains,
  FaqSection,
  FinalCta,
  Footer,
  Hero,
  HowItWorks,
  LandingNav,
  ReportCovers,
  Why,
} from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      {/* Without scripts nothing would scroll into view, so show the sections outright. */}
      <noscript>
        <style>{".reveal{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <div className="landing-glow pointer-events-none absolute inset-x-0 top-0 h-[720px]" aria-hidden />
      <div className="landing-grid pointer-events-none absolute inset-x-0 top-0 h-[720px]" aria-hidden />

      <div className="relative mx-auto w-full max-w-[1040px] px-5 md:px-8 lg:px-0">
        <LandingNav />
        <main>
          <Hero />
          <Why />
          <HowItWorks />
          <Bento />
          <ReportCovers />
          <Domains />
          <FaqSection />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
