"use client";

import { useEffect, useState } from "react";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
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
import {
  formatCurrency,
  formatDate,
  // orderStatusClass,
  // orderStatusLabel,
} from "@/lib/utils";
import type { Order } from "@/types";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [prevOrderId, setPrevOrderId] = useState(orderId);

  // Reset loading during render when the order id changes
  // (https://react.dev/learn/you-might-not-need-an-effect)
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

  if (loading) {
    return <div className="py-8 text-[13px] text-neutral-muted">Loading…</div>;
  }

  if (error || !order) {
    return (
      <div className="py-8 text-[13px] text-red-500">
        {error || "Order not found"}{" "}
        <Link href="/admin/orders" className="text-[#2563EB] hover:underline">
          Back
        </Link>
      </div>
    );
  }

  const units = order.items.reduce((n, i) => n + i.qty, 0);
  const subTotal = order.subTotal ?? order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = order.tax ?? Number((subTotal * TAX_RATE).toFixed(2));

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
          <Meta label="Order #" value={order.id.slice(0, 8)} />
          <Meta label="User" value={order.userName} />
          <Meta label="Number of Products" value={String(units).padStart(2, "0")} />
          <Meta label="Sub Total" value={formatCurrency(subTotal)} />
          <Meta label="Tax" value={formatCurrency(tax)} />
          <Meta label="Total" value={formatCurrency(order.amount)} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-neutral-muted">Status</p>
          <OrderStatusSelect order={order} onUpdated={setOrder} />
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
            <TableRow key={`${item.productId}-${item.size}-${item.color}`}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  <p className="line-clamp-2 max-w-65 font-medium text-neutral-text">
                    {item.title}
                  </p>
                </div>
              </TableCell>
              <TableCell>{formatLineColor(item.color)}</TableCell>
              <TableCell>{formatLineSize(item.size)}</TableCell>
              <TableCell className="tabular-nums">{formatCurrency(item.price)}</TableCell>
              <TableCell>{item.qty}</TableCell>
              <TableCell className="pr-0">{item.stock ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
