"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import { useCurrentStaff } from "@/lib/auth/use-current-staff";
import { useSignOut } from "@/lib/auth/use-sign-out";

/**
 * Foot of the sidebar: who is signed in (initials, name and role), with Sign out (as in the Admin
 * mockup; a card since GZW-073). The shell signs
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
    <div className="grid gap-2 rounded-xl bg-white/5 p-2 ring-1 ring-white/15">
      {staff.isPending || forbidden ? (
        <div role="status" className="flex items-center gap-3 p-1">
          <span className="sr-only">{t("loadingAccount")}</span>
          <Skeleton className="size-9 shrink-0 rounded-full bg-white/15" />
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-28 bg-white/15" />
            <Skeleton className="h-3 w-14 bg-white/15" />
          </div>
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
        <div className="flex min-w-0 items-center gap-3 p-1">
          <Avatar name={staff.data.full_name} className="bg-sky text-navy" />
          <div className="grid min-w-0 justify-items-start gap-1">
            <p className="w-full truncate text-table font-semibold text-white">
              {staff.data.full_name}
            </p>
            <p className="rounded-full bg-white/10 px-2 text-meta leading-5 font-semibold text-white">
              {tRoles(staff.data.role)}
            </p>
          </div>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        pending={signingOut}
        onClick={signOut}
        className="justify-start px-2 text-white hover:bg-white/10 focus-visible:outline-white"
      >
        {!signingOut && <LogOutIcon aria-hidden />}
        {t("signOut")}
      </Button>
    </div>
  );
}
