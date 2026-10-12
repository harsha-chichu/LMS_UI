"use client";

import { Keyboard, Mic } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { MicCheck } from "@/components/setup/MicCheck";
import { AppColumn } from "@/components/common/Layout";
import { PillButton } from "@/components/common/PillButton";
import { SegmentedPicker } from "@/components/common/SegmentedPicker";
import { UserCluster } from "@/components/common/UserBits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { useStartSession } from "@/hooks/useStartSession";
import { TopicPicker } from "@/components/setup/TopicPicker";
import { DIFFICULTIES, DIFFICULTY_HINT, DOMAINS, MAX_TOPICS, QUESTION_COUNTS, TOPICS } from "@/lib/constants";
import { useCompletedSessions, useProfile } from "@/lib/data";
import { activityFromSessions, currentStreak } from "@/lib/stats";
import type { Domain, Preferences, SessionConfig } from "@/types";

export function SetupScreen() {
  const { data: profile } = useProfile();
  const { data: sessions } = useCompletedSessions();
  const user = profile;
  const prefs = profile?.preferences;
  const activity = sessions && activityFromSessions(sessions);

  return (
    <AppColumn className="flex flex-1 flex-col">
      <header className="flex h-20 items-center justify-between md:h-24">
        <Logo />
        {user && activity && <UserCluster name={user.name} streak={currentStreak(activity)} />}
      </header>

      <div className="mt-4 md:mt-6">
        <h1 className="text-[26px] font-semibold tracking-tight md:text-[28px]">
          let&apos;s practice{user ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/70">
          answer out loud, get follow-ups when you need them, and a score out of 100 at the end.
        </p>
      </div>

      {/* Form state is seeded from saved preferences, so wait for them. */}
      {prefs ? <SetupForm initial={prefs} /> : <div className="flex-1" />}
    </AppColumn>
  );
}

function SetupForm({ initial }: { initial: Preferences }) {
  const speechSupported = useSpeechSupported();
  const [config, setConfig] = useState<SessionConfig>({
    domain: initial.domain,
    difficulty: initial.difficulty,
    count: initial.count,
    mode: initial.mode,
    topics: initial.topicsByDomain?.[initial.domain] ?? [],
  });
  const { start: startSession, pending, error } = useStartSession();

  const mode = speechSupported ? config.mode : "text";
  const topics = config.topics ?? [];
  const set = (patch: Partial<SessionConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const start = () => startSession({ ...config, mode });

  return (
    <>
      <div className="mt-6 border-t border-line md:mt-10">
        <Row label="domain">
          <Select
            items={DOMAINS.map((d) => ({ value: d.value, label: d.label }))}
            value={config.domain}
            onValueChange={(v) => v && set({ domain: v as Domain, topics: initial.topicsByDomain?.[v as Domain] ?? [] })}
          >
            <SelectTrigger
              aria-label="domain"
              className="h-auto gap-3 border-0 bg-transparent p-0 text-[17px] text-white/85 hover:text-white dark:bg-transparent dark:hover:bg-transparent [&_svg]:text-white/70"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-48 border border-line bg-[#141414]" alignItemWithTrigger={false} align="end">
              {DOMAINS.map((d) => (
                <SelectItem key={d.value} value={d.value} className="py-2 text-[15px]">
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row
          label="topics"
          hint={topics.length ? `${topics.length} of ${MAX_TOPICS} · questions stick to these` : "optional · leave empty for any topic"}
          below={<TopicPicker options={TOPICS[config.domain]} value={topics} onChange={(t) => set({ topics: t })} />}
        >
          {topics.length > 0 && (
            <button
              type="button"
              onClick={() => set({ topics: [] })}
              className="text-[14px] text-subtle transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
            >
              clear
            </button>
          )}
        </Row>

        <Row label="difficulty" hint={DIFFICULTY_HINT[config.difficulty]}>
          <SegmentedPicker
            label="difficulty"
            options={DIFFICULTIES}
            value={config.difficulty}
            onChange={(difficulty) => set({ difficulty })}
          />
        </Row>

        <Row label="questions">
          <SegmentedPicker
            label="number of questions"
            options={QUESTION_COUNTS}
            value={config.count}
            onChange={(count) => set({ count })}
            className="gap-5 md:gap-6"
          />
        </Row>

        <div className="flex items-center justify-between gap-6 py-5 md:py-6">
          <div>
            <p className="text-[17px]">{mode === "voice" ? "answer by voice" : "answer by typing"}</p>
            <p className="mt-1 text-[14px] text-subtle">
              {!speechSupported
                ? "voice isn't supported in this browser"
                : mode === "voice"
                  ? "default · you can switch to typing anytime"
                  : "you can switch to voice anytime"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mode === "voice"}
            aria-label="answer by voice"
            disabled={!speechSupported}
            onClick={() => set({ mode: mode === "voice" ? "text" : "voice" })}
            className="-mr-2 rounded-full p-2 text-brand transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand disabled:text-subtle"
          >
            {mode === "voice" ? <Mic className="size-6" strokeWidth={1.75} /> : <Keyboard className="size-6" strokeWidth={1.75} />}
          </button>
        </div>

        {mode === "voice" && <MicCheck />}
      </div>

      {/* Pinned so the main action stays on screen on phones; rows fade out underneath. */}
      <div className="sticky bottom-0 z-10 mt-auto bg-black pt-6 pb-[max(16px,env(safe-area-inset-bottom))] before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-black before:to-transparent md:pt-10 md:pb-8">
        {error && (
          <p role="alert" className="mb-4 text-center text-[14px] text-brand">
            {error}
          </p>
        )}
        <PillButton size="lg" arrow={!pending} onClick={start} disabled={pending}>
          {pending ? "preparing your questions…" : "start session"}
        </PillButton>
      </div>
    </>
  );
}

function Row({
  label,
  hint,
  children,
  below,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
  below?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line py-5 md:py-7">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[17px]">{label}</span>
        {children}
      </div>
      {hint && <p className="mt-2 text-[14px] text-subtle">{hint}</p>}
      {below}
    </div>
  );
}
