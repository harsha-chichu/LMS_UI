import { Suspense } from "react";
import { AccentSync } from "@/components/common/AccentSync";
import { AnnouncementBanner } from "@/components/common/AnnouncementBanner";
import { WelcomeDialog } from "@/components/common/WelcomeDialog";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AccentSync />
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      <WelcomeDialog />
      {children}
    </div>
  );
}
