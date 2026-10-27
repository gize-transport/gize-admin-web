import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import messages from "../../messages/en.json";
import { defaultLocale, timeZone } from "../../src/i18n/config";

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={defaultLocale}
      messages={messages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/** Renders a component with the same providers the app uses (translations for now). */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: Providers, ...options });
}
