import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SetPassword");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * "Set your password" (GZW-012): after an invitation or reset email's link signed the person in
 * (auth/confirm). Signed-out visitors are sent to sign-in (middleware.ts).
 */
export default function SetPasswordPage() {
  const t = useTranslations("SetPassword");
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <SetPasswordForm />
    </AuthCard>
  );
}
