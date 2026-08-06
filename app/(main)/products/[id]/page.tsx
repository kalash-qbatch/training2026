import { notFound } from "next/navigation";
import Link from "next/link";
import { findProductById } from "@/lib/services/products";
import { formatCurrency } from "@/lib/utils";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await findProductById(id);
  if (!product) notFound();

  return (
    <section className="mx-auto max-w-3xl">
      <Link
        href="/products"
        className="text-sm font-medium text-brand-500 hover:text-brand-600"
      >
        ← Back to products
      </Link>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="aspect-square w-full rounded-lg object-cover"
        />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-text">{product.name}</h1>
          <p className="mt-2 text-xl font-semibold text-brand-600">
            {formatCurrency(product.price)}
          </p>
          {product.variants?.length ? (
            <div className="mt-4 space-y-1 text-sm text-neutral-muted">
              <p className="font-medium text-neutral-text">Available options</p>
              {product.variants.map((v) => (
                <p key={`${v.color}-${v.size}`}>
                  {v.color} · {v.size} — {v.qty} in stock
                </p>
              ))}
            </div>
          ) : (
            <>
              {product.color ? (
                <p className="mt-4 text-sm text-neutral-muted">
                  Color: {product.color}
                </p>
              ) : null}
              {product.sizes?.length ? (
                <p className="mt-1 text-sm text-neutral-muted">
                  Sizes: {product.sizes.join(", ")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
