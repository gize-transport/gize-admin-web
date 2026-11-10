import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SignIn");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Email and password sign-in (Supabase Auth); only active staff get in (GZW-010). */
export default function SignInPage() {
  const t = useTranslations("SignIn");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-sm gap-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="grid justify-items-start gap-4">
          {/* 128 px file shown at 48 px, served as is: too small to need an image service. */}
          <Image
            src="/brand/logo-mark.png"
            alt={t("logoAlt")}
            width={48}
            height={48}
            unoptimized
            priority
          />
          <div className="grid gap-1">
            <h1 className="font-display text-title font-semibold text-navy">
              {t("title")}
            </h1>
            <p className="text-table text-muted">{t("description")}</p>
          </div>
        </div>
        {/* The form reads ?next and ?reason from the URL, so it renders on the client. */}
        <Suspense fallback={<FormPlaceholder />}>
          <SignInForm />
        </Suspense>
        <p className="text-meta text-muted">{t("help")}</p>
      </div>
    </main>
  );
}

/** Same height as the form, so the card doesn't jump when it appears. */
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
