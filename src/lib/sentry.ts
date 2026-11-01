import type { Breadcrumb, BrowserOptions, ErrorEvent } from "@sentry/nextjs";

// Error reporting (engineering-standards.md): nothing personal leaves the browser. No user,
// cookies, headers, bodies or query strings (filters can hold names); no console output.

function withoutQuery(url: unknown) {
  return typeof url === "string" ? url.replace(/[?#].*$/, "") : url;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    event.request = {
      url: withoutQuery(event.request.url) as string | undefined,
    };
  }
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  const data = breadcrumb.data;
  if (data) {
    for (const key of ["url", "from", "to"]) {
      if (key in data) data[key] = withoutQuery(data[key]);
    }
  }
  return breadcrumb;
}

/** Options for `Sentry.init` in the browser (instrumentation-client.ts). */
export function sentryOptions(dsn: string): BrowserOptions {
  return {
    dsn,
    // Sentry 11 collects all of these by default; turn every one off (scrubEvent below is a
    // second layer).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
