"use client";

import { useTranslations } from "next-intl";

/**
 * A forming route's launch progress (design-system.md, "LaunchProgress"): "9 of 12 needed" as
 * text and a meter. The numbers come from the API (`reserved`, `launch_minimum`). A native
 * <meter> (role meter, no inline style for the strict CSP).
 */
export function LaunchProgress({
  reserved,
  minimum,
}: {
  reserved: number;
  minimum: number;
}) {
  const t = useTranslations("LaunchProgress");
  const text = t("needed", { reserved, minimum });
  return (
    <div className="grid max-w-56 gap-1">
      <span className="text-table text-ink" aria-hidden>
        {text}
      </span>
      <meter
        value={Math.min(reserved, minimum)}
        min={0}
        max={minimum}
        aria-label={text}
        className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-neutral-soft [&::-moz-meter-bar]:bg-sun [&::-webkit-meter-bar]:rounded-full [&::-webkit-meter-bar]:border-0 [&::-webkit-meter-bar]:bg-neutral-soft [&::-webkit-meter-even-less-good-value]:bg-sun [&::-webkit-meter-even-less-good-value]:bg-none [&::-webkit-meter-optimum-value]:bg-sun [&::-webkit-meter-optimum-value]:bg-none [&::-webkit-meter-suboptimum-value]:bg-sun [&::-webkit-meter-suboptimum-value]:bg-none"
      />
    </div>
  );
}
