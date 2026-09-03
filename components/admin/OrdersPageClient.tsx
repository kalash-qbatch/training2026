"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { ArrowUpRight, Boxes, DollarSign, Package, Search } from "lucide-react";
import Link from "next/link";

import { Pagination } from "@/components/ui/Pagination";
import { AdminTableBodySkeleton } from "@/components/ui/skeletons/AdminTableBodySkeleton";
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
import {
  displayOrderRef,
  formatCurrency,
  formatDate,
  orderRouteId,
  orderStatusClass,
  orderStatusLabel,
  paymentStatusClass,
  paymentStatusLabel,
} from "@/lib/utils";
import type { AdminOrderStats, Order } from "@/types";

const inputClass =
  "h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-neutral-text outline-none placeholder:text-neutral-muted focus:border-[#2563EB]";

const StatCardSkeleton = memo(function StatCardSkeleton() {
  return (
    <div className="flex animate-pulse items-center justify-between rounded-lg border border-[#e5e7eb] bg-white p-5">
      <div>
        <div className="h-3 w-20 rounded bg-neutral-border/50" />
        <div className="mt-2 h-7 w-16 rounded bg-neutral-border/60" />
      </div>
      <div className="h-10 w-10 rounded-full bg-neutral-border/40" />
    </div>
  );
});

const StatCard = memo(function StatCard({
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
});

const AdminOrderRow = memo(function AdminOrderRow({ order }: { order: Order }) {
  const productCount = useMemo(() => order.items.reduce((sum, i) => sum + i.qty, 0), [order.items]);

  return (
    <TableRow>
      <TableCell>{formatDate(order.date)}</TableCell>
      <TableCell className="font-medium">{order.orderRef ?? displayOrderRef(order)}</TableCell>
      <TableCell>{order.userName}</TableCell>
      <TableCell>{productCount}</TableCell>
      <TableCell className="font-medium tabular-nums">{formatCurrency(order.amount)}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-neutral-muted">
            {order.paymentMethod === "COD" ? "COD" : "Card"}
          </span>
          <span
            className={`inline-flex w-fit rounded border px-2 py-0.5 text-[11px] font-semibold ${paymentStatusClass(order.paymentStatus)}`}
          >
            {paymentStatusLabel(order.paymentStatus)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(order.status)}`}
        >
          {orderStatusLabel(order.status)}
        </span>
      </TableCell>
      <TableCell className="pr-0">
        <Link
          href={`/admin/orders/${orderRouteId(order)}`}
          className="inline-flex rounded p-1.5 text-[#6b7280] transition hover:bg-brand-50 hover:text-[#2563EB]"
          aria-label="View order"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
});

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

  const statCards = useMemo(
    () => [
      { label: "Total Orders", value: String(stats.totalOrders), icon: Package },
      { label: "Total Units", value: String(stats.totalUnits), icon: Boxes },
      {
        label: "Total Amount",
        value: formatCurrency(stats.totalAmount),
        icon: DollarSign,
        valueClassName: "text-[#2563EB]",
      },
    ],
    [stats.totalAmount, stats.totalOrders, stats.totalUnits]
  );

  return (
    <div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => <StatCard key={card.label} {...card} />)}
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
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-0">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <AdminTableBodySkeleton rows={6} columns={8} />
          ) : !orders.length ? (
            <TableEmpty colSpan={8}>No orders found</TableEmpty>
          ) : (
            orders.map((o) => <AdminOrderRow key={o.id} order={o} />)
          )}
        </TableBody>
      </Table>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} className="mt-4" />
    </div>
  );
}
