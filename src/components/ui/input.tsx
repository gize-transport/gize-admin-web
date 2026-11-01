import * as React from "react";
import { cn } from "@/lib/utils";

/** Text input (shadcn/ui, brand tokens). Set `aria-invalid` to show the error state. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-body text-ink transition-colors duration-150 placeholder:text-muted hover:border-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
