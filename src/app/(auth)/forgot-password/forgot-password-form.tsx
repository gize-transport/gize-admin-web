"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlertIcon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  type PasswordFailureReason,
} from "@/lib/auth/password";
import { SIGN_IN_PATH } from "@/lib/auth/paths";

/**
 * Asks Supabase to email a reset link. The answer is the same whether or not the email has an
 * account, so the page never tells anyone which emails are staff.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("ForgotPassword");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<PasswordFailureReason | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t("emailRequired"))
          .pipe(z.email(t("emailInvalid"))),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  // The outcome takes focus, so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (sentTo !== null || failure !== null) resultRef.current?.focus();
  }, [sentTo, failure]);

  const onSubmit = handleSubmit(async ({ email }) => {
    setFailure(null);
    const result = await requestPasswordReset(email.toLowerCase());
    if (result.ok) setSentTo(email);
    else setFailure(result.reason);
  });

  const backLink = (
    <Link
      href={SIGN_IN_PATH}
      className="w-fit text-table font-semibold text-royal underline-offset-4 hover:underline"
    >
      {t("backToSignIn")}
    </Link>
  );

  if (sentTo !== null) {
    return (
      <div className="grid gap-5">
        <div ref={resultRef} tabIndex={-1} className="outline-none">
          <Alert>
            <MailCheckIcon aria-hidden />
            <AlertTitle>{t("sentTitle")}</AlertTitle>
            <AlertDescription>{t("sent", { email: sentTo })}</AlertDescription>
          </Alert>
        </div>
        {backLink}
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      {failure && (
        <div ref={resultRef} tabIndex={-1} className="outline-none">
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>{t("failedTitle")}</AlertTitle>
            <AlertDescription>{t(`reasons.${failure}`)}</AlertDescription>
          </Alert>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="forgot-email">{t("email")}</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="forgot-email-error" className="text-table text-danger">
            {errors.email.message}
          </p>
        )}
      </div>
      <Button type="submit" pending={isSubmitting} className="w-full">
        {t("submit")}
      </Button>
      {backLink}
    </form>
  );
}
