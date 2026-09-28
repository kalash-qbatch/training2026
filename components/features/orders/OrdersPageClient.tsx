"use client";

import { useCallback, useEffect, useState } from "react";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { OrdersTableSkeleton } from "@/components/ui/skeletons/OrdersTableSkeleton";
import { getOrders } from "@/lib/api/orders";
import { TABLE_INITIAL_PAGE, TABLE_PAGE_SIZE } from "@/lib/constants";
import type { Order, OrderStatus } from "@/types";

import { OrdersTable } from "./OrdersTable";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const VALID_STATUSES = new Set(
  STATUS_FILTER_OPTIONS.map((o) => o.value).filter(Boolean)
) as Set<string>;

function parseStatusParam(raw: string | null): "" | OrderStatus {
  const value = (raw || "").trim().toLowerCase();
  return VALID_STATUSES.has(value) ? (value as OrderStatus) : "";
}

export function OrdersPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFromUrl = parseStatusParam(searchParams.get("status"));

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(TABLE_INITIAL_PAGE);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | OrderStatus>(statusFromUrl);
  const [prevStatusFromUrl, setPrevStatusFromUrl] = useState(statusFromUrl);
  if (statusFromUrl !== prevStatusFromUrl) {
    setPrevStatusFromUrl(statusFromUrl);
    setStatusFilter(statusFromUrl);
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevFilters, setPrevFilters] = useState(`${debounced}|${statusFilter}`);
  const queryKey = `${debounced}|${statusFilter}|${page}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);

  const filterKey = `${debounced}|${statusFilter}`;
  if (filterKey !== prevFilters) {
    setPrevFilters(filterKey);
    if (page !== TABLE_INITIAL_PAGE) setPage(TABLE_INITIAL_PAGE);
  }

  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    getOrders(page, TABLE_PAGE_SIZE, debounced, statusFilter)
      .then((res) => {
        if (!cancelled) {
          setOrders(res.orders);
          setTotalCount(res.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load orders");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debounced, statusFilter]);

  const updateStatusFilter = useCallback(
    (value: string) => {
      const next = parseStatusParam(value);
      setStatusFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("status", next);
      else params.delete("status");
      const qs = params.toString();
      router.replace(qs ? `/orders?${qs}` : "/orders", { scroll: false });
    },
    [router, searchParams]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / TABLE_PAGE_SIZE));
  const handleViewOrder = useCallback((id: string) => router.push(`/orders/${id}`), [router]);
  const hasFilters = Boolean(debounced) || Boolean(statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">My Orders</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onChange={updateStatusFilter}
              options={[...STATUS_FILTER_OPTIONS]}
              ariaLabel="Filter by order status"
            />
          </div>
          <div className="relative w-full sm:w-72">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value.trimStart())}
              onBlur={() => setSearch((value) => value.trim())}
              placeholder="Search by order id"
              className="h-10 w-full rounded-md border border-neutral-border bg-white px-3 pr-10 text-sm text-neutral-text outline-none placeholder:text-neutral-muted focus:border-brand-500"
              aria-label="Search orders by order id"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-muted" />
          </div>
        </div>
      </div>

      {loading ? (
        <OrdersTableSkeleton />
      ) : error ? (
        <EmptyState title="Could not load orders" description={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No orders found" : "You haven't placed any orders yet"}
          description={
            hasFilters
              ? "Try a different status or order id, or clear the filters."
              : "When you place an order, it will show up here."
          }
          ctaHref={hasFilters ? undefined : "/products"}
          ctaLabel={hasFilters ? undefined : "Browse products"}
        />
      ) : (
        <div className="space-y-4">
          <OrdersTable orders={orders} onViewOrder={handleViewOrder} />
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-muted">{totalCount} Total Count</p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
