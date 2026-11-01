import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  // Next.js adds noindex to 404 responses itself.
  return { title: t("metaTitle") };
}

/** Any address that doesn't exist (and screens that call notFound()). */
export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="grid max-w-md justify-items-start gap-4 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <p className="font-mono text-meta text-muted">{t("code")}</p>
        <h1 className="font-display text-title font-semibold text-navy">
          {t("title")}
        </h1>
        <p className="text-body text-muted">{t("description")}</p>
        <Button asChild>
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </main>
  );
}
