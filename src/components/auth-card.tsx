import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * The card the signed-out pages share (sign-in, forgot password, set password): the logo, the
 * page's name as its h1 and a short description, then the page's own content.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
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
              {title}
            </h1>
            <p className="text-table text-muted">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
