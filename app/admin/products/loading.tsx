import { AdminTableSkeleton } from "@/components/ui/skeletons/AdminTableSkeleton";

export default function AdminProductsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-7 w-28 animate-pulse rounded bg-neutral-border/60" />
        <div className="flex gap-2">
          <div className="h-9 w-40 animate-pulse rounded bg-neutral-border/40" />
          <div className="h-9 w-44 animate-pulse rounded bg-neutral-border/40" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-neutral-border/40" />
        ))}
      </div>
      <AdminTableSkeleton />
    </div>
  );
}
