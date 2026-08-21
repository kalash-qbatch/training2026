"use client";

import { useEffect, useState } from "react";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { getOrderById } from "@/lib/api/orders";
import { TAX_RATE } from "@/lib/constants";
import { formatLineColor, formatLineSize } from "@/lib/product";
import { formatCurrency, formatDate, orderStatusClass, orderStatusLabel } from "@/lib/utils";
import type { Order } from "@/types";

export function UserOrderDetailClient({ orderId }: { orderId: string }) {
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
      <div className="mx-auto w-full space-y-6">
        <div className="h-8 w-44 animate-pulse rounded bg-neutral-border/50" />
        <div className="h-28 animate-pulse rounded-xl bg-neutral-border/40" />
        <div className="h-64 animate-pulse rounded-xl bg-neutral-border/40" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto w-full space-y-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <EmptyState
          title="Order not found"
          description="This order id is invalid or does not belong to your account."
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
    <div className="mx-auto w-full space-y-6">
      <div>
        <Link
          href="/orders"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold text-brand-600">Order Detail</h1>
          <span
            className={`inline-flex rounded px-3 py-1 text-xs font-semibold ${orderStatusClass(order.status)}`}
          >
            {orderStatusLabel(order.status)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-border bg-neutral-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Meta label="Date" value={formatDate(order.date)} />
          <Meta label="Order #" value={order.orderNumber || order.id} />
          <Meta label="User" value={order.userName} />
          <Meta label="Products" value={String(productCount).padStart(2, "0")} />
          <Meta label="Sub Total" value={formatCurrency(subTotal)} />
          <Meta label="Tax" value={formatCurrency(tax)} />
          <Meta label="Total" value={formatCurrency(total)} />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-border bg-neutral-surface p-5 sm:p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-brand-600">Product Information</h2>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-border text-left hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="pr-0 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow
                  key={`${item.productId}-${item.size}-${item.color}`}
                  className="border-b border-neutral-border last:border-0"
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-bg">
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <p className="line-clamp-2 max-w-sm text-sm font-medium text-neutral-text">
                        {item.title}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-text">
                    {formatLineColor(item.color)}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-text">
                    {formatLineSize(item.size)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-neutral-text">
                    {formatCurrency(item.price)}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-text">{item.qty}</TableCell>
                  <TableCell className="pr-0 text-right text-sm font-medium tabular-nums text-neutral-text">
                    {formatCurrency(item.price * item.qty)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile List View */}
        <ul className="space-y-3 md:hidden">
          {order.items.map((item) => (
            <li
              key={`${item.productId}-${item.size}-${item.color}`}
              className="rounded-lg border border-neutral-border p-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-bg">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-text">{item.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-muted">
                    {formatLineColor(item.color)} • {formatLineSize(item.size)} • Qty: {item.qty}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-text tabular-nums">
                    {formatCurrency(item.price * item.qty)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
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
