"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/problem";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useSignOut } from "@/lib/auth/use-sign-out";

/**
 * Who is signed in, with Sign out. Temporary home content until the shell's header
 * (GZW-011) shows this.
 */
export function StaffGreeting() {
  const t = useTranslations("HomePage");
  const tRoles = useTranslations("Roles");
  const { message } = useApiErrorMessages();
  const staff = useCurrentStaff();
  const signOutNow = useSignOut();
  // Stays true until sign-in opens: the button can't be pressed twice.
  const [signingOut, setSigningOut] = useState(false);
  const signOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    void signOutNow();
  };

  // 403: signed in to Supabase but not (or no longer) active staff.
  const forbidden =
    staff.error instanceof ApiError && staff.error.status === 403;
  useEffect(() => {
    if (forbidden) void signOutNow("not_staff");
  }, [forbidden, signOutNow]);

  if (staff.isPending || forbidden) {
    return (
      <div role="status" className="grid gap-2">
        <span className="sr-only">{t("loadingStaff")}</span>
        <Skeleton className="h-5 w-64" />
      </div>
    );
  }

  const signOutButton = (
    <Button
      variant="secondary"
      size="sm"
      pending={signingOut}
      onClick={signOut}
    >
      {t("signOut")}
    </Button>
  );

  if (staff.isError) {
    // Signing out stays possible, whatever went wrong.
    return (
      <div className="grid justify-items-start gap-3">
        <ProblemAlert
          message={message(staff.error)}
          requestId={
            staff.error instanceof ApiError ? staff.error.requestId : null
          }
          retryAfterSeconds={
            staff.error instanceof ApiError
              ? staff.error.retryAfterSeconds
              : null
          }
          onRetry={() => void staff.refetch()}
        />
        {signOutButton}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-body">
        {t("signedInAs", {
          name: staff.data.full_name,
          role: tRoles(staff.data.role),
        })}
      </p>
      {signOutButton}
    </div>
  );
}
