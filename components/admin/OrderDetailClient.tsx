"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Order } from "@/types";
import {
  formatCurrency,
  formatDate,
  orderStatusClass,
  orderStatusLabel,
} from "@/lib/utils";
import { fetchAdminOrder } from "@/lib/api/admin";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
    return <div className="py-8 text-[13px] text-[#8a94a6]">Loading…</div>;
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
  const subTotal =
    order.subTotal ?? order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = order.tax ?? Number((subTotal * 0.08).toFixed(2));

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-6 inline-flex items-center gap-2 text-[22px] font-semibold text-[#2563EB] hover:text-[#1e6aef]"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
        Order Detail
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e7eb] pb-5">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Meta label="Date" value={formatDate(order.date)} />
          <Meta label="Order #" value={order.id} />
          <Meta label="User" value={order.userName} />
          <Meta label="Products" value={String(units).padStart(2, "0")} />
          <Meta label="Sub Total" value={formatCurrency(subTotal)} />
          <Meta label="Tax" value={formatCurrency(tax)} />
          <Meta label="Total" value={formatCurrency(order.amount)} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-[#8a94a6]">Status</p>
          <span
            className={`inline-flex w-fit rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(order.status)}`}
          >
            {orderStatusLabel(order.status)}
          </span>
          <OrderStatusSelect order={order} onUpdated={setOrder} />
        </div>
      </div>

      <h2 className="mb-4 text-[15px] font-semibold text-[#2563EB]">
        Product Information
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-[12px] font-medium text-[#8a94a6]">
              <th className="pb-3 pr-4 font-medium">Title</th>
              <th className="pb-3 pr-4 font-medium">Color</th>
              <th className="pb-3 pr-4 font-medium">Size</th>
              <th className="pb-3 pr-4 font-medium">Price</th>
              <th className="pb-3 pr-4 font-medium">Quantity</th>
              <th className="pb-3 font-medium">Stock</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr
                key={`${item.productId}-${item.size}-${item.color}`}
                className="border-b border-[#f3f4f6] last:border-0"
              >
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                    <p className="line-clamp-2 max-w-[260px] font-medium text-[#333333]">
                      {item.title}
                    </p>
                  </div>
                </td>
                <td className="py-3.5 pr-4 text-[#333333]">{item.color ?? "—"}</td>
                <td className="py-3.5 pr-4 text-[#333333]">{item.size ?? "—"}</td>
                <td className="py-3.5 pr-4 tabular-nums text-[#333333]">
                  {formatCurrency(item.price)}
                </td>
                <td className="py-3.5 pr-4 text-[#333333]">{item.qty}</td>
                <td className="py-3.5 text-[#333333]">{item.stock ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[#8a94a6]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#333333]">{value}</p>
    </div>
  );
}
