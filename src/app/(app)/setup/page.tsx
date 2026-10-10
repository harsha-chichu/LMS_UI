import type { Metadata } from "next";
import { SetupScreen } from "@/components/setup/SetupScreen";

export const metadata: Metadata = { title: "practice · LMS." };

export default function SetupPage() {
  return <SetupScreen />;
}
