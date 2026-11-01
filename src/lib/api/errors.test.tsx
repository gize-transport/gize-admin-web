import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/en.json";
import { defaultLocale, timeZone } from "../../i18n/config";
import { useApiErrorMessages } from "./errors";
import { ApiError } from "./problem";

function wrapper({ children }: { children: ReactNode }) {
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

function httpError(status: number, body: unknown) {
  return ApiError.fromResponse(new Response(null, { status }), body);
}

function useMessages() {
  return renderHook(() => useApiErrorMessages(), { wrapper }).result.current;
}

describe("useApiErrorMessages", () => {
  it("has a friendly message for every API error code", () => {
    const { message } = useMessages();
    for (const code of Object.keys(messages.Errors)) {
      const text = message(
        httpError(409, {
          type: "about:blank",
          title: code,
          status: 409,
          code,
          request_id: null,
        }),
      );
      expect(text).toBe(messages.Errors[code as keyof typeof messages.Errors]);
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it("falls back to a general message for a code it doesn't know yet", () => {
    const { message } = useMessages();

    expect(
      message(
        httpError(409, {
          type: "about:blank",
          title: "New",
          status: 409,
          code: "SOMETHING_NEW",
          request_id: null,
        }),
      ),
    ).toBe(messages.Problems.unknown);
  });

  it("explains network failures and unexpected errors", () => {
    const { message } = useMessages();

    expect(message(ApiError.network(new TypeError("Failed to fetch")))).toBe(
      messages.Problems.network,
    );
    expect(message(new Error("bug"))).toBe(messages.Problems.unknown);
  });

  it("maps validation errors to form fields with a reason", () => {
    const { fieldMessages } = useMessages();
    const error = httpError(422, {
      type: "about:blank",
      title: "Validation failed",
      status: 422,
      code: "VALIDATION_FAILED",
      request_id: "req-1",
      errors: [
        { location: "body", field: "/name", reason: "too_long" },
        { location: "body", field: "/contact_phone", reason: "invalid_format" },
        { location: "query", field: "/limit", reason: "out_of_range" },
      ],
      errors_truncated: false,
    });

    expect(fieldMessages(error)).toEqual({
      name: messages.ValidationReasons.too_long,
      contact_phone: messages.ValidationReasons.invalid_format,
    });
    expect(fieldMessages(new Error("bug"))).toEqual({});
  });
});
