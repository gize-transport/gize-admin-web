import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** One-line summary under the title, e.g. "14 active · 2 waiting to open". */
  description?: ReactNode;
  /** Filters and the primary action, shown on the right (below the title on narrow screens). */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="grid min-w-0 gap-1">
        <h1 className="font-display text-title font-semibold text-navy">
          {title}
        </h1>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
