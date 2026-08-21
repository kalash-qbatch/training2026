export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-sm border border-neutral-border bg-white">
          <div className="aspect-5/4 animate-pulse bg-[#e5e7eb]" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-[90%] animate-pulse rounded bg-[#e5e7eb]" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-[#e5e7eb]" />
            <div className="h-8.5 animate-pulse rounded bg-[#e5e7eb]" />
          </div>
        </div>
      ))}
    </div>
  );
}
