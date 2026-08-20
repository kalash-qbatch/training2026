"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
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
import { CARD_PAGE_SIZE, CARD_INITIAL_PAGE } from "@/lib/constants";

export function ProductListing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<ProductSort>("name-asc");
  const [categoryId, setCategoryId] = useState("");

  // Pagination state
  const [page, setPage] = useState(CARD_INITIAL_PAGE);
  const [totalPages, setTotalPages] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Tracks the in-flight request so stale responses can be aborted/ignored.
  // Fixes a race condition where a slow earlier request (e.g. from fast
  // typing or rapid filter changes) could resolve after a newer one and
  // overwrite fresh data with stale data.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Load categories once
  useEffect(() => {
    void getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Fetch a page of products and append/replace
  const fetchPage = useCallback(
    async (pageNum: number, isFirstPage: boolean) => {
      // Cancel any in-flight request before starting a new one so its
      // response can never land after (and overwrite) this one's.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Reset list state atomically when starting a fresh filter/search
      if (isFirstPage) {
        setProducts([]);
        setTotalPages(1);
        setError(null);
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await getProducts({
          search: debounced,
          sort,
          categoryId: categoryId || undefined,
          page: pageNum,
          pageSize: CARD_PAGE_SIZE,
          signal: controller.signal,
        });

        // If this request was superseded/aborted while in flight, ignore
        // its result entirely.
        if (controller.signal.aborted) return;

        setProducts((prev) =>
          isFirstPage ? data.products : [...prev, ...data.products]
        );
        setTotalPages(data.totalPages);
        setPage(pageNum);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (isFirstPage) {
          setError(
            err instanceof Error ? err.message : "Failed to load products"
          );
          setProducts([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debounced, sort, categoryId]
  );

  // When filters change: trigger fetch for first page and reset page state
  useEffect(() => {
    setPage(CARD_INITIAL_PAGE);
    void fetchPage(CARD_INITIAL_PAGE, true);
  }, [debounced, sort, categoryId, fetchPage]);

  // When user clicks pagination or scrolls (page state increases)
  // When page increments (infinite scroll), fetch next page after a short
  // delay (gives the "loading more" spinner a moment to be visible and
  // avoids hammering the API if the user scrolls quickly).
  useEffect(() => {
    if (page === CARD_INITIAL_PAGE) return;

    // Deferred (rather than called directly in the effect body) to avoid
    // the "setState synchronously within an effect" cascading-render
    // warning — this still shows on the very next tick, imperceptibly.
    const showTimer = window.setTimeout(() => setLoadingMore(true), 0);

    const fetchTimer = window.setTimeout(() => {
      startTransition(() => void fetchPage(page, false));
    }, 1000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(fetchTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // IntersectionObserver — fires when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        startTransition(() => {
          if (
            entries[0]?.isIntersecting &&
            !loadingMore &&
            !initialLoading &&
            page < totalPages
          ) {
            setPage((prev) => prev + 1);
          }
        });
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadingMore, initialLoading, page, totalPages]);

  return (
    <section className="bg-white">
      {/* Header + Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[22px] font-semibold leading-none text-brand-500">
          Our Products
        </h1>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          {/* Search */}
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

          {/* Category filter */}
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

          {/* Sort */}
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

      {/* Product grid */}
      {initialLoading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <EmptyState title="Something went wrong" description={error} />
      ) : !products.length ? (
        <EmptyState
          title="No products match your search"
          description="Try a different keyword or clear filters."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="mt-8 flex justify-center">
            {loadingMore && (
              <Loader2
                className="h-6 w-6 animate-spin text-brand-500"
                aria-label="Loading more products"
              />
            )}
            {!loadingMore && page >= totalPages && products.length > 0 && (
              <p className="text-sm text-neutral-muted">
                All products loaded
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}