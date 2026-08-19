"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getOrderById, getOrders } from "@/lib/api/orders";
import type { Order } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatLineColor, formatLineSize } from "@/lib/product";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrdersTable } from "./OrdersTable";

export function OrdersDrawer({
  open,
  onClose,
  initialOrderId,
}: {
  open: boolean;
  onClose: () => void;
  initialOrderId?: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Order | null | undefined>(undefined);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialOrderId, setPrevInitialOrderId] = useState(initialOrderId);
  const [prevSelectedOrderId, setPrevSelectedOrderId] = useState(selectedOrderId);

  // Adjust state during render instead of inside effects
  // (https://react.dev/learn/you-might-not-need-an-effect)
  if (open !== prevOpen || initialOrderId !== prevInitialOrderId) {
    setPrevOpen(open);
    setPrevInitialOrderId(initialOrderId);
    if (!open) {
      setSelectedOrderId(null);
      setDetail(undefined);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
      if (initialOrderId) setSelectedOrderId(initialOrderId);
    }
  }
  if (selectedOrderId !== prevSelectedOrderId) {
    setPrevSelectedOrderId(selectedOrderId);
    setDetail(undefined);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getOrders(1, 100)
      .then((res) => {
        if (!cancelled) setOrders(res.orders);
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
  }, [open]);

  useEffect(() => {
    if (!selectedOrderId) return;
    let cancelled = false;
    getOrderById(selectedOrderId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]);

  const showingDetail = Boolean(selectedOrderId);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onBack={showingDetail ? () => setSelectedOrderId(null) : onClose}
      title={showingDetail ? "Order Detail" : "My Orders"}
      widthClassName="max-w-[960px]"
    >
      {showingDetail ? (
        <OrderDetailsContent order={detail} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-md bg-neutral-border/50"
            />
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
        <div className="space-y-4">
          <OrdersTable
            orders={orders}
            onViewOrder={(id) => setSelectedOrderId(id)}
          />
          <p className="text-sm text-neutral-muted">
            {orders.length} Total Count
          </p>
        </div>
      )}
    </Drawer>
  );
}

function OrderDetailsContent({
  order,
}: {
  order: Order | null | undefined;
}) {
  if (order === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-border/50" />
        <div className="h-20 animate-pulse rounded-lg bg-neutral-border/50" />
        <div className="h-40 animate-pulse rounded-lg bg-neutral-border/50" />
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        description="This order id is invalid or no longer available."
      />
    );
  }

  const productCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  const subTotal = order.subTotal ?? order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = order.tax ?? Number((subTotal * 0.08).toFixed(2));
  const total = order.amount;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 border-b border-neutral-border pb-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Meta label="Date" value={formatDate(order.date)} />
        <Meta label="Order #" value={order.id} />
        <Meta label="User" value={order.userName} />
        <Meta
          label="Products"
          value={String(productCount).padStart(2, "0")}
        />
        <Meta label="Sub Total" value={formatCurrency(subTotal)} />
        <Meta label="Tax" value={formatCurrency(tax)} />
        <Meta label="Total" value={formatCurrency(total)} />
      </div>

      <div>
        <h2 className="mb-4 text-[15px] font-semibold text-brand-600">
          Product Information
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse">
            <thead>
              <tr className="border-b border-neutral-border text-left text-[12px] font-medium text-neutral-muted">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Color</th>
                <th className="pb-3 font-medium">Size</th>
                <th className="pb-3 font-medium">Price</th>
                <th className="pb-3 font-medium">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr
                  key={`${item.productId}-${item.size}-${item.color}`}
                  className="border-b border-neutral-border last:border-0"
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 overflow-hidden rounded-md bg-neutral-bg">
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <p className="line-clamp-2 max-w-65 text-sm font-medium text-neutral-text">
                        {item.title}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-neutral-text">
                    {formatLineColor(item.color)}
                  </td>
                  <td className="py-4 text-sm text-neutral-text">
                    {formatLineSize(item.size)}
                  </td>
                  <td className="py-4 text-sm tabular-nums text-neutral-text">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="py-4 text-sm text-neutral-text">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-neutral-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-text">{value}</p>
    </div>
  );
}
