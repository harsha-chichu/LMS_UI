"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const QUESTIONS = [
  {
    q: "do i need a microphone?",
    a: "no. voice is the default and there's a mic check before you start, but you can switch to typing at any point, even mid-session.",
  },
  {
    q: "how is the score worked out?",
    a: "each answer is scored out of 10 for correctness, depth, structure and concrete examples. the session score is out of 100: 70% from your answers and 30% from communication — clarity, pace, confidence and filler words. a skipped question counts as zero.",
  },
  {
    q: "when do i get a follow-up?",
    a: "on medium, when an answer is thin or vague. on hard, after every answer. easy sticks to fundamentals with no follow-ups.",
  },
  {
    q: "what happens when i retry a session?",
    a: "you get the same questions again, and the report shows before → after for the whole session and for each question.",
  },
  {
    q: "who can see my answers?",
    a: "only you. friends see your scores and progress on the leaderboard, never what you said.",
  },
  {
    q: "what can i practise?",
    a: "ai/ml, data science, backend, frontend, system design, behavioral, and finance & accounting. pick up to five topics in a domain, or type your own.",
  },
];

export function Faq() {
  return (
    <Accordion className="border-y border-line">
      {QUESTIONS.map(({ q, a }) => (
        <AccordionItem key={q} value={q} className="border-line">
          <AccordionTrigger className="py-5 text-[16px] font-medium hover:no-underline md:text-[17px] **:data-[slot=accordion-trigger-icon]:size-5">
            {q}
          </AccordionTrigger>
          <AccordionContent className="max-w-[640px] pb-5 text-[15px] leading-relaxed text-foreground/70">{a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
