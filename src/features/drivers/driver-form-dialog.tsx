"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
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
import { returnFocus } from "@/lib/focus";
import { mobileE164, PHONE_TYPED_MAX } from "@/lib/phone";
import { refetchDriver, useCreateDriver, useUpdateDriver } from "./queries";

type DriverRead = components["schemas"]["DriverRead"];
type DriverCreate = components["schemas"]["DriverCreate"];
type DriverUpdate = components["schemas"]["DriverUpdate"];

// The contract's limits (DriverCreate / DriverUpdate).
const NAME_MAX = 100;
const ADDRESS_MAX = 200;
const PLATE_MIN = 2;
const PLATE_MAX = 40;
/** In the order shown: the first one refused gets focus. */
const fields = ["full_name", "phone", "address", "plate"] as const;

/** A plate as the API stores it: capitals, single spaces. */
const storedPlate = (typed: string) =>
  typed.trim().replace(/\s+/g, " ").toUpperCase();

type DriverFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The driver to edit; omitted to add one. */
  driver?: DriverRead;
  /** After adding: e.g. open them beside the list. */
  onAdded?: (driver: DriverRead) => void;
};

/**
 * Add or edit a driver: name, phone, address and the plate of the van they drive. Mount it with a
 * new `key` each time it opens, so every add gets a fresh form and its own Idempotency-Key (kept
 * for retries of that add). Their details are personal data: they only go to the API, never into
 * URLs, toasts or logs.
 */
export function DriverFormDialog({
  open,
  onOpenChange,
  driver,
  onAdded,
}: DriverFormDialogProps) {
  const t = useTranslations("Drivers");
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const create = useCreateDriver();
  const update = useUpdateDriver();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || update.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);

  const schema = useMemo(
    () =>
      z.object({
        full_name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(NAME_MAX, t("nameTooLong")),
        phone: z
          .string()
          .trim()
          .max(PHONE_TYPED_MAX, t("phoneInvalid"))
          .refine((value) => mobileE164(value) !== null, t("phoneInvalid")),
        address: z
          .string()
          .trim()
          .min(1, t("addressRequired"))
          .max(ADDRESS_MAX, t("addressTooLong")),
        plate: z
          .string()
          .trim()
          .min(PLATE_MIN, t("plateInvalid"))
          .max(PLATE_MAX, t("plateInvalid")),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: driver?.full_name ?? "",
      phone: driver?.phone ?? "",
      address: driver?.address ?? "",
      plate: driver?.plate ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      if (driver) {
        const change: DriverUpdate = {};
        if (values.full_name !== driver.full_name) {
          change.full_name = values.full_name;
        }
        // The same number or plate written another way is no change.
        if (mobileE164(values.phone) !== driver.phone) {
          change.phone = values.phone;
        }
        if (values.address !== driver.address) change.address = values.address;
        if (storedPlate(values.plate) !== driver.plate) {
          change.plate = values.plate;
        }
        if (Object.keys(change).length > 0) {
          await update.mutateAsync({ id: driver.id, change });
          showSuccessToast(t("savedToast"));
        }
      } else {
        const body: DriverCreate = {
          full_name: values.full_name,
          phone: values.phone,
          address: values.address,
          plate: values.plate,
        };
        const added = await create.mutateAsync({
          driver: body,
          idempotencyKey,
        });
        showSuccessToast(t("addedToast"));
        onAdded?.(added);
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "DRIVER_EXISTS") {
        setError("phone", { message: tErrors("DRIVER_EXISTS") });
        setFocus("phone");
        return;
      }
      if (error instanceof ApiError && error.code === "PLATE_TAKEN") {
        setError("plate", { message: tErrors("PLATE_TAKEN") });
        setFocus("plate");
        return;
      }
      const onFields = fieldMessages(error);
      // The API's plate rule (letters, digits, spaces, dashes; 20 at most) isn't in the contract:
      // a refused plate says it.
      if (onFields.plate) onFields.plate = t("plateRefused");
      const failed = fields.filter((field) => onFields[field]);
      const [first] = failed;
      if (first) {
        for (const field of failed) {
          setError(field, { message: onFields[field] });
        }
        setFocus(first);
        return;
      }
      setProblem(error);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        // Deleted while being edited: their detail shows that once the form closes.
        if (
          !next &&
          driver &&
          problem instanceof ApiError &&
          problem.status === 404
        ) {
          refetchDriver(queryClient, driver.id);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-lg"
        onOpenAutoFocus={() => {
          returnFocusTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => returnFocus(event, returnFocusTo.current)}
      >
        <div className="grid gap-1">
          <DialogTitle>
            {driver
              ? t("editTitle", { name: driver.full_name })
              : t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
        </div>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          {problem !== null && (
            <ProblemAlert
              message={message(problem)}
              requestId={problem instanceof ApiError ? problem.requestId : null}
              retryAfterSeconds={
                problem instanceof ApiError ? problem.retryAfterSeconds : null
              }
            />
          )}
          <FormField
            id={`${uid}-driver-name`}
            label={t("nameLabel")}
            error={errors.full_name}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={NAME_MAX}
                autoComplete="off"
                {...register("full_name")}
              />
            )}
          </FormField>
          <FormField
            id={`${uid}-driver-phone`}
            label={t("phoneLabel")}
            hint={t("phoneHint")}
            error={errors.phone}
          >
            {(aria) => (
              <Input
                {...aria}
                type="tel"
                inputMode="tel"
                maxLength={PHONE_TYPED_MAX}
                autoComplete="off"
                {...register("phone")}
              />
            )}
          </FormField>
          <FormField
            id={`${uid}-driver-address`}
            label={t("addressLabel")}
            hint={t("addressHint")}
            error={errors.address}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={ADDRESS_MAX}
                autoComplete="off"
                {...register("address")}
              />
            )}
          </FormField>
          <FormField
            id={`${uid}-driver-plate`}
            label={t("plateLabel")}
            hint={t("plateHint")}
            error={errors.plate}
          >
            {(aria) => (
              <Input
                {...aria}
                maxLength={PLATE_MAX}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                {...register("plate")}
              />
            )}
          </FormField>
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
