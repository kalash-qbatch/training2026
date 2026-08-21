"use client";

import { useState } from "react";

import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { type AdminOrderStatusUpdate, updateAdminOrderStatus } from "@/lib/api/admin";
import { toAdminOrderStatus } from "@/lib/utils";
import type { Order } from "@/types";

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
  const [value, setValue] = useState<AdminOrderStatusUpdate>(toAdminOrderStatus(order.status));
  const [saving, setSaving] = useState(false);
  const [prevStatus, setPrevStatus] = useState(order.status);
  const [prevOrderId, setPrevOrderId] = useState(order.id);

  // Sync value during render when the order prop changes
  // (https://react.dev/learn/you-might-not-need-an-effect)
  if (order.status !== prevStatus || order.id !== prevOrderId) {
    setPrevStatus(order.status);
    setPrevOrderId(order.id);
    setValue(toAdminOrderStatus(order.status));
  }

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
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className ?? "min-w-35"}>
      <Select
        value={value}
        disabled={saving}
        onChange={(v) => onChange(v as AdminOrderStatusUpdate)}
        options={OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        ariaLabel="Update order status"
        className="h-9 px-2 text-[12px] font-medium"
      />
    </div>
  );
}
