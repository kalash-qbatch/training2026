"use client";

import { ArrowUpRight } from "lucide-react";
import type { Order } from "@/types";
import {
  formatCurrency,
  formatDate,
  orderStatusClass,
  orderStatusLabel,
} from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

export function OrdersTable({
  orders,
  onViewOrder,
}: {
  orders: Order[];
  onViewOrder?: (orderId: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table wrapperClassName="table-custom-height-client-order-history min-w-180">
          <TableHeader>
            <TableRow className="border-b border-neutral-border text-left hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Order #</TableHead>
              <TableHead>Number of Product(s)</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead className="pr-0 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const productCount = order.items.reduce((sum, i) => sum + i.qty, 0);
              return (
                <TableRow key={order.id} className="border-b border-neutral-border">
                  <TableCell className="py-4 text-sm">{formatDate(order.date)}</TableCell>
                  <TableCell className="py-4 text-sm font-medium">
                    {order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="py-4 text-sm">{productCount}</TableCell>
                  <TableCell className="py-4 text-sm font-semibold tabular-nums">
                    {formatCurrency(order.amount)}
                  </TableCell>
                  <TableCell className="py-4">
                    <span
                      className={`inline-flex rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(order.status)}`}
                    >
                      {orderStatusLabel(order.status)}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 pr-0 text-right">
                    <button
                      type="button"
                      onClick={() => onViewOrder?.(order.id)}
                      className="inline-flex cursor-pointer rounded-md p-2 text-neutral-muted hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label={`View order ${order.id}`}
                    >
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
                  <p className="text-sm font-semibold text-neutral-text">{order.id.slice(0, 8)}</p>
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
