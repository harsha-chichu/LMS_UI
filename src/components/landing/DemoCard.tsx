import { Mic } from "lucide-react";
import { AnswerBubble, FollowUpBlock, ProgressBars, QuestionMeta } from "@/components/session/parts";

/** Static preview of the session screen shown in the landing hero. */
export function DemoCard() {
  return (
    <figure
      aria-label="Example of a practice session"
      className="w-full rounded-[28px] border border-white/10 bg-[#050505] p-5 md:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <QuestionMeta>question 3 · ai/ml · medium</QuestionMeta>
        <ProgressBars total={5} current={2} className="[&>span]:w-5" />
      </div>
      <p className="mt-3 text-[16px] leading-snug font-medium md:text-[17px]">
        a retrieval-augmented chatbot keeps citing the wrong document. how do you debug it?
      </p>
      <AnswerBubble className="mt-5 max-w-[85%] text-[14px]">
        i&apos;d check whether the right passage is even in the top-k, then look at chunking and the embedding model…
      </AnswerBubble>
      <FollowUpBlock className="mt-5 [&>p:last-child]:text-[15px] md:[&>p:last-child]:text-[16px]">
        using only logs, how would you tell a retrieval failure from a generation failure?
      </FollowUpBlock>
      <div className="mt-6 flex justify-center">
        <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-brand text-black">
          <Mic className="size-5" strokeWidth={1.75} />
        </span>
      </div>
    </figure>
  );
}
