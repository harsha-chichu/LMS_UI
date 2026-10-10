import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "sign up · LMS." };

export default function SignupPage() {
  return <SignupForm />;
}
