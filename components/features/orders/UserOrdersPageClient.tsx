"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { getOrders } from "@/lib/api/orders";
import { TABLE_INITIAL_PAGE, TABLE_PAGE_SIZE } from "@/lib/constants";
import type { Order } from "@/types";

import { OrdersTable } from "./OrdersTable";

export function UserOrdersPageClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(TABLE_INITIAL_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState(page);

  if (page !== prevPage) {
    setPrevPage(page);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getOrders(page, TABLE_PAGE_SIZE)
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
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / TABLE_PAGE_SIZE));

  return (
    <div className="mx-auto w-full">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold text-brand-600">My Orders</h1>
        <p className="text-sm text-neutral-muted">
          View and track the status of all your recent purchases.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-border/40" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Could not load orders" description={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="You haven't placed any orders yet"
          description="When you place an order, it will show up here."
          ctaHref="/products"
          ctaLabel="Browse products"
        />
      ) : (
        <div className="space-y-6">
          <OrdersTable orders={orders} />
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-muted">{totalCount} Total Orders</p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
