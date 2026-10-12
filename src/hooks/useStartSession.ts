"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSession } from "@/lib/data";
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

  async function start(config: SessionConfig) {
    setCreating(true);
    setError(null);
    try {
      const id = await createSession(config);
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

  return { start, pending: creating || navigating, error };
}
