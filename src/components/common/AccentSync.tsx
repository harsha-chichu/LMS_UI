"use client";

import { useEffect } from "react";
import { applyAccent, currentAccent, normalizeAccent } from "@/lib/accent";
import { useProfile } from "@/lib/data";

/** Brings the accent saved on the account onto this device (e.g. after signing in elsewhere). */
export function AccentSync() {
  const { data: profile } = useProfile();
  const saved = profile?.preferences.accent;

  // Only act on an explicit choice; picking orange saves it too, so a missing
  // value never needs to reset the page.
  useEffect(() => {
    const accent = saved && normalizeAccent(saved);
    if (accent && accent !== currentAccent()) applyAccent(accent);
  }, [saved]);

  return null;
}
