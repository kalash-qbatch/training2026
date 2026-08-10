"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/types";
import {
  updateAdminOrderStatus,
  type AdminOrderStatusUpdate,
} from "@/lib/api/admin";
import { toAdminOrderStatus } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

/** Maps to Prisma OrderStatus. */
const OPTIONS: Array<{ value: AdminOrderStatusUpdate; label: string }> = [
  { value: "PROCESSING", label: "In Progress" },
  { value: "SHIPPED", label: "Approve" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancel" },
];

type Props = {
  order: Order;
  onUpdated?: (order: Order) => void;
  className?: string;
};

export function OrderStatusSelect({ order, onUpdated, className }: Props) {
  const { toast } = useToast();
  const [value, setValue] = useState<AdminOrderStatusUpdate>(
    toAdminOrderStatus(order.status)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(toAdminOrderStatus(order.status));
  }, [order.status, order.id]);

  async function onChange(next: AdminOrderStatusUpdate) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const updated = await updateAdminOrderStatus(order.id, next);
      setValue(toAdminOrderStatus(updated.status));
      onUpdated?.(updated);
      const label = OPTIONS.find((o) => o.value === next)?.label ?? next;
      toast.success(`Order marked as ${label}`);
    } catch (err) {
      setValue(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => onChange(e.target.value as AdminOrderStatusUpdate)}
      aria-label="Update order status"
      className={
        className ??
        "h-9 min-w-[140px] rounded-md border border-[#d0d5dd] bg-white px-2 text-[12px] font-medium text-[#333333] outline-none focus:border-[#2563EB] disabled:opacity-60"
      }
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
