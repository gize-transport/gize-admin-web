import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/paths";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignIn");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Email and password sign-in (Supabase Auth); only active staff get in (GZW-010). */
export default function SignInPage() {
  const t = useTranslations("SignIn");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      {/* The form reads ?next and ?reason from the URL, so it renders on the client. */}
      <Suspense fallback={<FormPlaceholder />}>
        <SignInForm />
      </Suspense>
      <div className="grid gap-2">
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="w-fit text-table font-semibold text-royal underline-offset-4 hover:underline"
        >
          {t("forgotPassword")}
        </Link>
        <p className="text-meta text-muted">{t("help")}</p>
      </div>
    </AuthCard>
  );
}

/** Same height as the form, so the page doesn't jump when it appears. */
function FormPlaceholder() {
  return (
    <div aria-hidden className="grid gap-5">
      {[0, 1].map((field) => (
        <div key={field} className="grid gap-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
