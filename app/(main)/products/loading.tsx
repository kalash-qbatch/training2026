import { ProductGridSkeleton } from "@/components/features/products/ProductGridSkeleton";

export default function ProductsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-neutral-border/60" />
        <div className="flex gap-2">
          <div className="h-10 w-36 animate-pulse rounded bg-neutral-border/40" />
          <div className="h-10 w-36 animate-pulse rounded bg-neutral-border/40" />
        </div>
      </div>
      <ProductGridSkeleton />
    </div>
  );
}
