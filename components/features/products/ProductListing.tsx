"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import { Loader2, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { getCategories, getProducts, type ProductSort } from "@/lib/api/products";
import { CARD_INITIAL_PAGE, CARD_PAGE_SIZE } from "@/lib/constants";
import type { Category, Product } from "@/types";

import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGridSkeleton";

export function ProductListing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<ProductSort>("name-asc");
  const [categoryId, setCategoryId] = useState("");

  const [totalPages, setTotalPages] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMoreDown, setLoadingMoreDown] = useState(false);
  const [loadingMoreUp, setLoadingMoreUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, startTransition] = useTransition();
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // Tracks the in-flight request so stale responses can be aborted/ignored.
  const abortControllerRef = useRef<AbortController | null>(null);
  // Keep track of the current anchor element ID and its old top position in a ref for scroll anchoring
  const scrollAnchorRef = useRef<{ id: string; oldTop: number } | null>(null);

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

  // Fetch a page of products
  const fetchPage = useCallback(
    async (pageNum: number, isFirstPage: boolean, direction?: "up" | "down") => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isFirstPage) {
        setProducts([]);
        setStartPage(1);
        setEndPage(1);
        setTotalPages(1);
        setInitialLoading(true);
        setError(null);
        scrollAnchorRef.current = null;
      } else {
        if (direction === "up") {
          setLoadingMoreUp(true);
        } else {
          setLoadingMoreDown(true);
        }
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

        if (controller.signal.aborted) return null;

        setTotalPages(data.totalPages);
        if (isFirstPage) {
          setProducts(data.products);
        }
        return data;
      } catch (err: unknown) {
        if (controller.signal.aborted) return null;
        if (isFirstPage) {
          setError(err instanceof Error ? err.message : "Failed to load products");
        }
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
          setLoadingMoreDown(false);
          setLoadingMoreUp(false);
        }
      }
    },
    [debounced, sort, categoryId]
  );

  const handleScrollDown = useCallback(async () => {
    if (loadingMoreDown || loadingMoreUp || initialLoading || endPage >= totalPages) return;

    const nextPage = endPage + 1;
    const data = await fetchPage(nextPage, false, "down");
    if (data) {
      const overlapIndex = products.length === 16 ? 8 : 0;
      const anchorProduct = products[overlapIndex];
      if (anchorProduct) {
        const element = document.getElementById(`product-card-${anchorProduct.id}`);
        if (element) {
          scrollAnchorRef.current = {
            id: `product-card-${anchorProduct.id}`,
            oldTop: element.getBoundingClientRect().top,
          };
        }
      }

      setProducts((prev) => {
        if (prev.length === 8) {
          return [...prev, ...data.products];
        } else {
          return [...prev.slice(8), ...data.products];
        }
      });
      setStartPage((prev) => (products.length === 16 ? prev + 1 : prev));
      setEndPage(nextPage);
    }
  }, [endPage, totalPages, products, loadingMoreDown, loadingMoreUp, initialLoading, fetchPage]);

  const handleScrollUp = useCallback(async () => {
    if (loadingMoreDown || loadingMoreUp || initialLoading) return;

    if (startPage > 1) {
      const prevPage = startPage - 1;
      const data = await fetchPage(prevPage, false, "up");
      if (data) {
        const anchorProduct = products[0];
        if (anchorProduct) {
          const element = document.getElementById(`product-card-${anchorProduct.id}`);
          if (element) {
            scrollAnchorRef.current = {
              id: `product-card-${anchorProduct.id}`,
              oldTop: element.getBoundingClientRect().top,
            };
          }
        }

        setProducts((prev) => {
          return [...data.products, ...prev.slice(0, 8)];
        });
        setStartPage(prevPage);
        setEndPage((prev) => prev - 1);
      }
    } else if (startPage === 1 && endPage === 2) {
      const anchorProduct = products[0];
      if (anchorProduct) {
        const element = document.getElementById(`product-card-${anchorProduct.id}`);
        if (element) {
          scrollAnchorRef.current = {
            id: `product-card-${anchorProduct.id}`,
            oldTop: element.getBoundingClientRect().top,
          };
        }
      }

      setProducts((prev) => prev.slice(0, 8));
      setEndPage(1);
    }
  }, [startPage, endPage, products, loadingMoreDown, loadingMoreUp, initialLoading, fetchPage]);

  const filterKey = `${debounced}|${sort}|${categoryId}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setStartPage(1);
    setEndPage(1);
  }

  // When filters change: trigger fetch for first page and reset page state
  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchPage(CARD_INITIAL_PAGE, true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [debounced, sort, categoryId, fetchPage]);

  // Scroll anchoring adjustment
  useLayoutEffect(() => {
    if (scrollAnchorRef.current) {
      const { id, oldTop } = scrollAnchorRef.current;
      const element = document.getElementById(id);
      if (element) {
        const newTop = element.getBoundingClientRect().top;
        const diff = newTop - oldTop;
        if (Math.abs(diff) > 0.5) {
          window.scrollBy(0, diff);
        }
      }
      scrollAnchorRef.current = null;
    }
  }, [products]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Bottom sentinel observer (scroll down)
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void handleScrollDown();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleScrollDown]);

  // Top sentinel observer (scroll up)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void handleScrollUp();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleScrollUp]);

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
                { value: "", label: "All CATEGORIES" },
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
          {/* Top sentinel for scroll up */}
          <div ref={topSentinelRef} className="h-1 w-full" />
          {loadingMoreUp && (
            <div className="mb-4 flex justify-center">
              <Loader2
                className="h-6 w-6 animate-spin text-brand-500"
                aria-label="Loading previous products"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {products.map((p) => (
              <div key={p.id} id={`product-card-${p.id}`} className="h-full">
                <ProductCard product={p} />
              </div>
            ))}
          </div>

          {/* Bottom sentinel for scroll down */}
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
