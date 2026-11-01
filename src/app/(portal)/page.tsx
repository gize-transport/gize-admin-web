import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/page-header";

// Temporary placeholder: "/" redirects to /routes once the Routes screen exists (GZW-021);
// the real Overview comes with GZW-070.
export default function OverviewPage() {
  const t = useTranslations("Overview");
  return <PageHeader title={t("title")} description={t("description")} />;
}
