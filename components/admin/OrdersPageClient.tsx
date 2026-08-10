"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Package,
  Boxes,
  DollarSign,
  Search,
} from "lucide-react";
import type { AdminOrderStats, Order } from "@/types";
import {
  formatCurrency,
  formatDate,
  orderStatusClass,
  orderStatusLabel,
} from "@/lib/utils";
import { fetchAdminOrders } from "@/lib/api/admin";
import { useToast } from "@/components/ui/Toast";
import { AdminPagination } from "@/components/admin/AdminPagination";

const inputClass =
  "h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-[13px] text-[#333333] outline-none placeholder:text-[#8a94a6] focus:border-[#2563EB]";

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
        <p className="text-[12px] text-[#8a94a6]">{label}</p>
        <p
          className={`mt-1 text-xl font-bold text-[#111827] ${valueClassName ?? ""}`}
        >
          {value}
        </p>
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminOrders({
        search: debounced,
        page,
      });
      setOrders(data.orders);
      setStats(data.stats);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [debounced, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  return (
    <div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Orders"
          value={String(stats.totalOrders)}
          icon={Package}
        />
        <StatCard
          label="Total Units"
          value={String(stats.totalUnits)}
          icon={Boxes}
        />
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
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94a6]" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-[12px] font-medium text-[#8a94a6]">
              <th className="pb-3 pr-4 font-medium">Date</th>
              <th className="pb-3 pr-4 font-medium">Order #</th>
              <th className="pb-3 pr-4 font-medium">User</th>
              <th className="pb-3 pr-4 font-medium">Product(s)</th>
              <th className="pb-3 pr-4 font-medium">Amount</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#8a94a6]">
                  Loading…
                </td>
              </tr>
            ) : !orders.length ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#8a94a6]">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const productCount = o.items.reduce((sum, i) => sum + i.qty, 0);
                return (
                  <tr
                    key={o.id}
                    className="border-b border-[#f3f4f6] last:border-0"
                  >
                    <td className="py-3.5 pr-4 text-[#333333]">
                      {formatDate(o.date)}
                    </td>
                    <td className="py-3.5 pr-4 font-medium text-[#333333]">
                      {o.id}
                    </td>
                    <td className="py-3.5 pr-4 text-[#333333]">{o.userName}</td>
                    <td className="py-3.5 pr-4 text-[#333333]">{productCount}</td>
                    <td className="py-3.5 pr-4 font-medium tabular-nums text-[#333333]">
                      {formatCurrency(o.amount)}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-flex rounded px-2.5 py-1 text-[11px] font-semibold ${orderStatusClass(o.status)}`}
                      >
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="inline-flex rounded p-1.5 text-[#6b7280] transition hover:bg-brand-50 hover:text-[#2563EB]"
                        aria-label="View order"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
