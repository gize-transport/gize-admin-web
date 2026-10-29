"use client";

import { CircleCheckIcon } from "lucide-react";
import { Toaster as Sonner } from "sonner";

/** Toast container (root layout). Toasts are only for success confirmations; errors stay inline. */
function Toaster({ label }: { label: string }) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      containerAriaLabel={label}
      icons={{ success: <CircleCheckIcon className="size-4 text-success" /> }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg! border-line! bg-surface! font-sans! text-body! text-ink! shadow-lg!",
        },
      }}
    />
  );
}

export { Toaster };
