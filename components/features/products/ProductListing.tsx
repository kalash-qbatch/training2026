"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Loader2, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { getCategories, getProducts, type ProductSort } from "@/lib/api/products";
import { CARD_INITIAL_PAGE, CARD_PAGE_SIZE } from "@/lib/constants/order";
import type { Category, Product } from "@/types";

import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGridSkeleton";

export function ProductListing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<ProductSort>("name-asc");
  const [categoryId, setCategoryId] = useState("");

  // Page range tracking for sliding window
  const [startPage, setStartPage] = useState(CARD_INITIAL_PAGE);
  const [endPage, setEndPage] = useState(CARD_INITIAL_PAGE);
  const [totalPages, setTotalPages] = useState(1);

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMoreDown, setLoadingMoreDown] = useState(false);
  const [loadingMoreUp, setLoadingMoreUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, startTransition] = useTransition();
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Synchronous refs to prevent duplicate trigger conditions
  const isFetchingRef = useRef(false);
  const startPageRef = useRef(CARD_INITIAL_PAGE);
  const endPageRef = useRef(CARD_INITIAL_PAGE);
  const totalPagesRef = useRef(1);

  // Keep refs in sync using useEffect to avoid ref access during render
  useEffect(() => {
    startPageRef.current = startPage;
  }, [startPage]);

  useEffect(() => {
    endPageRef.current = endPage;
  }, [endPage]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

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

  // Initial fetch / reset on filter change or mount
  const fetchInitial = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    isFetchingRef.current = true;
    setProducts([]);
    setStartPage(CARD_INITIAL_PAGE);
    setEndPage(CARD_INITIAL_PAGE);
    startPageRef.current = CARD_INITIAL_PAGE;
    endPageRef.current = CARD_INITIAL_PAGE;
    setTotalPages(1);
    totalPagesRef.current = 1;
    setError(null);
    setInitialLoading(true);

    try {
      const data = await getProducts({
        search: debounced,
        sort,
        categoryId: categoryId || undefined,
        page: CARD_INITIAL_PAGE,
        pageSize: CARD_PAGE_SIZE,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setProducts(data.products);
      setStartPage(CARD_INITIAL_PAGE);
      setEndPage(CARD_INITIAL_PAGE);
      startPageRef.current = CARD_INITIAL_PAGE;
      endPageRef.current = CARD_INITIAL_PAGE;
      setTotalPages(data.totalPages);
      totalPagesRef.current = data.totalPages;
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
    } finally {
      if (!controller.signal.aborted) {
        setInitialLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [debounced, sort, categoryId]);

  // When filters change: trigger initial fetch
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchInitial();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchInitial]);

  // Fetch Next Page (Scroll Down)
  const fetchNextPage = useCallback(async () => {
    if (isFetchingRef.current || endPageRef.current >= totalPagesRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoadingMoreDown(true);
    const nextEndPage = endPageRef.current + 1;

    try {
      const data = await getProducts({
        search: debounced,
        sort,
        categoryId: categoryId || undefined,
        page: nextEndPage,
        pageSize: CARD_PAGE_SIZE,
      });

      if (data.products.length > 0) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newUniqueProducts = data.products.filter((p) => !existingIds.has(p.id));
          if (newUniqueProducts.length === 0) return prev;

          const combined = [...prev, ...newUniqueProducts];
          if (combined.length > 16) {
            setStartPage((s) => s + 1);
            startPageRef.current += 1;
            return combined.slice(combined.length - 16);
          }
          return combined;
        });

        setEndPage(nextEndPage);
        endPageRef.current = nextEndPage;
        setTotalPages(data.totalPages);
        totalPagesRef.current = data.totalPages;
      }
    } catch {
      // silently handle errors
    } finally {
      setLoadingMoreDown(false);
      isFetchingRef.current = false;
    }
  }, [debounced, sort, categoryId]);

  // Fetch Previous Page (Scroll Up)
  const fetchPrevPage = useCallback(async () => {
    if (isFetchingRef.current || startPageRef.current <= CARD_INITIAL_PAGE) {
      return;
    }

    isFetchingRef.current = true;
    setLoadingMoreUp(true);
    const prevStartPage = startPageRef.current - 1;

    // Preserve scroll position relative to document when prepending
    const prevScrollHeight = document.documentElement.scrollHeight;
    const prevScrollTop = window.scrollY || document.documentElement.scrollTop;

    try {
      const data = await getProducts({
        search: debounced,
        sort,
        categoryId: categoryId || undefined,
        page: prevStartPage,
        pageSize: CARD_PAGE_SIZE,
      });

      if (data.products.length > 0) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newUniqueProducts = data.products.filter((p) => !existingIds.has(p.id));
          if (newUniqueProducts.length === 0) return prev;

          const combined = [...newUniqueProducts, ...prev];
          if (combined.length > 16) {
            setEndPage((e) => e - 1);
            endPageRef.current -= 1;
            return combined.slice(0, 16);
          }
          return combined;
        });

        setStartPage(prevStartPage);
        startPageRef.current = prevStartPage;
        setTotalPages(data.totalPages);
        totalPagesRef.current = data.totalPages;

        // Restore scroll position so user doesn't bounce violently
        requestAnimationFrame(() => {
          const newScrollHeight = document.documentElement.scrollHeight;
          const heightDiff = newScrollHeight - prevScrollHeight;
          if (heightDiff > 0) {
            window.scrollTo({
              top: prevScrollTop + heightDiff,
              behavior: "instant" as ScrollBehavior,
            });
          }
        });
      }
    } catch {
      // silently handle errors
    } finally {
      setLoadingMoreUp(false);
      isFetchingRef.current = false;
    }
  }, [debounced, sort, categoryId]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Bottom IntersectionObserver (Scroll Down)
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !isFetchingRef.current &&
          !initialLoading &&
          endPage < totalPages
        ) {
          startTransition(() => {
            void fetchNextPage();
          });
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [initialLoading, endPage, totalPages, fetchNextPage]);

  // Top IntersectionObserver (Scroll Up)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !isFetchingRef.current &&
          !initialLoading &&
          startPage > CARD_INITIAL_PAGE
        ) {
          startTransition(() => {
            void fetchPrevPage();
          });
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [initialLoading, startPage, fetchPrevPage]);

  return (
    <section className="bg-white">
      {/* Header + Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-[22px] font-semibold leading-none text-brand-500">Our Products</h1>

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

      {/* Top Sentinel for Reverse Lazy Loading */}
      {products.length > 0 && startPage > CARD_INITIAL_PAGE && (
        <div ref={topSentinelRef} className="mb-4 flex justify-center py-2">
          {loadingMoreUp && (
            <Loader2
              className="h-6 w-6 animate-spin text-brand-500"
              aria-label="Loading previous products"
            />
          )}
        </div>
      )}

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

          {/* Bottom Infinite scroll sentinel */}
          <div ref={bottomSentinelRef} className="mt-8 flex justify-center">
            {loadingMoreDown && (
              <Loader2
                className="h-6 w-6 animate-spin text-brand-500"
                aria-label="Loading more products"
              />
            )}
            {!loadingMoreDown && endPage >= totalPages && products.length > 0 && (
              <p className="text-sm text-neutral-muted">All products loaded</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
