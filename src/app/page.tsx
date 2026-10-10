import {
  FinalCta,
  Footer,
  Hero,
  HowItWorks,
  LandingNav,
  ReportCovers,
} from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 md:px-8 lg:px-0">
      <LandingNav />
      <main>
        <Hero />
        <HowItWorks />
        <ReportCovers />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
