import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is rendered for its request: the Content Security Policy's nonce is new each time
  // (middleware.ts), and a page built ahead couldn't carry it.
  await connection();
  const locale = await getLocale();
  const t = await getTranslations("Common");

  return (
    <html lang={locale} className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
        <Toaster label={t("notifications")} />
      </body>
    </html>
  );
}
