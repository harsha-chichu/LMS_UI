"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PasswordChecklist, friendlyAuthError } from "@/components/auth/parts";
import { AppColumn, BackHeader, Section, SectionLabel } from "@/components/common/Layout";
import { SegmentedPicker } from "@/components/common/SegmentedPicker";
import { Avatar } from "@/components/common/UserBits";
import { AccentPicker } from "@/components/profile/AccentPicker";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { useSpeechSupported } from "@/hooks/useSpeechRecognition";
import { DIFFICULTIES } from "@/lib/constants";
import { passwordProblem } from "@/lib/credentials";
import { AvatarError } from "@/lib/avatar";
import { removeAvatar, signOut, updateName, updatePreferences, uploadAvatar, useProfile } from "@/lib/data";
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

      <PhotoSection profile={profile} />

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
    </AppColumn>
  );
}

function PhotoSection({ profile }: { profile: Profile }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "upload" | "remove", action: () => Promise<void>) => {
    setPending(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof AvatarError ? err.message : "couldn't save your photo — try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Section className="border-t-0 pt-4">
      <SectionLabel>photo</SectionLabel>
      <div className="mt-4 flex items-center gap-5">
        <Avatar name={profile.name} src={profile.avatarUrl} size={72} />
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => input.current?.click()}
            className="h-10 rounded-full bg-brand px-5 text-[14px] font-medium text-black hover:brightness-110 disabled:opacity-50"
          >
            {pending === "upload" ? "uploading…" : profile.avatarUrl ? "change photo" : "upload photo"}
          </button>
          {profile.avatarUrl && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void run("remove", () => removeAvatar(profile))}
              className="text-[14px] text-subtle hover:text-white disabled:opacity-50"
            >
              {pending === "remove" ? "removing…" : "remove photo"}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // picking the same file again should still trigger
            if (file) void run("upload", () => uploadAvatar(profile, file));
          }}
        />
      </div>
      <p className="mt-3 text-[13px] text-subtle">your friends see this too. it&apos;s cropped to a square.</p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-brand">
          {error}
        </p>
      )}
    </Section>
  );
}

function AccountSection({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState<"profile" | "password" | "feedback" | null>(null);

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
      {open === "feedback" ? (
        <div className="py-4">
          <FeedbackForm />
          <button type="button" onClick={() => setOpen(null)} className="mt-3 text-[14px] text-subtle hover:text-white">
            cancel
          </button>
        </div>
      ) : (
        <RowButton onClick={() => setOpen("feedback")}>send feedback</RowButton>
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
