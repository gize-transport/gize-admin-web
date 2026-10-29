import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent font-semibold whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-navy text-white hover:bg-royal",
        secondary:
          "border-line bg-surface text-navy hover:border-royal hover:bg-ice",
        ghost: "text-navy hover:bg-ice",
        destructive: "bg-danger text-white hover:bg-danger/90",
        link: "text-royal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-body",
        sm: "h-8 px-3 text-table",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * The action is running: shows a spinner and ignores clicks and form submits. Uses aria-disabled
     * instead of `disabled` so keyboard focus isn't lost while the request runs.
     */
    pending?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  pending = false,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const ariaDisabled = props["aria-disabled"];
  const inactive = pending || ariaDisabled === true || ariaDisabled === "true";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
      aria-disabled={inactive || undefined}
      aria-busy={pending || undefined}
      // A plain button without onClick passes no function props, so it can render in a Server
      // Component. Pending or aria-disabled buttons need this handler: use them in client code.
      onClick={
        inactive
          ? (event: React.MouseEvent<HTMLButtonElement>) =>
              event.preventDefault()
          : onClick
      }
    >
      {asChild ? (
        children
      ) : (
        <>
          {pending && <Loader2Icon aria-hidden className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
