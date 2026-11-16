import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileSkeleton } from "@/components/profile/parts";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = { title: "profile · LMS." };

// The open tab is read from the URL on the client, hence the boundary.
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton title="profile" href="/setup" />}>
      <ProfileView />
    </Suspense>
  );
}
