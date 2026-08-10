"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  getCategories,
  getProducts,
  type ProductSort,
} from "@/lib/api/products";
import type { Category, Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGridSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export function ProductListing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<ProductSort>("name-asc");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    void getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProducts({
      search: debounced,
      sort,
      categoryId: categoryId || undefined,
      page: 1,
      pageSize: 100,
    })
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load products");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, sort, categoryId]);

  const content = useMemo(() => {
    if (loading) return <ProductGridSkeleton />;
    if (error) {
      return <EmptyState title="Something went wrong" description={error} />;
    }
    if (!products.length) {
      return (
        <EmptyState
          title="No products match your search"
          description="Try a different keyword or clear filters."
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    );
  }, [loading, error, products]);

  return (
    <section className="bg-white">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[22px] font-semibold leading-none text-brand-500">
          Our Products
        </h1>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex h-10 w-full overflow-hidden rounded-lg border border-[#d0d5dd] bg-white sm:w-[320px]">
            <input
              value={search}
              onChange={(e) => startTransition(() => setSearch(e.target.value))}
              placeholder="Search products..."
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] text-neutral-text placeholder:text-[#8E94A9] focus-visible:outline-none"
            />
            <button
              type="button"
              className="flex h-full w-10 shrink-0 items-center justify-center border-l border-[#d0d5dd] bg-[#F3F4F6] text-[#333333]"
              aria-label="Search"
              tabIndex={-1}
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <label className="relative inline-flex h-10 w-full shrink-0 sm:w-[160px]">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Filter by category"
              className="h-full w-full cursor-pointer appearance-none rounded-lg border border-[#d0d5dd] bg-white py-2 pl-3 pr-8 text-[13px] text-neutral-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
              aria-hidden
            />
          </label>

          <label className="relative inline-flex h-10 w-full shrink-0 sm:w-[148px]">
            <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-[13px] text-[#8E94A9]">
              Sort by:
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ProductSort)}
              aria-label="Sort by"
              className="h-full w-full cursor-pointer appearance-none rounded-lg border border-[#d0d5dd] bg-white py-2 pl-3 pr-8 text-[13px] text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&>option]:text-neutral-text"
            >
              <option value="name-asc">Name</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
              aria-hidden
            />
          </label>
        </div>
      </div>

      {content}
    </section>
  );
}
