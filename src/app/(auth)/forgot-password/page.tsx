import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ForgotPassword");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** "Forgot your password?" (GZW-012): emails a link to set a new one. */
export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPassword");
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
