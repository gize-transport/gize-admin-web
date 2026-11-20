import type { ElementType, ReactNode } from "react";

/**
 * One part of a record in a bordered card (GZW-078): its heading, with the button that edits it
 * on the right, then its content.
 */
export function DetailCard({
  title,
  SectionHeading,
  action,
  children,
}: {
  title: ReactNode;
  /** The detail's section heading level (DetailLayout.SectionHeading). */
  SectionHeading: ElementType;
  /** Edits this part, e.g. "Edit areas served". */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid content-start gap-3 rounded-xl border border-line p-4">
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
