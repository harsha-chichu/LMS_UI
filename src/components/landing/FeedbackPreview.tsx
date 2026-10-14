import { QuestionDetail } from "@/components/report/QuestionDetail";
import { QuestionMeta } from "@/components/session/parts";

/**
 * Static example of one question's feedback for the landing page, rendered with
 * the real report component so it always matches what users get.
 */
export function FeedbackPreview() {
  return (
    <figure
      aria-label="Example of the feedback on one question"
      className="w-full rounded-[28px] border border-white/10 bg-[#050505] p-5 text-[14px] md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <QuestionMeta>question 2 · ai/ml · easy</QuestionMeta>
          <p className="mt-2 text-[16px] leading-snug font-medium">what does an roc curve show?</p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-[17px] font-medium tabular-nums text-brand">7.5</span>
          <span className="text-[11px] text-brand tabular-nums">+2.5</span>
        </div>
      </div>
      <div className="mt-5">
        <QuestionDetail
          q={{
            text: "what does an roc curve show?",
            score: 7.5,
            mode: "voice",
            feedback: "",
            nextTime: "finish with when you'd prefer precision-recall instead.",
            strengths: ["named both axes", "explained what auc means"],
            weaknesses: ["no example of reading the curve"],
            answer:
              "it plots the true positive rate against the false positive rate as you change the threshold. the closer it hugs the top-left, the better, and auc sums that up.",
            suggestedPoints: [
              "tpr on y, fpr on x — one point per threshold",
              "diagonal = random guessing",
              "auc: 0.5 random, 1.0 perfect",
              "imbalanced data? check precision-recall too",
            ],
            suggestedAnswer:
              "an roc curve plots the true positive rate against the false positive rate, one point for every threshold. the diagonal is random guessing, so a useful model bows up and to the left. auc sums it up in one number — 0.5 is random, 1.0 is perfect. on very imbalanced data i'd also look at precision-recall, since roc can look optimistic there.",
          }}
        />
      </div>
    </figure>
  );
}
