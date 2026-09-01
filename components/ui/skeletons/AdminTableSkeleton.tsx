export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
      <div className="border-b border-[#e5e7eb] bg-neutral-bg/50 px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-neutral-border/60" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#e5e7eb]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-neutral-border/50" />
            <div className="h-4 flex-1 animate-pulse rounded bg-neutral-border/40" />
            <div className="h-4 w-20 animate-pulse rounded bg-neutral-border/40" />
            <div className="h-4 w-16 animate-pulse rounded bg-neutral-border/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
