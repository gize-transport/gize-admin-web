import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type messages from "../../../messages/en.json";
import { ApiError, type ErrorCode, type ValidationReason } from "./problem";

// Every error code and validation reason in the contract has a message in messages/en.json,
// and every message there belongs to a real one: these fail `npm run typecheck` otherwise
// (e.g. after `contract:sync` brings a new code).
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type ErrorMessagesCoverEveryCode = Assert<
  Exactly<keyof (typeof messages)["Errors"], ErrorCode>
>;
export type ReasonMessagesCoverEveryReason = Assert<
  Exactly<keyof (typeof messages)["ValidationReasons"], ValidationReason>
>;

/**
 * Friendly text for API errors:
 * - `message(error)`: one sentence for any error a query or mutation throws;
 * - `fieldMessages(error)`: a reason per form field path (`contact_phone`, `area_ids.2`), for
 *   react-hook-form's `setError`. Errors outside the request body (query, path) are left out.
 */
export function useApiErrorMessages() {
  const tErrors = useTranslations("Errors");
  const tReasons = useTranslations("ValidationReasons");
  const tProblems = useTranslations("Problems");

  const message = useCallback(
    (error: unknown): string => {
      if (!(error instanceof ApiError)) return tProblems("unknown");
      if (error.kind === "network") return tProblems("network");
      // A code newer than our pinned contract has no message yet.
      const code = error.code as ErrorCode | null;
      if (code !== null && tErrors.has(code)) return tErrors(code);
      return tProblems("unknown");
    },
    [tErrors, tProblems],
  );

  const fieldMessages = useCallback(
    (error: unknown): Record<string, string> => {
      if (!(error instanceof ApiError)) return {};
      const result: Record<string, string> = {};
      for (const fieldError of error.fieldErrors) {
        if (fieldError.location !== "body" || fieldError.path === "") continue;
        result[fieldError.path] ??= tReasons.has(fieldError.reason)
          ? tReasons(fieldError.reason)
          : tReasons("invalid");
      }
      return result;
    },
    [tReasons],
  );

  return { message, fieldMessages };
}
