import { LockIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Shown instead of a screen's content when the API answers 403: the role can't do this. Hiding
 * links is only a convenience; this is what someone sees when they reach the page anyway.
 */
export function NoPermission() {
  const t = useTranslations("NoPermission");
  return (
    <div className="rounded-xl border border-line bg-surface">
      <EmptyState
        icon={<LockIcon aria-hidden />}
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild variant="secondary">
            <Link href="/">{t("backHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
