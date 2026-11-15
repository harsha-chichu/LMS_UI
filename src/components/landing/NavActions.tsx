"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PillLink } from "@/components/common/PillButton";
import { getSupabase } from "@/lib/supabase/client";

const PILL = "h-9 px-4 text-[14px] md:h-11 md:px-5 md:text-[15px]";

/**
 * The right-hand side of the landing nav: log in / sign up, or a way back
 * into the app for someone already signed in. Checked in the browser so the
 * landing page itself stays static.
 */
export function NavActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const auth = getSupabase().auth;
    void auth.getSession().then((result: { data: { session: Session | null } }) => setSignedIn(Boolean(result.data.session)));
    const { data } = auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  if (signedIn) {
    return (
      <PillLink href="/setup" size="sm" arrow className={PILL}>
        go to practice
      </PillLink>
    );
  }

  return (
    <>
      <Link href="/login" className="px-2 text-[14px] text-foreground hover:text-foreground/80 md:text-[15px]">
        log in
      </Link>
      <PillLink href="/signup" size="sm" className={PILL}>
        sign up
      </PillLink>
    </>
  );
}
