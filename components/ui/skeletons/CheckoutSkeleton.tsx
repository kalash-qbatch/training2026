export function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div>
          <div className="h-8 w-40 rounded bg-neutral-border/60" />
          <div className="mt-2 h-4 w-56 rounded bg-neutral-border/40" />
        </div>
        <div className="hidden h-10 w-48 rounded-full bg-neutral-border/40 lg:ml-auto lg:block" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="rounded-xl border border-neutral-border/80 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-5 w-32 rounded bg-neutral-border/60" />
            <div className="h-10 rounded bg-neutral-border/40" />
            <div className="h-10 rounded bg-neutral-border/40" />
            <div className="h-10 rounded bg-neutral-border/40" />
            <div className="h-24 rounded bg-neutral-border/40" />
          </div>
        </div>
        <aside className="rounded-xl border border-neutral-border/80 bg-white p-5">
          <div className="space-y-3">
            <div className="h-4 w-24 rounded bg-neutral-border/60" />
            <div className="h-16 rounded bg-neutral-border/40" />
            <div className="h-16 rounded bg-neutral-border/40" />
            <div className="mt-4 h-10 rounded bg-neutral-border/60" />
          </div>
        </aside>
      </div>
    </div>
  );
}
