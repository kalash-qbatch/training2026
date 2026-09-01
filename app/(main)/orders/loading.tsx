import { OrdersTableSkeleton } from "@/components/ui/skeletons/OrdersTableSkeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-neutral-border/60" />
      <OrdersTableSkeleton />
    </div>
  );
}
