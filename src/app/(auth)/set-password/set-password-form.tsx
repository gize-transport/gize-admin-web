"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { showSuccessToast } from "@/components/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  passwordBytes,
  setPassword,
  type PasswordFailureReason,
} from "@/lib/auth/password";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/paths";

/**
 * The new password, twice; the rule is shown before typing. Then into the portal, whose staff
 * check decides what happens next (an invited person's first sign-in is recorded there).
 */
export function SetPasswordForm() {
  const t = useTranslations("SetPassword");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<PasswordFailureReason | null>(null);
  // After success the page changes; until it does, the button stays busy (no second submit).
  const [redirecting, setRedirecting] = useState(false);
  const failureRef = useRef<HTMLDivElement>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(1, t("passwordRequired"))
            .min(
              MIN_PASSWORD_LENGTH,
              t("tooShort", { min: MIN_PASSWORD_LENGTH }),
            )
            .refine(
              (value) => passwordBytes(value) <= MAX_PASSWORD_BYTES,
              t("tooLong"),
            ),
          confirm: z.string(),
        })
        .refine((values) => values.confirm === values.password, {
          path: ["confirm"],
          message: t("mismatch"),
        }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  const onSubmit = handleSubmit(async ({ password }) => {
    setFailure(null);
    const result = await setPassword(password);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    setRedirecting(true);
    showSuccessToast(t(result.othersSignedOut ? "done" : "doneOthersFailed"));
    // Nothing cached from before the link may show.
    queryClient.clear();
    router.replace("/");
    router.refresh();
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      {failure && (
        <div ref={failureRef} tabIndex={-1} className="outline-none">
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>{t("failedTitle")}</AlertTitle>
            <AlertDescription className="grid gap-2">
              <span>{t(`reasons.${failure}`)}</span>
              {failure === "link_expired" && (
                <Link
                  href={FORGOT_PASSWORD_PATH}
                  className="w-fit font-semibold text-royal underline-offset-4 hover:underline"
                >
                  {t("askNewLink")}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      <p id="set-password-rules" className="text-table text-muted">
        {t("rules", { min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_BYTES })}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="new-password">{t("password")}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={
            errors.password
              ? "set-password-rules new-password-error"
              : "set-password-rules"
          }
          {...register("password")}
        />
        {errors.password && (
          <p id="new-password-error" className="text-table text-danger">
            {errors.password.message}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-password">{t("confirm")}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={
            errors.confirm ? "confirm-password-error" : undefined
          }
          {...register("confirm")}
        />
        {errors.confirm && (
          <p id="confirm-password-error" className="text-table text-danger">
            {errors.confirm.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        pending={isSubmitting || redirecting}
        className="w-full"
      >
        {t("submit")}
      </Button>
    </form>
  );
}
