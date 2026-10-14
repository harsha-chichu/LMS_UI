"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordChecklist, friendlyAuthError } from "@/components/auth/parts";
import { AppColumn, BackHeader, Section, SectionLabel } from "@/components/common/Layout";
import { SegmentedPicker } from "@/components/common/SegmentedPicker";
import { AccentPicker } from "@/components/profile/AccentPicker";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { DIFFICULTIES } from "@/lib/constants";
import { passwordProblem } from "@/lib/credentials";
import { signOut, updateName, updatePreferences, useProfile } from "@/lib/data";
import { getSupabase } from "@/lib/supabase/client";
import type { AnswerMode, Profile } from "@/types";

/** Preferences, theme colour and account actions, moved off the profile page. */
export function SettingsView() {
  const { data: profile } = useProfile();
  const speechSupported = useSpeechSupported();

  if (!profile) return null;
  const prefs = profile.preferences;

  return (
    <AppColumn className="pb-12">
      <BackHeader title="settings" href="/profile" />

      <Section className="border-t-0 pt-4">
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
    </AppColumn>
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
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between py-4 text-left text-[16px] hover:text-white/80"
    >
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

/** Same rules as sign-up and reset (src/lib/credentials.ts). */
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
        const problem = passwordProblem(password);
        if (problem) return setError(problem);
        setPending(true);
        const { error: err } = await getSupabase().auth.updateUser({ password });
        if (err) {
          setError(friendlyAuthError(err.message));
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
          placeholder="create a strong password"
          className={`${inputClass} placeholder:text-subtle`}
        />
      </label>
      {password && <PasswordChecklist password={password} />}
    </InlineForm>
  );
}
