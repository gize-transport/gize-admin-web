"use client";

import type { ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";

/**
 * A labelled field with an optional hint and its error, both linked by aria-describedby. A
 * hidden hint (the times share one) is still read with the field.
 */
export function FormField({
  id,
  label,
  hint,
  hintHidden,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  hintHidden?: boolean;
  error?: FieldError;
  children: (aria: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
}) {
  const described = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": described || undefined,
      })}
      {hint && (
        <p
          id={`${id}-hint`}
          className={hintHidden ? "sr-only" : "text-meta text-muted"}
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-table text-danger">
          {error.message}
        </p>
      )}
    </div>
  );
}
