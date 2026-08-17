"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import {
  getCategories,
  getProducts,
  type ProductSort,
} from "@/lib/api/products";
import type { Category, Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGridSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";

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

  // Reset loading/error during render when the query changes
  // (https://react.dev/learn/you-might-not-need-an-effect)
  const queryKey = `${debounced}|${sort}|${categoryId}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
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
          <div className="flex h-10 w-full overflow-hidden rounded-lg border border-neutral-border bg-white sm:w-80">
            <input
              value={search}
              onChange={(e) => startTransition(() => setSearch(e.target.value))}
              placeholder="Search products..."
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] text-neutral-text placeholder:text-[#8E94A9] focus-visible:outline-none"
            />
            <button
              type="button"
              className="flex h-full w-10 shrink-0 items-center justify-center border-l border-neutral-border bg-[#F3F4F6] text-neutral-text"
              aria-label="Search"
              tabIndex={-1}
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="w-full shrink-0 sm:w-40">
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: "", label: "All categories" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              ariaLabel="Filter by category"
              className="rounded-lg"
            />
          </div>

          <div className="w-full shrink-0 sm:w-52.5">
            <Select
              value={sort}
              onChange={(v) => setSort(v as ProductSort)}
              options={[
                { value: "name-asc", label: "Name" },
                { value: "price-asc", label: "Price: Low to High" },
                { value: "price-desc", label: "Price: High to Low" },
              ]}
              prefix="Sort by:"
              ariaLabel="Sort by"
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      {content}
    </section>
  );
}
