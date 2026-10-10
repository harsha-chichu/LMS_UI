import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportView } from "@/components/report/ReportView";

export const metadata: Metadata = { title: "session report · LMS." };

// Reports live in browser storage, so the id is read on the client.
export default function ReportPage() {
  return (
    <Suspense>
      <ReportView />
    </Suspense>
  );
}
