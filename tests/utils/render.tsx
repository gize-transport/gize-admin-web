import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import messages from "../../messages/en.json";
import { defaultLocale, timeZone } from "../../src/i18n/config";

/** A query client for one test: no retries, so failures show at once. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/**
 * Renders a component with the same providers the app uses (translations and TanStack Query).
 * Pass `queryClient` to inspect or pre-fill the cache.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...options
  }: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient } = {},
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={defaultLocale}
        messages={messages}
        timeZone={timeZone}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Providers, ...options }) };
}
