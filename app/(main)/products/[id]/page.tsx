import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { findProductById } from "@/lib/services/products";
import { formatCurrency } from "@/lib/utils";
import { ProductCard } from "@/components/features/products/ProductCard";

type Props = {
  params: Promise<{ id: string }>;
};

const BASE_URL =
  process.env.NEXTAUTH_URL ||
  process.env.AUTH_URL ||
  "https://bhaikastore.com";

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
  const description =
    product.description ||
    `Shop ${product.name} at Bhai ka Store. In stock and ready to ship.`;
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
    description: product.description || product.name,
    image: product.imageUrl,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${BASE_URL}/products/${product.id}`,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900 transition-colors">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/products" className="hover:text-gray-900 transition-colors">
          Products
        </Link>
        {product.category && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-gray-900 transition-colors"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-gray-900 truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Back button */}
      <div className="mb-8">
        <Link
          href="/products"
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to all products
        </Link>
      </div>

      {/* Product Detail Card Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
        {/* Gallery / Image View */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
          <Image
            src={product.imageUrl || "/products/tee.jpg"}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            className="object-contain p-4"
          />
        </div>

        {/* Product Meta & Interactive Card */}
        <div className="flex flex-col justify-between">
          <div>
            {product.category && (
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">
                {product.category.name}
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              {product.name}
            </h1>
            <p className="mt-4 text-2xl font-bold text-gray-900">
              {formatCurrency(product.price)}
            </p>

            <div className="mt-4 prose prose-sm text-gray-600">
              <p>{product.description || "No description provided for this product."}</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <ProductCard product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
