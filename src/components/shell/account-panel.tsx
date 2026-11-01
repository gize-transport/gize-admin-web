"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useSignOut } from "@/lib/auth/use-sign-out";

/**
 * Foot of the sidebar: who is signed in, with Sign out (as in the Admin mockup). The shell signs
 * out someone the API says isn't (active) staff; meanwhile this shows the loading state.
 */
export function AccountPanel() {
  const t = useTranslations("Shell");
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

  const forbidden = isForbidden(staff.error);

  return (
    <div className="grid gap-3 border-t border-white/15 pt-4">
      {staff.isPending || forbidden ? (
        <div role="status" className="grid gap-1.5 px-2">
          <span className="sr-only">{t("loadingAccount")}</span>
          <Skeleton className="h-4 w-32 bg-white/15" />
          <Skeleton className="h-3 w-16 bg-white/15" />
        </div>
      ) : staff.isError ? (
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
      ) : (
        <div className="grid min-w-0 gap-0.5 px-2">
          <p className="truncate text-table font-semibold text-white">
            {staff.data.full_name}
          </p>
          <p className="text-meta text-white/75">{tRoles(staff.data.role)}</p>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        pending={signingOut}
        onClick={signOut}
        className="justify-start px-2 text-white hover:bg-white/10 focus-visible:outline-white"
      >
        {t("signOut")}
      </Button>
    </div>
  );
}
