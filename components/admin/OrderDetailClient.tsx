"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AdminOrderDetailSkeleton } from "@/components/ui/skeletons/AdminOrderDetailSkeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { fetchAdminOrder } from "@/lib/api/admin";
import { TAX_RATE } from "@/lib/constants";
import { formatLineColor, formatLineSize } from "@/lib/product";
import { cn, displayOrderRef, formatCurrency, formatDate } from "@/lib/utils";
import type { Order, OrderItem } from "@/types";

const OrderStatusSelect = dynamic(
  () =>
    import("@/components/admin/OrderStatusSelect").then((m) => ({ default: m.OrderStatusSelect })),
  {
    loading: () => <div className="h-8 w-32 animate-pulse rounded bg-neutral-border/50" />,
  }
);

const Meta = memo(function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-neutral-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-text">{value}</p>
    </div>
  );
});

const OrderDetailLineItem = memo(function OrderDetailLineItem({ item }: { item: OrderItem }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
          <p className="line-clamp-2 max-w-65 font-medium text-neutral-text">{item.title}</p>
        </div>
      </TableCell>
      <TableCell>{formatLineColor(item.color)}</TableCell>
      <TableCell>{formatLineSize(item.size)}</TableCell>
      <TableCell className="tabular-nums">{formatCurrency(item.price)}</TableCell>
      <TableCell>{item.qty}</TableCell>
      <TableCell className="pr-0">{item.stock ?? "—"}</TableCell>
    </TableRow>
  );
});

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [prevOrderId, setPrevOrderId] = useState(orderId);

  if (orderId !== prevOrderId) {
    setPrevOrderId(orderId);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let cancelled = false;
    fetchAdminOrder(orderId)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const summary = useMemo(() => {
    if (!order) return null;
    const units = order.items.reduce((n, i) => n + i.qty, 0);
    const subTotal = order.subTotal ?? order.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = order.tax ?? Number((subTotal * TAX_RATE).toFixed(2));
    return { units, subTotal, tax };
  }, [order]);

  if (loading) {
    return <AdminOrderDetailSkeleton />;
  }

  if (error || !order || !summary) {
    return (
      <div className="py-8 text-[13px] text-red-500">
        {error || "Order not found"}{" "}
        <Link href="/admin/orders" className="text-[#2563EB] hover:underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-6 inline-flex items-center gap-2 text-[22px] font-semibold text-[#2563EB] hover:text-brand-600"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
        Order Detail
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e7eb] pb-5">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Meta label="Date" value={formatDate(order.date)} />
          <Meta label="Order #" value={order.orderRef ?? displayOrderRef(order)} />
          <Meta label="User" value={order.userName} />
          <Meta label="Number of Products" value={String(summary.units).padStart(2, "0")} />
          <Meta label="Sub Total" value={formatCurrency(summary.subTotal)} />
          <Meta label="Tax" value={formatCurrency(summary.tax)} />
          <Meta label="Total" value={formatCurrency(order.amount)} />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-neutral-muted">Payment</p>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "PAID"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : order.paymentMethod === "COD"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-orange-50 text-orange-700 border-orange-200"
              )}
            >
              {order.paymentMethod === "COD" ? "COD" : "CARD"}: {order.paymentStatus || "PENDING"}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-neutral-muted">Status</p>
            <OrderStatusSelect order={order} onUpdated={setOrder} />
          </div>
        </div>
      </div>

      <h2 className="mb-4 text-[15px] font-semibold text-[#2563EB]">Product Information</h2>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[#e5e7eb] hover:bg-transparent">
            <TableHead>Title</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead className="pr-0">Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => (
            <OrderDetailLineItem key={`${item.productId}-${item.size}-${item.color}`} item={item} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
