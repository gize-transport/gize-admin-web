"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ProblemAlert } from "@/components/problem-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import { safeNextPath } from "@/lib/auth/paths";
import { signIn, type SignInResult } from "@/lib/auth/sign-in";
import { currentStaffQueryKey } from "@/lib/auth/use-current-staff";

type Failure = Exclude<SignInResult, { ok: true }>;

export function SignInForm() {
  const t = useTranslations("SignIn");
  const { message: apiMessage } = useApiErrorMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const failureRef = useRef<HTMLDivElement>(null);
  // After success the page changes; until it does, the button stays busy (no second submit).
  const [redirecting, setRedirecting] = useState(false);

  // A sign-out for not being staff lands here with ?reason=not_staff (useSignOut).
  const reason = searchParams.get("reason");
  const [failure, setFailure] = useState<Failure | null>(
    reason === "not_staff" ? { ok: false, reason: "not_staff" } : null,
  );

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, t("emailRequired"))
          .pipe(z.email(t("emailInvalid"))),
        password: z.string().min(1, t("passwordRequired")),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Move focus to a new failure so screen readers and keyboard users land on it.
  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  const onSubmit = handleSubmit(async (credentials) => {
    setFailure(null);
    const result = await signIn(credentials);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    setRedirecting(true);
    // A new person: nothing cached from before may show.
    queryClient.clear();
    queryClient.setQueryData(currentStaffQueryKey, result.staff);
    router.replace(safeNextPath(searchParams.get("next")));
    router.refresh();
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5">
      {reason === "signed_out" && !failure && (
        <p role="status" className="text-table text-muted">
          {t("signedOut")}
        </p>
      )}

      {failure && (
        <div ref={failureRef} tabIndex={-1} className="outline-none">
          {failure.reason === "api" ? (
            <ProblemAlert
              title={t("failedTitle")}
              message={apiMessage(failure.error)}
              requestId={
                failure.error instanceof ApiError
                  ? failure.error.requestId
                  : null
              }
            />
          ) : (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertTitle>{t("failedTitle")}</AlertTitle>
              <AlertDescription>
                {t(`reasons.${failure.reason}`)}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-table text-danger">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-table text-danger">
            {errors.password.message}
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
