"use client";

import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The consequence in plain words. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  /** The action is running: the dialog can't be closed and both buttons are disabled. */
  pending?: boolean;
  /** Start the action. The caller closes the dialog when it succeeds, so a failure can show inside it. */
  onConfirm: () => void;
  /** Extra content above the buttons, e.g. a ProblemAlert after a failed attempt. */
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  pending = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations("Common");
  // Radix only returns focus to its own Trigger; this dialog is opened from app state, so remember
  // the element that had focus and return to it on close (WCAG 2.4.3).
  const returnFocusTo = useRef<HTMLElement | null>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
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
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          {/* Radix focuses Cancel when the dialog opens – the safe default. */}
          <AlertDialogCancel asChild>
            <Button variant="secondary" aria-disabled={pending || undefined}>
              {cancelLabel ?? t("cancel")}
            </Button>
          </AlertDialogCancel>
          <Button
            variant={tone === "destructive" ? "destructive" : "primary"}
            pending={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
