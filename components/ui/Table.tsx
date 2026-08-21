import * as React from "react";

import { cn } from "@/lib/utils";

export type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  wrapperClassName?: string;
};

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn("overflow-x-auto", wrapperClassName)}>
      <table
        ref={ref}
        className={cn("min-w-full border-collapse text-left text-[13px]", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }
>(({ className, sticky = true, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("border-b border-[#e5e7eb]", sticky && "sticky top-0 z-10 bg-white", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={cn(className)} {...props} />);
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-[#f3f4f6] transition-colors last:border-0 hover:bg-neutral-50/50",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "pb-3 pr-4 font-medium text-[12px] text-neutral-muted whitespace-nowrap",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("py-3.5 pr-4 text-neutral-text align-middle", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export const TableEmpty = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { colSpan: number }
>(({ className, children = "No data found", colSpan, ...props }, ref) => (
  <tr>
    <td
      ref={ref}
      colSpan={colSpan}
      className={cn("py-12 text-center text-sm text-neutral-muted", className)}
      {...props}
    >
      {children}
    </td>
  </tr>
));
TableEmpty.displayName = "TableEmpty";
