import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { devPagesEnabled } from "@/lib/dev-pages";
import { ComponentsGallery } from "./components-gallery";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DevComponents");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Dev-only gallery of the shared components (GZW-005). A 404 in deployed builds. */
export default function DevComponentsPage() {
  if (!devPagesEnabled()) notFound();

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-8 md:px-8 md:py-10">
      <GalleryHeader />
      <ComponentsGallery />
    </main>
  );
}

function GalleryHeader() {
  const t = useTranslations("DevComponents");
  return (
    <PageHeader
      title={t("title")}
      description={t("description")}
      actions={<Button>{t("headerAction")}</Button>}
    />
  );
}
