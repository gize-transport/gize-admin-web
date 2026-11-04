"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AreaPicker } from "@/components/pickers/area-picker";
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
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { returnFocus } from "@/lib/focus";
import { areaKeys } from "@/features/areas/queries";
import { useCreateCorridor, useUpdateCorridor } from "./queries";

type AreaRef = components["schemas"]["AreaRef"];
type CorridorRead = components["schemas"]["CorridorRead"];
type CorridorUpdate = components["schemas"]["CorridorUpdate"];

const areaRef = z.object({ id: z.string(), name: z.string() });

/** The API's field names, for its 422s. */
const apiFields = {
  origin_area_id: "origin",
  destination_area_id: "destination",
} as const;

type CorridorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The corridor to change; omitted to add one. */
  corridor?: CorridorRead;
  /** Adding: the two areas to start from (e.g. an area pair route requests ask for). */
  initialAreas?: { origin: AreaRef; destination: AreaRef };
};

/**
 * Add or change a corridor: an origin and a destination area, two different ones. Mount it with
 * a new `key` each time it opens, so every add gets a fresh form and its own Idempotency-Key
 * (kept for retries of that add).
 */
export function CorridorFormDialog({
  open,
  onOpenChange,
  corridor,
  initialAreas,
}: CorridorFormDialogProps) {
  const t = useTranslations("Corridors");
  // Ids unique to this instance: Next can keep earlier pages (with their own copy of this) in the
  // document, and a duplicate id would label the wrong field.
  const uid = useId();
  const tCommon = useTranslations("Common");
  const { message, fieldMessages } = useApiErrorMessages();
  const queryClient = useQueryClient();
  const create = useCreateCorridor();
  const update = useUpdateCorridor();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  // The pair that was sent, to name it when the API says it already exists.
  const [sent, setSent] = useState<{ origin: string; destination: string }>();
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || update.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);

  const schema = useMemo(
    () =>
      z
        .object({
          origin: areaRef.nullable(),
          destination: areaRef.nullable(),
        })
        .superRefine(({ origin, destination }, ctx) => {
          if (!origin) {
            ctx.addIssue({
              code: "custom",
              path: ["origin"],
              message: t("originRequired"),
            });
          }
          if (!destination) {
            ctx.addIssue({
              code: "custom",
              path: ["destination"],
              message: t("destinationRequired"),
            });
          } else if (origin?.id === destination.id) {
            ctx.addIssue({
              code: "custom",
              path: ["destination"],
              message: t("sameArea"),
            });
          }
        }),
    [t],
  );
  const {
    control,
    handleSubmit,
    setError,
    setFocus,
    trigger,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      origin: corridor?.origin_area ?? initialAreas?.origin ?? null,
      destination:
        corridor?.destination_area ?? initialAreas?.destination ?? null,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    // The schema has checked both are chosen.
    const origin = values.origin as AreaRef;
    const destination = values.destination as AreaRef;
    setProblem(null);
    setSent({ origin: origin.name, destination: destination.name });
    try {
      if (corridor) {
        const change: CorridorUpdate = {};
        if (origin.id !== corridor.origin_area.id) {
          change.origin_area_id = origin.id;
        }
        if (destination.id !== corridor.destination_area.id) {
          change.destination_area_id = destination.id;
        }
        // Nothing changed: nothing to send (the API needs at least one end).
        if (Object.keys(change).length > 0) {
          const changed = await update.mutateAsync({
            id: corridor.id,
            change,
          });
          showSuccessToast(
            t("changed", {
              origin: changed.origin_area.name,
              destination: changed.destination_area.name,
            }),
          );
        }
      } else {
        const added = await create.mutateAsync({
          originAreaId: origin.id,
          destinationAreaId: destination.id,
          idempotencyKey,
        });
        showSuccessToast(
          t("added", {
            origin: added.origin_area.name,
            destination: added.destination_area.name,
          }),
        );
      }
      onOpenChange(false);
    } catch (error) {
      const fields = fieldMessages(error);
      const onField = Object.entries(apiFields).filter(
        ([apiField]) => fields[apiField],
      );
      const [first] = onField;
      if (first) {
        // An area the API doesn't know any more (deleted meanwhile): pickers stop offering it.
        void queryClient.invalidateQueries({ queryKey: areaKeys.all });
        for (const [apiField, field] of onField) {
          setError(field, { message: fields[apiField] });
        }
        setFocus(first[1]);
        return;
      }
      setProblem(error);
    }
  });

  function problemMessage(error: unknown) {
    if (error instanceof ApiError && error.code === "CORRIDOR_EXISTS" && sent) {
      return t("exists", sent);
    }
    if (error instanceof ApiError && error.code === "CORRIDOR_IN_USE") {
      return t("inUseEdit");
    }
    return message(error);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
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
          <DialogTitle>
            {corridor
              ? t("editTitle", {
                  origin: corridor.origin_area.name,
                  destination: corridor.destination_area.name,
                })
              : t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
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
          {(["origin", "destination"] as const).map((name) => (
            <div key={name} className="grid gap-1.5">
              <Label htmlFor={`${uid}-${name}`}>
                {t(name === "origin" ? "originLabel" : "destinationLabel")}
              </Label>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <AreaPicker
                    id={`${uid}-${name}`}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(area) => {
                      field.onChange(area);
                      // "Choose a different area" depends on both: check the destination again.
                      if (name === "origin" && errors.destination) {
                        void trigger("destination");
                      }
                    }}
                    invalid={Boolean(errors[name])}
                    aria-describedby={
                      errors[name] ? `${uid}-${name}-error` : undefined
                    }
                  />
                )}
              />
              {errors[name] && (
                <p
                  id={`${uid}-${name}-error`}
                  className="text-table text-danger"
                >
                  {errors[name].message}
                </p>
              )}
            </div>
          ))}
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
