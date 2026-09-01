export function AdminOrderDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-7 w-40 rounded bg-neutral-border/60" />
      <div className="mb-6 flex flex-wrap gap-4 border-b border-[#e5e7eb] pb-5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="min-w-24">
            <div className="h-3 w-16 rounded bg-neutral-border/40" />
            <div className="mt-2 h-4 w-20 rounded bg-neutral-border/50" />
          </div>
        ))}
      </div>
      <div className="mb-4 h-5 w-44 rounded bg-neutral-border/60" />
      <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
        <div className="border-b border-[#e5e7eb] px-4 py-3">
          <div className="flex gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-14 rounded bg-neutral-border/40" />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[#e5e7eb] px-4 py-3 last:border-0"
          >
            <div className="h-10 w-10 rounded bg-neutral-border/50" />
            <div className="h-4 flex-1 rounded bg-neutral-border/40" />
            <div className="h-4 w-12 rounded bg-neutral-border/40" />
            <div className="h-4 w-12 rounded bg-neutral-border/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
