import { TableCell, TableRow } from "@/components/ui/Table";

export function AdminTableBodySkeleton({
  rows = 6,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j} className={j === columns - 1 ? "pr-0" : undefined}>
              <div
                className={`h-4 animate-pulse rounded bg-neutral-border/40 ${j === 0 ? "w-[85%]" : "w-[60%]"}`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
