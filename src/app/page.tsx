import { useTranslations } from "next-intl";

// Temporary placeholder: "/" redirects to /routes once the Routes screen exists (GZW-021).
export default function HomePage() {
  const t = useTranslations("HomePage");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="text-base">{t("description")}</p>
    </main>
  );
}
