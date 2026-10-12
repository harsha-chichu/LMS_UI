import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendProfileView } from "@/components/friends/FriendProfileView";

export const metadata: Metadata = { title: "friend · LMS." };

export default function FriendPage() {
  return (
    <Suspense>
      <FriendProfileView />
    </Suspense>
  );
}
