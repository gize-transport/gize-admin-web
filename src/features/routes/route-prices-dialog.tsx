"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { ProblemAlert } from "@/components/problem-alert";
import { showSuccessToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";
import { returnFocus } from "@/lib/focus";
import { refetchRoute, useSetRoutePrices } from "./queries";

type RouteRead = components["schemas"]["RouteRead"];
type RoutePricesSet = components["schemas"]["RoutePricesSet"];

// The contract's limits (RoutePricesSet): whole birr a month. Text inputs with a numeric
// keyboard, not type="number": a number input reports what it can't read ("1,000", "3e") as
// empty, which for the optional Saturday price would silently mean "no add-on".
const PRICE_MAX = 100_000;
const fields = ["round_trip", "one_way", "saturday"] as const;

/** Whole birr from 1 to 100,000, or null. */
function price(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return amount >= 1 && amount <= PRICE_MAX ? amount : null;
}

type RoutePricesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** An individual route (public or student): corporate routes have no prices. */
  route: RouteRead;
};

/**
 * Set a route's prices (admins, GZW-022): round trip and one way, and a Saturday add-on on public
 * routes only (empty: none). All are sent at once. Mount it with a new `key` each time it opens.
 */
export function RoutePricesDialog({
  open,
  onOpenChange,
  route: routeProp,
}: RoutePricesDialogProps) {
  const t = useTranslations("Routes");
  const tCommon = useTranslations("Common");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const setPrices = useSetRoutePrices();
  // The route as the dialog opened with it: a refetch meanwhile can't change what "no change" is.
  const [route] = useState(routeProp);
  const [problem, setProblem] = useState<unknown>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = setPrices.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);
  const withSaturday = route.route_type === "public";

  const schema = useMemo(
    () =>
      z
        .object({
          round_trip: z.string().trim(),
          one_way: z.string().trim(),
          saturday: z.string().trim(),
        })
        .superRefine((values, ctx) => {
          for (const field of fields) {
            const optional = field === "saturday";
            if (optional && (!withSaturday || values[field] === "")) continue;
            if (price(values[field]) === null) {
              ctx.addIssue({
                code: "custom",
                path: [field],
                message: t("priceInvalid"),
              });
            }
          }
        }),
    [t, withSaturday],
  );

  const asText = (amount: number | null | undefined) =>
    amount == null ? "" : String(amount);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      round_trip: asText(route.prices?.round_trip),
      one_way: asText(route.prices?.one_way),
      saturday: asText(route.prices?.saturday),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const previous = problem;
    setProblem(null);
    const prices: RoutePricesSet = {
      round_trip: price(values.round_trip) ?? 0,
      one_way: price(values.one_way) ?? 0,
    };
    if (withSaturday) prices.saturday = price(values.saturday);
    const unchanged =
      prices.round_trip === route.prices?.round_trip &&
      prices.one_way === route.prices?.one_way &&
      (prices.saturday ?? null) === (route.prices?.saturday ?? null);
    try {
      if (!unchanged) {
        const saved = await setPrices.mutateAsync({ id: route.id, prices });
        showSuccessToast(t("pricesSaved", { code: saved.code }));
      } else if (previous instanceof ApiError && previous.status === 404) {
        // Deleted meanwhile: its detail shows that once the dialog closes.
        refetchRoute(queryClient, route.id);
      }
      onOpenChange(false);
    } catch (error) {
      const onFields = fieldMessages(error);
      const failed = fields.filter((field) => onFields[field]);
      const [first] = failed;
      if (first) {
        for (const field of failed) {
          setError(field, { message: onFields[field] });
        }
        setFocus(first);
        return;
      }
      // No longer an admin: the role is read again, so the price button goes.
      if (error instanceof ApiError && error.code === "FORBIDDEN") {
        void queryClient.invalidateQueries({ queryKey: currentStaffQueryKey });
      }
      setProblem(error);
    }
  });

  function problemMessage(error: unknown) {
    if (error instanceof ApiError) {
      if (error.code === "ROUTE_HAS_NO_PRICES")
        return t("noPricesForCorporate");
      if (error.code === "FORBIDDEN") return t("pricesAdminOnly");
    }
    return message(error);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted meanwhile: its detail shows that once the dialog closes.
        if (!next && problem instanceof ApiError && problem.status === 404) {
          refetchRoute(queryClient, route.id);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          returnFocusTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>{t("pricesTitle", { code: route.code })}</DialogTitle>
          <DialogDescription className="grid gap-1">
            <span>{t("pricesHint")}</span>{" "}
            {/* Announced with the dialog: the one consequence that can't be undone here. */}
            <span>{t("pricesFrozenNote")}</span>
          </DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={problemMessage(problem)}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}
          <FormField
            id="price-round-trip"
            label={t("roundTripLabel")}
            error={errors.round_trip}
          >
            {(aria) => (
              <Input
                {...aria}
                inputMode="numeric"
                autoComplete="off"
                {...register("round_trip")}
              />
            )}
          </FormField>
          <FormField
            id="price-one-way"
            label={t("oneWayLabel")}
            error={errors.one_way}
          >
            {(aria) => (
              <Input
                {...aria}
                inputMode="numeric"
                autoComplete="off"
                {...register("one_way")}
              />
            )}
          </FormField>
          {withSaturday && (
            <FormField
              id="price-saturday"
              label={t("saturdayLabel")}
              hint={t("saturdayHint")}
              error={errors.saturday}
            >
              {(aria) => (
                <Input
                  {...aria}
                  inputMode="numeric"
                  autoComplete="off"
                  {...register("saturday")}
                />
              )}
            </FormField>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" aria-disabled={pending || undefined}>
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              pending={pending}
              aria-disabled={waiting || undefined}
            >
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
