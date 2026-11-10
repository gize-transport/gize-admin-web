import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import {
  EMAIL_VERIFY_PATH,
  FORGOT_PASSWORD_PATH,
  SIGN_IN_PATH,
} from "@/lib/auth/paths";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EmailLink");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const linkClass =
  "w-fit text-table font-semibold text-royal underline-offset-4 hover:underline";

/**
 * Where an invitation or reset email's link lands (GZW-012). Opening it changes nothing: some
 * mail systems open every link to scan it, and the link works only once. The person presses
 * Continue, which posts the link to auth/verify. A plain form, so it works before any script.
 */
export default async function EmailLinkPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  const t = await getTranslations("EmailLink");
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const type = params.type;
  const usable =
    params.link !== "expired" &&
    typeof tokenHash === "string" &&
    tokenHash !== "" &&
    (type === "invite" || type === "recovery");

  if (!usable) {
    return (
      <AuthCard title={t("expiredTitle")} description={t("expired")}>
        <div className="grid gap-2">
          <Link href={FORGOT_PASSWORD_PATH} className={linkClass}>
            {t("askNewLink")}
          </Link>
          <Link href={SIGN_IN_PATH} className={linkClass}>
            {t("signIn")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t(type === "invite" ? "inviteTitle" : "recoveryTitle")}
      description={t("description")}
    >
      <form method="post" action={EMAIL_VERIFY_PATH} className="grid gap-5">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <Button type="submit" className="w-full">
          {t("continue")}
        </Button>
      </form>
    </AuthCard>
  );
}
