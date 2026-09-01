import { AdminTableSkeleton } from "@/components/ui/skeletons/AdminTableSkeleton";

export default function AdminOrdersLoading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-24 animate-pulse rounded bg-neutral-border/60" />
      <AdminTableSkeleton />
    </div>
  );
}
