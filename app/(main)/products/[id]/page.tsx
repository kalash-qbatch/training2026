import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDetailClient } from "@/components/features/products/ProductDetailClient";
import { findProductById } from "@/lib/services/products";

type Props = {
  params: Promise<{ id: string }>;
};

const BASE_URL = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://bhaikastore.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await findProductById(id);

  if (!product) {
    return {
      title: "Product Not Found",
      robots: { index: false },
    };
  }

  const title = `${product.name} | Bhai ka Store`;
  const description = `Shop ${product.name} at Bhai ka Store. In stock and ready to ship.`;
  const canonicalUrl = `${BASE_URL}/products/${product.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await findProductById(id);

  if (!product) {
    notFound();
  }

  const inStock = (product.stock ?? 0) > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.name,
    image: product.imageUrl,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${BASE_URL}/products/${product.id}`,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-muted"
      >
        <Link href="/" className="transition-colors hover:text-neutral-900">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <Link href="/products" className="transition-colors hover:text-neutral-900">
          Products
        </Link>
        {product.category && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <Link
              href={`/products?category=${product.category.slug}`}
              className="transition-colors hover:text-neutral-900"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[14rem] truncate font-medium text-neutral-900 sm:max-w-xs">
          {product.name}
        </span>
      </nav>

      <div className="mb-8">
        <Link
          href="/products"
          className="inline-flex items-center text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to all products
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-border/70 bg-white p-5 shadow-[0_8px_30px_rgba(16,24,40,0.04)] sm:p-8">
        <ProductDetailClient product={product} />
      </div>
    </div>
  );
}
