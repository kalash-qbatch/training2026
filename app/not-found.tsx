import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold text-neutral-text">Page not found</h1>
      <p className="text-sm text-neutral-muted">The page you requested does not exist.</p>
      <Link
        href="/products"
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        Go to products
      </Link>
    </main>
  );
}
