"use client";

import { Label as LabelPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Field label (shadcn/ui on Radix Label): above the field, always visible. */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-table font-semibold text-ink", className)}
      {...props}
    />
  );
}

export { Label };
