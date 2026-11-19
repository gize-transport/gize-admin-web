import * as React from "react";
import { cn } from "@/lib/utils";

// Plain table parts with brand styles. Scrolling and sticky behaviour live in DataTable.

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn(
        "w-full border-separate border-spacing-0 text-table tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={className} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      // The card's border (or the pagination bar) closes the table, so the last row needs none.
      className={cn("[&>tr:last-child>td]:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "bg-surface transition-colors duration-150 data-[state=selected]:bg-ice",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // Uppercase by CSS only, so the text stays in its usual case for screen readers.
        "h-10 border-b border-line bg-canvas px-4 text-left align-middle text-meta font-semibold tracking-wider whitespace-nowrap text-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-line/70 bg-inherit px-4 py-3.5 align-middle whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={className} {...props} />;
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
};
