import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionScreen } from "@/components/session/SessionScreen";

export const metadata: Metadata = { title: "session · LMS." };

// Session state is loaded on the client, so the id is read there too.
export default function SessionPage() {
  return (
    <Suspense>
      <SessionScreen />
    </Suspense>
  );
}
