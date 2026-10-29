import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "group grid w-full gap-1 rounded-lg border px-4 py-3 text-left text-body has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-3 *:[svg]:mt-0.5 *:[svg]:size-5",
  {
    variants: {
      variant: {
        default: "border-line bg-surface text-ink",
        destructive:
          "border-danger/30 bg-danger-soft text-ink *:[svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      {...props}
      className={cn(alertVariants({ variant }), className)}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-semibold group-has-[>svg]:col-start-2", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("grid gap-2 group-has-[>svg]:col-start-2", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
