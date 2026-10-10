import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "new password · LMS." };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
