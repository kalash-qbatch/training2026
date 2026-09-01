export function CartSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="mb-6 h-7 w-48 rounded bg-neutral-border/60" />
      <div className="hidden space-y-0 md:block">
        <div className="mb-3 flex gap-8 border-b border-neutral-border pb-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-16 rounded bg-neutral-border/40" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-border py-4">
            <div className="h-4 w-4 rounded bg-neutral-border/40" />
            <div className="h-14 w-14 rounded-md bg-neutral-border/50" />
            <div className="h-4 flex-1 rounded bg-neutral-border/40" />
            <div className="h-8 w-24 rounded bg-neutral-border/40" />
          </div>
        ))}
      </div>
      <ul className="space-y-3 md:hidden">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg border border-neutral-border bg-neutral-border/30"
          />
        ))}
      </ul>
    </section>
  );
}
