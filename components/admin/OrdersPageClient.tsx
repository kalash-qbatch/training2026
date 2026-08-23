"use client";

import { useCallback, useEffect, useState } from "react";

import { ArrowUpRight, Boxes, DollarSign, Package, Search } from "lucide-react";
import Link from "next/link";

import { Pagination } from "@/components/ui/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminOrders } from "@/lib/api/admin";
import { TABLE_INITIAL_PAGE, TABLE_PAGE_SIZE } from "@/lib/constants";
import { formatCurrency, formatDate, orderStatusClass, orderStatusLabel } from "@/lib/utils";
import type { AdminOrderStats, Order } from "@/types";

const inputClass =
  "h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-neutral-text outline-none placeholder:text-neutral-muted focus:border-[#2563EB]";

function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#e5e7eb] bg-white p-5">
      <div>
        <p className="text-[12px] text-neutral-muted">{label}</p>
        <p className={`mt-1 text-xl font-bold text-neutral-900 ${valueClassName ?? ""}`}>{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-[#2563EB]">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

export function OrdersPageClient() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<AdminOrderStats>({
    totalOrders: 0,
    totalUnits: 0,
    totalAmount: 0,
  });
  const [page, setPage] = useState(TABLE_INITIAL_PAGE);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [prevDebounced, setPrevDebounced] = useState(debounced);
  const queryKey = `${debounced}|${page}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);

  // Adjust state during render instead of inside effects
  // (https://react.dev/learn/you-might-not-need-an-effect)
  if (debounced !== prevDebounced) {
    setPrevDebounced(debounced);
    if (page !== TABLE_INITIAL_PAGE) setPage(TABLE_INITIAL_PAGE);
  }
  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey);
    setLoading(true);
  }

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    fetchAdminOrders({
      search: debounced,
      page,
      pageSize: TABLE_PAGE_SIZE,
    })
      .then((data) => {
        setOrders(data.orders);
        setStats(data.stats);
        setTotalPages(data.totalPages);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load orders");
      })
      .finally(() => setLoading(false));
  }, [debounced, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Orders" value={String(stats.totalOrders)} icon={Package} />
        <StatCard label="Total Units" value={String(stats.totalUnits)} icon={Boxes} />
        <StatCard
          label="Total Amount"
          value={formatCurrency(stats.totalAmount)}
          icon={DollarSign}
          valueClassName="text-[#2563EB]"
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-semibold text-[#2563EB]">Orders</h1>
        <div className="relative w-full sm:w-72">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user & order ID"
            className={`${inputClass} pr-10`}
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-muted" />
        </div>
      </div>

      <Table wrapperClassName="h-[calc(100dvh-320px)] overflow-y-auto">
        <TableHeader>
          <TableRow className="border-b border-[#e5e7eb] hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Number of Product(s)</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-0">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableEmpty colSpan={7}>Loading…</TableEmpty>
          ) : !orders.length ? (
            <TableEmpty colSpan={7}>No orders found</TableEmpty>
          ) : (
            orders.map((o) => {
              const productCount = o.items.reduce((sum, i) => sum + i.qty, 0);
              return (
                <TableRow key={o.id}>
                  <TableCell>{formatDate(o.date)}</TableCell>
                  <TableCell className="font-medium">{o.orderNumber || o.id}</TableCell>
                  <TableCell>{o.userName}</TableCell>
                  <TableCell>{productCount}</TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatCurrency(o.amount)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(o.status)}`}
                    >
                      {orderStatusLabel(o.status)}
                    </span>
                  </TableCell>
                  <TableCell className="pr-0">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="inline-flex rounded p-1.5 text-[#6b7280] transition hover:bg-brand-50 hover:text-[#2563EB]"
                      aria-label="View order"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} className="mt-4" />
    </div>
  );
}
