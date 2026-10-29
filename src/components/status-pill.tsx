import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Status families from docs/design-system.md. Each screen maps its API statuses onto these. */
export type StatusTone = "success" | "waiting" | "neutral" | "danger";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  waiting: "bg-sun text-navy",
  neutral: "bg-neutral-soft text-ink",
  danger: "bg-danger-soft text-danger",
};

type StatusPillProps = {
  tone: StatusTone;
  /** The status in words – the colour only supports it. */
  children: ReactNode;
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-meta font-semibold whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
