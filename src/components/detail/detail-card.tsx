import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DetailVariant } from "./detail-frame";

/**
 * A card's surface: white with a shadow on a page (its background is the grey canvas, like the
 * list's table card); the canvas grey inside the white side panel.
 */
export function detailSurface(variant: DetailVariant) {
  return variant === "page"
    ? "border border-line bg-surface shadow-sm"
    : "border border-line/70 bg-canvas";
}

/**
 * One part of a record in a bordered card (GZW-078): its heading, with the button that edits it
 * on the right, then its content.
 */
export function DetailCard({
  title,
  SectionHeading,
  variant,
  action,
  children,
}: {
  title: ReactNode;
  /** Where it sits (DetailLayout.variant): sets its surface. */
  variant: DetailVariant;
  /** The detail's section heading level (DetailLayout.SectionHeading). */
  SectionHeading: ElementType;
  /** Edits this part, e.g. "Edit areas served". */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid content-start gap-3 rounded-xl p-4",
        detailSurface(variant),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading className="font-display text-body font-semibold text-navy">
          {title}
        </SectionHeading>
        {action}
      </div>
      {children}
    </section>
  );
}
