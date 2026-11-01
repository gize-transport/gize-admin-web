import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, sentryOptions } from "./sentry";

describe("sentryOptions", () => {
  it("never sends personal data or traces", () => {
    const options = sentryOptions("https://key@o1.ingest.sentry.io/1");

    expect(options).toMatchObject({
      dsn: "https://key@o1.ingest.sentry.io/1",
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
    });
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });
});

describe("scrubEvent", () => {
  it("removes the user, cookies, headers, bodies and query strings", () => {
    const event = scrubEvent({
      type: undefined,
      user: {
        id: "staff-1",
        email: "staff@example.com",
        ip_address: "1.2.3.4",
      },
      request: {
        url: "https://admin.gizetransport.com/riders?status=active#top",
        query_string: "status=active",
        cookies: { "sb-access-token": "secret" },
        headers: { Authorization: "Bearer secret" },
        data: { contact_phone: "+251911000000" },
      },
    } as ErrorEvent);

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({
      url: "https://admin.gizetransport.com/riders",
    });
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs", () => {
    expect(
      scrubBreadcrumb({ category: "console", message: "anything" }),
    ).toBeNull();
  });

  it("keeps fetch breadcrumbs without query strings", () => {
    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "https://api.gizetransport.com/v1/routes?q=ICS&cursor=abc",
        method: "GET",
        status_code: 200,
      },
    };

    expect(scrubBreadcrumb(breadcrumb)?.data).toEqual({
      url: "https://api.gizetransport.com/v1/routes",
      method: "GET",
      status_code: 200,
    });
  });

  it("strips query strings from navigation breadcrumbs", () => {
    expect(
      scrubBreadcrumb({
        category: "navigation",
        data: { from: "/riders?status=active", to: "/riders/1?tab=routes" },
      })?.data,
    ).toEqual({ from: "/riders", to: "/riders/1" });
  });
});
