"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useState } from "react";
import { AppColumn, BackHeader } from "@/components/common/Layout";
import { SegmentedPicker } from "@/components/common/SegmentedPicker";
import { Avatar, StreakPill } from "@/components/common/UserBits";
import { ProgressTab } from "@/components/profile/ProgressTab";
import { SavedTab } from "@/components/profile/SavedTab";
import { SessionsTab } from "@/components/profile/SessionsTab";
import { useCompletedSessions, useProfile } from "@/lib/data";
import { activityFromSessions, currentStreak } from "@/lib/stats";

const TABS = ["progress", "sessions", "saved"] as const;
type Tab = (typeof TABS)[number];

/**
 * The profile: who you are, then one tab at a time — progress (the dashboard),
 * sessions (history) and saved questions. Preferences and account live on
 * /settings, behind the gear.
 */
export function ProfileView() {
  const { data: profile } = useProfile();
  const { data: sessions } = useCompletedSessions();
  const [tab, setTab] = useState<Tab>("progress");

  if (!profile || !sessions) return null;

  const streak = currentStreak(activityFromSessions(sessions));

  return (
    <AppColumn className="pb-12">
      <BackHeader title="profile" href="/setup" />

      <div className="flex items-center gap-3 pt-4 pb-6 sm:gap-4">
        <Avatar name={profile.name} size={60} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[22px] leading-tight font-medium">{profile.name}</p>
          <p className="truncate text-[14px] text-subtle">{profile.email}</p>
        </div>
        {streak > 0 && <StreakPill days={streak} />}
        <Link
          href="/settings"
          aria-label="Settings"
          className="-mr-2 shrink-0 rounded-full p-2 text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Settings className="size-5" strokeWidth={1.75} />
        </Link>
      </div>

      <SegmentedPicker<Tab>
        label="profile sections"
        options={TABS}
        value={tab}
        onChange={setTab}
        className="border-b border-line"
      />

      {tab === "progress" && <ProgressTab sessions={sessions} />}
      {tab === "sessions" && <SessionsTab sessions={sessions} />}
      {tab === "saved" && <SavedTab sessions={sessions} />}
    </AppColumn>
  );
}
