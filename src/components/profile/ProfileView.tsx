"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { BackHeader, ProfileColumn } from "@/components/common/Layout";
import { Avatar } from "@/components/common/UserBits";
import { FriendsLink } from "@/components/friends/FriendsLink";
import { ProfileSkeleton, StreakBadge } from "@/components/profile/parts";
import { ProgressTab } from "@/components/profile/ProgressTab";
import { SavedTab } from "@/components/profile/SavedTab";
import { SessionsTab } from "@/components/profile/SessionsTab";
import { useCompletedSessions, useProfile, useSavedQuestions } from "@/lib/data";
import { activityFromSessions, currentStreak } from "@/lib/stats";
import { cn } from "@/lib/utils";

const TABS = ["progress", "sessions", "saved"] as const;
type Tab = (typeof TABS)[number];

export const isProfileTab = (value: string | null): value is Tab => TABS.includes(value as Tab);

/**
 * The profile: who you are, then one tab at a time — progress (the dashboard),
 * sessions (history) and saved questions. Friends and settings are the two
 * icons in the header; preferences and account live on /settings. The open tab
 * is kept in the URL (?tab=), so a reload or coming back from a report keeps it.
 */
export function ProfileView() {
  const { data: profile } = useProfile();
  const { data: sessions } = useCompletedSessions();
  const { data: saved } = useSavedQuestions();
  const param = useSearchParams().get("tab");
  const tab: Tab = isProfileTab(param) ? param : "progress";

  if (!profile || !sessions) return <ProfileSkeleton title="profile" href="/setup" />;

  // Swap the URL in place: tabs shouldn't pile up in the back button's history.
  const setTab = (next: Tab) =>
    window.history.replaceState(null, "", next === "progress" ? "/profile" : `/profile?tab=${next}`);

  const streak = currentStreak(activityFromSessions(sessions));
  const counts: Partial<Record<Tab, number>> = { sessions: sessions.length, saved: saved?.length };

  return (
    <ProfileColumn className="pb-12">
      <BackHeader
        title="profile"
        href="/setup"
        actions={
          <>
            <FriendsLink />
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-full p-2 text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Settings className="size-5" strokeWidth={1.75} />
            </Link>
          </>
        }
      />

      <div className="flex items-center gap-4 pt-3 pb-6 sm:gap-[18px]">
        <Avatar name={profile.name} src={profile.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[24px] leading-tight font-semibold tracking-tight sm:text-[26px]">{profile.name}</p>
          <p className="truncate text-[14px] text-subtle">{profile.email}</p>
          {streak > 0 && (
            <div className="mt-2.5">
              <StreakBadge days={streak} />
            </div>
          )}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="profile sections"
        className="sticky top-0 z-10 flex gap-7 border-b border-line bg-background"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={t === tab}
            aria-controls="profile-panel"
            onClick={() => setTab(t)}
            className={cn(
              "relative -mb-px border-b-2 pt-3 pb-3.5 text-[17px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              t === tab ? "border-brand font-medium text-foreground" : "border-transparent text-subtle hover:text-foreground/80",
            )}
          >
            {t}
            {counts[t] ? <span className="ml-1.5 text-[12px] font-normal text-subtle tabular-nums">{counts[t]}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="profile-panel" aria-labelledby={`tab-${tab}`} className="pt-5">
        {tab === "progress" && <ProgressTab sessions={sessions} />}
        {tab === "sessions" && <SessionsTab sessions={sessions} />}
        {tab === "saved" && <SavedTab sessions={sessions} />}
      </div>
    </ProfileColumn>
  );
}
