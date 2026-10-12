import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendReportView } from "@/components/friends/FriendProfileView";

export const metadata: Metadata = { title: "friend's report · LMS." };

export default function FriendReportPage() {
  return (
    <Suspense>
      <FriendReportView />
    </Suspense>
  );
}
