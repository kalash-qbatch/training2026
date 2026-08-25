"use client";

import { useEffect, useState } from "react";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { getOrderById } from "@/lib/api/orders";
import { TAX_RATE } from "@/lib/constants";
import { formatLineColor, formatLineSize } from "@/lib/product";
import { formatCurrency, formatDate, orderStatusClass, orderStatusLabel } from "@/lib/utils";
import type { Order } from "@/types";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [prevOrderId, setPrevOrderId] = useState(orderId);

  if (orderId !== prevOrderId) {
    setPrevOrderId(orderId);
    setOrder(undefined);
  }

  useEffect(() => {
    let cancelled = false;
    getOrderById(orderId)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (order === undefined) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-border/50" />
        <div className="h-20 animate-pulse rounded-lg bg-neutral-border/50" />
        <div className="h-64 animate-pulse rounded-lg bg-neutral-border/50" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <EmptyState
          title="Order not found"
          description="This order id is invalid or no longer available."
          ctaHref="/orders"
          ctaLabel="View all orders"
        />
      </div>
    );
  }

  const productCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  const subTotal = order.subTotal ?? order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = order.tax ?? Number((subTotal * TAX_RATE).toFixed(2));
  const total = order.amount;

  return (
    <div className="space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-2 text-lg font-semibold text-brand-600 hover:text-brand-700 sm:text-xl"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
        Order Detail
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-border pb-5">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Meta label="Date" value={formatDate(order.date)} />
          <Meta label="Order #" value={order.id.slice(0, 8)} />
          <Meta label="User" value={order.userName} />
          <Meta label="Products" value={String(productCount).padStart(2, "0")} />
          <Meta label="Sub Total" value={formatCurrency(subTotal)} />
          <Meta label="Tax" value={formatCurrency(tax)} />
          <Meta label="Total" value={formatCurrency(total)} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[12px] text-neutral-muted">Order Status</p>
          <span
            className={`inline-flex items-center justify-center rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(order.status)}`}
          >
            {orderStatusLabel(order.status)}
          </span>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-[15px] font-semibold text-brand-600">Product Information</h2>
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
                  <td className="py-2 pr-4">
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
                  <td className="py-4 text-sm text-neutral-text">{formatLineColor(item.color)}</td>
                  <td className="py-4 text-sm text-neutral-text">{formatLineSize(item.size)}</td>
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
