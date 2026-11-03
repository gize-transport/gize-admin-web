"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";
import { NoPermission } from "@/components/no-permission";
import { ProblemAlert } from "@/components/problem-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiErrorMessages } from "@/lib/api/errors";
import { ApiError, isForbidden } from "@/lib/api/problem";
import { cn } from "@/lib/utils";

export type DetailVariant = "page" | "panel";

/** Deleted meanwhile (404), or an id the API can't read (422 on the path). */
export function isNotFound(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 404 ||
      (error.status === 422 &&
        error.fieldErrors.some((fieldError) => fieldError.location === "path")))
  );
}

/** What the loaded detail is given to lay itself out as a page or a panel. */
export type DetailLayout = {
  variant: DetailVariant;
  /** Put on the record's heading (`<DetailHeading id={headingId}>`): it names the page or panel. */
  headingId: string;
  /** Sections sit one level below the record's name: h2 on a page, h3 in a panel. */
  SectionHeading: ElementType;
  /** "← All …" on a page (put it just above the name); null in a panel. */
  backLink: ReactNode;
};

type DetailFrameProps<TData> = {
  query: UseQueryResult<TData>;
  variant: DetailVariant;
  /** The list, for the page's "← All …" link. */
  listHref: string;
  labels: {
    backToList: string;
    close: string;
    notFoundTitle: string;
    notFoundDescription: string;
  };
  /** Closes the side panel. */
  onClose?: () => void;
  children: (data: TData, layout: DetailLayout) => ReactNode;
};

/**
 * A record's details as its own page or as the list's side panel (design-system.md, "Detail
 * panel / page"): loading, no permission, not found and errors handled the same way for every
 * record; the panel takes focus when it opens.
 */
export function DetailFrame<TData>({
  query,
  variant,
  listHref,
  labels,
  onClose,
  children,
}: DetailFrameProps<TData>) {
  const { message } = useApiErrorMessages();
  const headingId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const notFound = isNotFound(query.error);

  // A panel opens from a row: move focus into it, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (variant === "panel") panelRef.current?.focus({ preventScroll: true });
  }, [variant]);

  // Found gone while working on it (its controls vanish): focus the explanation, not <body>.
  const notFoundRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (notFound && document.activeElement === document.body) {
      notFoundRef.current?.focus();
    }
  }, [notFound]);

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  } else if (isForbidden(query.error)) {
    content = <NoPermission />;
  } else if (notFound) {
    content = (
      <div className="grid gap-2">
        <DetailHeading id={headingId} variant={variant} ref={notFoundRef}>
          {labels.notFoundTitle}
        </DetailHeading>
        <p className="text-body text-muted">{labels.notFoundDescription}</p>
        {variant === "page" ? (
          <BackLink href={listHref}>{labels.backToList}</BackLink>
        ) : (
          <Button variant="secondary" className="w-fit" onClick={onClose}>
            {labels.close}
          </Button>
        )}
      </div>
    );
  } else if (query.isError) {
    content = (
      <ProblemAlert
        message={message(query.error)}
        requestId={
          query.error instanceof ApiError ? query.error.requestId : null
        }
        retryAfterSeconds={
          query.error instanceof ApiError ? query.error.retryAfterSeconds : null
        }
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    content = children(query.data, {
      variant,
      headingId,
      SectionHeading: variant === "page" ? "h2" : "h3",
      backLink:
        variant === "page" ? (
          <BackLink href={listHref}>{labels.backToList}</BackLink>
        ) : null,
    });
  }

  if (variant === "page") {
    return (
      <article aria-labelledby={headingId} className="grid content-start gap-6">
        {content}
      </article>
    );
  }
  return (
    // A named region beside the list (an <aside> inside <main> isn't a top-level landmark).
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="relative grid content-start gap-6 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-line outline-none"
    >
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 size-9 px-0"
        onClick={onClose}
      >
        <XIcon aria-hidden />
        <span className="sr-only">{labels.close}</span>
      </Button>
      {content}
    </section>
  );
}

/** The record's name: h1 on its page, h2 in the panel. Focusable for focus management. */
export function DetailHeading({
  id,
  variant,
  ref,
  children,
}: {
  id: string;
  variant: DetailVariant;
  ref?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const className = "font-display font-semibold text-navy outline-none";
  return variant === "page" ? (
    <h1 id={id} ref={ref} tabIndex={-1} className={cn(className, "text-title")}>
      {children}
    </h1>
  ) : (
    <h2
      id={id}
      ref={ref}
      tabIndex={-1}
      className={cn(className, "pr-10 text-section")}
    >
      {children}
    </h2>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-table font-semibold text-royal underline-offset-4 hover:underline"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {children}
    </Link>
  );
}

/** Key facts: a `<dl>` in a labelled group (the group carries the name, not the list). */
export function Facts({
  label,
  variant,
  children,
}: {
  label: string;
  variant: DetailVariant;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      <dl
        className={cn(
          "grid gap-x-6 gap-y-4",
          variant === "page" && "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {children}
      </dl>
    </div>
  );
}

export function Fact({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1", wide && "sm:col-span-full")}>
      <dt className="text-meta font-semibold text-muted">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}
