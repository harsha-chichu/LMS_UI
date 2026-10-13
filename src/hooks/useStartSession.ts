"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSession, retrySession } from "@/lib/data";
import type { SessionConfig } from "@/types";

/**
 * Creates a session and opens it. `pending` covers both the request and the
 * navigation, and clears once the session screen has rendered — so a page kept
 * alive by cacheComponents isn't stuck on "preparing…" when the user comes back.
 */
export function useStartSession() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** New questions with these settings. */
  const start = (config: SessionConfig) => open(() => createSession(config));
  /** The same questions as a finished session. */
  const retry = (sessionId: string) => open(() => retrySession(sessionId));

  async function open(create: () => Promise<string>) {
    setCreating(true);
    setError(null);
    try {
      const id = await create();
      // Cleared inside the transition, so the button stays pending until the new page shows.
      startNavigation(() => {
        setCreating(false);
        router.push(`/session/${id}`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't prepare your questions. try again.");
      setCreating(false);
    }
  }

  return { start, retry, pending: creating || navigating, error };
}
