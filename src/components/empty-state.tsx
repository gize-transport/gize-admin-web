import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** The next step, e.g. a "New route" or "Clear filters" button. */
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-ice text-navy [&_svg]:size-6">
          {icon}
        </div>
      )}
      <div className="grid max-w-md gap-1">
        <p className="text-section font-semibold text-navy">{title}</p>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
