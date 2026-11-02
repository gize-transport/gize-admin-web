"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import { useRetryWait } from "@/lib/api/use-retry-wait";
import { useCreateArea, useRenameArea } from "./queries";

type AreaRead = components["schemas"]["AreaRead"];

/** Same limits as the contract's AreaWrite: trimmed, 1–100 characters. */
const NAME_MAX = 100;

type AreaFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The area to rename; omitted to add one. */
  area?: AreaRead;
};

/**
 * Add or rename an area. Mount it with a new `key` each time it opens, so every add gets a fresh
 * form and its own Idempotency-Key (kept for retries of that add).
 */
export function AreaFormDialog({
  open,
  onOpenChange,
  area,
}: AreaFormDialogProps) {
  const t = useTranslations("Areas");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const { message, fieldMessages } = useApiErrorMessages();
  const create = useCreateArea();
  const rename = useRenameArea();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [problem, setProblem] = useState<unknown>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const pending = create.isPending || rename.isPending;
  // After a 429, Save stays disabled until Retry-After has passed.
  const waiting = useRetryWait(problem);

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(NAME_MAX, t("nameTooLong")),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: area?.name ?? "" },
  });

  const onSubmit = handleSubmit(async ({ name }) => {
    setProblem(null);
    try {
      if (area) {
        const renamed = await rename.mutateAsync({ id: area.id, name });
        showSuccessToast(t("renamed", { name: renamed.name }));
      } else {
        const added = await create.mutateAsync({ name, idempotencyKey });
        showSuccessToast(t("added", { name: added.name }));
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "AREA_NAME_TAKEN") {
        setError("name", { message: tErrors("AREA_NAME_TAKEN") });
        setFocus("name");
        return;
      }
      const nameError = fieldMessages(error).name;
      if (nameError) {
        setError("name", { message: nameError });
        setFocus("name");
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
        onCloseAutoFocus={(event) => {
          if (returnFocusTo.current?.isConnected) {
            event.preventDefault();
            returnFocusTo.current.focus();
          }
        }}
      >
        <div className="grid gap-1">
          <DialogTitle>
            {area ? t("renameTitle", { name: area.name }) : t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("nameHint")}</DialogDescription>
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
          <div className="grid gap-1.5">
            <Label htmlFor="area-name">{t("nameLabel")}</Label>
            <Input
              id="area-name"
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "area-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="area-name-error" className="text-table text-danger">
                {errors.name.message}
              </p>
            )}
          </div>
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
