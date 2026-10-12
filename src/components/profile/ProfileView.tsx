"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppColumn, BackHeader, Section, SectionLabel, StatRow } from "@/components/common/Layout";
import { PillLink } from "@/components/common/PillButton";
import { SaveButton } from "@/components/common/SaveButton";
import { SegmentedPicker } from "@/components/common/SegmentedPicker";
import { Avatar, StreakPill } from "@/components/common/UserBits";
import { AccentPicker } from "@/components/profile/AccentPicker";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { ScoreTrend } from "@/components/profile/ScoreTrend";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { DIFFICULTIES, domainShort } from "@/lib/constants";
import {
  signOut,
  updateName,
  updatePreferences,
  useCompletedSessions,
  useProfile,
  useSavedQuestions,
  type CompletedSession,
} from "@/lib/data";
import { relativeDay } from "@/lib/dates";
import { activityFromSessions, currentStreak, summaryStats } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AnswerMode, Profile } from "@/types";

export function ProfileView() {
  const { data: profile } = useProfile();
  const { data: sessions } = useCompletedSessions();
  const speechSupported = useSpeechSupported();

  if (!profile || !sessions) return null;

  const reports = sessions.map((s) => s.report);
  const activity = activityFromSessions(sessions);
  const stats = summaryStats(reports);
  const streak = currentStreak(activity);
  const prefs = profile.preferences;

  return (
    <AppColumn className="pb-12">
      <BackHeader title="profile" href="/setup" />

      <div className="flex items-center gap-4 pt-4 pb-7">
        <Avatar name={profile.name} size={60} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[22px] leading-tight font-medium">{profile.name}</p>
          <p className="truncate text-[14px] text-subtle">{profile.email}</p>
        </div>
        {streak > 0 && <StreakPill days={streak} />}
      </div>

      <StatRow
        items={[
          { value: stats.sessions, label: "sessions" },
          { value: stats.average ?? "–", label: "average" },
          { value: stats.best ?? "–", label: "best", accent: true },
        ]}
      />

      <Section className="border-t-0 py-7">
        <ActivityHeatmap activity={activity} />
      </Section>

      <Section className="py-7">
        <ScoreTrend reports={reports} />
      </Section>

      <Section>
        <SectionLabel>recent sessions</SectionLabel>
        {sessions.length === 0 ? (
          <p className="mt-3 text-[15px] text-white/70">no sessions yet — your reports will show up here.</p>
        ) : (
          <ul className="mt-1">
            {sessions.slice(0, 6).map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <Link href={`/report/${s.id}`} className="flex items-center justify-between gap-4 py-4 hover:text-white/80">
                  <span className="text-[15px]">
                    {relativeDay(s.completed_at)} · {domainShort(s.config.domain)} · {s.config.difficulty}
                  </span>
                  <span className="text-[15px] font-medium tabular-nums">{s.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <SavedSection sessions={sessions} />

      <Section className="py-2">
        <Link href="/friends" className="flex w-full items-center justify-between py-4 text-[16px] hover:text-white/80">
          friends
          <ChevronRight className="size-4 text-subtle" />
        </Link>
      </Section>

      <Section>
        <SectionLabel>preferences</SectionLabel>
        <div className="mt-4 flex items-center justify-between gap-4 py-2">
          <span className="text-[16px]">answer mode</span>
          <SegmentedPicker<AnswerMode>
            label="answer mode"
            options={speechSupported ? ["voice", "text"] : ["text"]}
            value={speechSupported ? prefs.mode : "text"}
            onChange={(mode) => void updatePreferences(profile, { mode })}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-[16px]">difficulty</span>
          <SegmentedPicker
            label="default difficulty"
            options={DIFFICULTIES}
            value={prefs.difficulty}
            onChange={(difficulty) => void updatePreferences(profile, { difficulty })}
          />
        </div>
      </Section>

      <Section>
        <SectionLabel>theme colour</SectionLabel>
        <AccentPicker profile={profile} />
      </Section>

      <AccountSection profile={profile} />

      <PillLink href="/setup" size="lg" arrow className="mt-8">
        start a session
      </PillLink>
    </AppColumn>
  );
}

const SAVED_PREVIEW = 5;

function SavedSection({ sessions }: { sessions: CompletedSession[] }) {
  const { data: saved } = useSavedQuestions();
  const [showAll, setShowAll] = useState(false);
  if (!saved) return null;

  const completed = new Map(sessions.map((s) => [s.id, s]));
  const shown = showAll ? saved : saved.slice(0, SAVED_PREVIEW);

  return (
    <Section>
      <SectionLabel>saved questions</SectionLabel>
      {saved.length === 0 ? (
        <p className="mt-3 text-[15px] text-white/70">tap the bookmark on any question to save it here.</p>
      ) : (
        <>
          <ul className="mt-1">
            {shown.map((q) => {
              const session = completed.get(q.session_id);
              const score = session?.report.questions[q.question_index]?.score;
              const body = (
                <>
                  <span className="block text-[15px] leading-snug">{q.text}</span>
                  <span className="mt-1.5 block text-[13px] text-subtle">
                    {relativeDay(q.created_at)} · {domainShort(q.domain)} · {q.difficulty}
                    {score != null && (
                      <>
                        {" · "}
                        <span className={cn("tabular-nums", score >= 8 ? "text-brand" : "text-white/80")}>
                          {score.toFixed(1)}/10
                        </span>
                      </>
                    )}
                  </span>
                </>
              );
              return (
                <li key={q.id} className="flex items-start gap-3 border-b border-line py-4 last:border-b-0">
                  {session ? (
                    <Link href={`/report/${q.session_id}`} className="min-w-0 flex-1 hover:text-white/80">
                      {body}
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1">{body}</div>
                  )}
                  <SaveButton
                    sessionId={q.session_id}
                    index={q.question_index}
                    text={q.text}
                    config={q}
                    className="-mt-1.5 -mr-2"
                  />
                </li>
              );
            })}
          </ul>
          {saved.length > SAVED_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 text-[14px] text-brand hover:brightness-110"
            >
              {showAll ? "show less" : `show all ${saved.length}`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

function AccountSection({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState<"profile" | "password" | null>(null);

  return (
    <Section className="py-2">
      {open === "profile" ? (
        <EditNameForm profile={profile} onDone={() => setOpen(null)} />
      ) : (
        <RowButton onClick={() => setOpen("profile")}>edit profile</RowButton>
      )}
      {open === "password" ? (
        <ChangePasswordForm onDone={() => setOpen(null)} />
      ) : (
        <RowButton onClick={() => setOpen("password")}>change password</RowButton>
      )}
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/");
          router.refresh();
        }}
        className="py-4 text-[16px] text-brand hover:brightness-110"
      >
        log out
      </button>
    </Section>
  );
}

function RowButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between py-4 text-left text-[16px] hover:text-white/80">
      {children}
      <ChevronRight className="size-4 text-subtle" />
    </button>
  );
}

const inputClass =
  "mt-1 h-11 w-full rounded-xl bg-surface-2 px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand";

function InlineForm({
  children,
  onSubmit,
  onCancel,
  error,
  pending,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  error: string | null;
  pending: boolean;
}) {
  return (
    <form
      className="space-y-3 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {error && (
        <p role="alert" className="text-[13px] text-brand">
          {error}
        </p>
      )}
      <div className="flex gap-4 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-full bg-brand px-5 text-[14px] font-medium text-black hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "saving…" : "save"}
        </button>
        <button type="button" onClick={onCancel} className="text-[14px] text-subtle hover:text-white">
          cancel
        </button>
      </div>
    </form>
  );
}

function EditNameForm({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <InlineForm
      error={error}
      pending={pending}
      onCancel={onDone}
      onSubmit={async () => {
        if (!name.trim()) return setError("name can't be empty.");
        setPending(true);
        try {
          await updateName(profile, name.trim());
          onDone();
        } catch {
          setError("couldn't save — try again.");
          setPending(false);
        }
      }}
    >
      <label className="block">
        <span className="text-[13px] text-subtle">name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={inputClass} />
      </label>
      <p className="text-[13px] text-subtle">email · {profile.email}</p>
    </InlineForm>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <InlineForm
      error={error}
      pending={pending}
      onCancel={onDone}
      onSubmit={async () => {
        if (password.length < 8) return setError("use at least 8 characters.");
        setPending(true);
        const { error: err } = await getSupabase().auth.updateUser({ password });
        if (err) {
          setError(err.message.toLowerCase());
          setPending(false);
        } else {
          onDone();
        }
      }}
    >
      <label className="block">
        <span className="text-[13px] text-subtle">new password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="at least 8 characters"
          className={`${inputClass} placeholder:text-subtle`}
        />
      </label>
    </InlineForm>
  );
}
