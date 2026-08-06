"use client";

import { ArrowUpRight } from "lucide-react";
import type { Order } from "@/types";
import {
  formatCurrency,
  formatDate,
  orderStatusClass,
  orderStatusLabel,
} from "@/lib/utils";

export function OrdersTable({
  orders,
  onViewOrder,
}: {
  orders: Order[];
  onViewOrder?: (orderId: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-border text-left text-[12px] font-medium text-neutral-muted">
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium">Order #</th>
              <th className="pb-3 font-medium">Number of Product(s)</th>
              <th className="pb-3 font-medium">Amount</th>
              <th className="pb-3 font-medium">Order Status</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const productCount = order.items.reduce((sum, i) => sum + i.qty, 0);
              return (
                <tr key={order.id} className="border-b border-neutral-border">
                  <td className="py-4 text-sm text-neutral-text">
                    {formatDate(order.date)}
                  </td>
                  <td className="py-4 text-sm font-medium text-neutral-text">
                    {order.id}
                  </td>
                  <td className="py-4 text-sm text-neutral-text">{productCount}</td>
                  <td className="py-4 text-sm font-semibold tabular-nums text-neutral-text">
                    {formatCurrency(order.amount)}
                  </td>
                  <td className="py-4">
                    <span
                      className={`inline-flex rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(order.status)}`}
                    >
                      {orderStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onViewOrder?.(order.id)}
                      className="inline-flex rounded-md p-2 text-neutral-muted hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label={`View order ${order.id}`}
                    >
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {orders.map((order) => {
          const productCount = order.items.reduce((sum, i) => sum + i.qty, 0);
          return (
            <li
              key={order.id}
              className="rounded-lg border border-neutral-border bg-neutral-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-text">{order.id}</p>
                  <p className="mt-1 text-xs text-neutral-muted">
                    {formatDate(order.date)}
                  </p>
                  <p className="mt-1 text-xs text-neutral-muted">
                    {productCount} product{productCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-neutral-text">
                    {formatCurrency(order.amount)}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(order.status)}`}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onViewOrder?.(order.id)}
                  className="rounded-md p-2 text-neutral-muted hover:bg-brand-50 hover:text-brand-600"
                  aria-label={`View order ${order.id}`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
