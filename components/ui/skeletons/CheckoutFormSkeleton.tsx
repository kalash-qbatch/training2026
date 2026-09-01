export function CheckoutFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-36 rounded bg-neutral-border/60" />
      <div className="h-10 rounded bg-neutral-border/40" />
      <div className="h-24 rounded bg-neutral-border/40" />
      <div className="flex gap-3 pt-2">
        <div className="h-10 flex-1 rounded bg-neutral-border/50" />
        <div className="h-10 w-24 rounded bg-neutral-border/40" />
      </div>
    </div>
  );
}
