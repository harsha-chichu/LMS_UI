import { Keyboard, Mic, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ProgressBars({ total, current, className }: { total: number; current: number; className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-1.5 md:gap-2", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`question ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-[3px] rounded-full transition-colors",
            total > 6 ? "w-4 md:w-6" : "w-6 md:w-8",
            i < current ? "bg-white/55" : i === current ? "bg-brand" : "bg-white/15",
          )}
        />
      ))}
    </div>
  );
}

export function SessionHeader({ total, current, onClose }: { total: number; current: number; onClose: () => void }) {
  return (
    <header className="grid h-14 grid-cols-[40px_1fr_40px] items-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="End session"
        className="-ml-2 rounded-full p-2 text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
      >
        <X className="size-5" />
      </button>
      <ProgressBars total={total} current={current} className="justify-self-center" />
      <span className="justify-self-end text-[14px] tabular-nums text-white/80">
        {current + 1}/{total}
      </span>
    </header>
  );
}

export function QuestionMeta({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-subtle md:text-[14px]">{children}</p>;
}

export function QuestionText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-[19px] leading-snug font-medium md:text-[22px]", className)}>{children}</h2>
  );
}

export function AnswerBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "ml-auto w-fit max-w-[88%] rounded-[18px] bg-bubble px-5 py-4 text-[14px] leading-relaxed text-white/95 md:text-[15px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FollowUpBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-l-2 border-brand pl-4 md:pl-5", className)}>
      <p className="text-[13px] text-brand md:text-[14px]">follow-up</p>
      <p className="mt-1.5 text-[17px] leading-snug font-medium md:text-[20px]">{children}</p>
    </div>
  );
}

export function MicButton({
  size = 72,
  className,
  ...props
}: { size?: number } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label="Answer by voice"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand text-black transition-[filter,transform] hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:opacity-40",
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Mic style={{ width: size * 0.36, height: size * 0.36 }} strokeWidth={1.75} />
    </button>
  );
}

export function RoundIconButton({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-white/85 transition-colors hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function KeyboardButton(props: ComponentProps<"button">) {
  return (
    <RoundIconButton aria-label="Type instead" {...props}>
      <Keyboard className="size-5" strokeWidth={1.75} />
    </RoundIconButton>
  );
}
