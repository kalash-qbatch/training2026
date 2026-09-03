"use client";

import { useState } from "react";

import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { type AdminOrderStatusUpdate, updateAdminOrderStatus } from "@/lib/api/admin";
import { cn, toAdminOrderStatus } from "@/lib/utils";
import type { Order } from "@/types";

type Props = {
  order: Order;
  onUpdated?: (order: Order) => void;
  className?: string;
};

/**
 * Status workflow:
 *  PROCESSING/PENDING ──Approve──▶ SHIPPED ──Deliver──▶ DELIVERED
 *         │                          │
 *         └──────────Cancel──────────┘ (COD always; card only if unpaid/failed)
 *
 * Card unpaid/failed → Cancel only
 * Card paid → Approve + Deliver (no Cancel)
 * COD → Approve + Deliver + Cancel
 */

type Step = {
  value: AdminOrderStatusUpdate;
  label: string;
  enabledFrom: AdminOrderStatusUpdate[];
};

const STEPS: Step[] = [
  {
    value: "SHIPPED",
    label: "Approve",
    enabledFrom: ["PROCESSING"],
  },
  {
    value: "DELIVERED",
    label: "Deliver",
    enabledFrom: ["SHIPPED"],
  },
  {
    value: "CANCELLED",
    label: "Cancel",
    enabledFrom: ["PROCESSING", "SHIPPED"],
  },
];

const STATUS_LABEL: Record<AdminOrderStatusUpdate, string> = {
  PROCESSING: "In Progress",
  SHIPPED: "Approved",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE: Record<AdminOrderStatusUpdate, string> = {
  PROCESSING: "bg-amber-50 text-amber-700 border-amber-200",
  SHIPPED: "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function isCardPaid(order: Order) {
  return (
    order.paymentMethod === "CARD" &&
    (order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "PAID")
  );
}

function isCardUnpaid(order: Order) {
  return order.paymentMethod === "CARD" && !isCardPaid(order);
}

function isStepAllowed(order: Order, current: AdminOrderStatusUpdate, step: Step): boolean {
  if (!step.enabledFrom.includes(current)) return false;
  if (isCardUnpaid(order)) return step.value === "CANCELLED";
  if (isCardPaid(order)) return step.value !== "CANCELLED";
  return true;
}

export function OrderStatusSelect({ order, onUpdated, className }: Props) {
  const { toast } = useToast();
  const [value, setValue] = useState<AdminOrderStatusUpdate>(toAdminOrderStatus(order.status));
  const [saving, setSaving] = useState(false);
  const [prevStatus, setPrevStatus] = useState(order.status);
  const [prevOrderId, setPrevOrderId] = useState(order.id);

  if (order.status !== prevStatus || order.id !== prevOrderId) {
    setPrevStatus(order.status);
    setPrevOrderId(order.id);
    setValue(toAdminOrderStatus(order.status));
  }

  const isTerminal = value === "DELIVERED" || value === "CANCELLED";
  const showPendingBadge = order.status === "pending" && value === "PROCESSING";

  const options = STEPS.map((step) => ({
    ...step,
    disabled: saving || !isStepAllowed(order, value, step),
  }));

  async function handleStep(step: Step) {
    if (saving || isTerminal) return;
    if (!isStepAllowed(order, value, step)) return;

    const prev = value;
    setValue(step.value);
    setSaving(true);
    try {
      const updated = await updateAdminOrderStatus(order.id, step.value);
      setValue(toAdminOrderStatus(updated.status));
      onUpdated?.(updated);
      toast.success(`Order marked as ${step.label}`);
    } catch (err) {
      setValue(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold",
          showPendingBadge ? "bg-amber-50 text-amber-700 border-amber-200" : STATUS_BADGE[value]
        )}
      >
        {showPendingBadge ? "Pending" : STATUS_LABEL[value]}
        {saving ? (
          <span className="ml-1.5 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : null}
      </span>

      {!isTerminal ? (
        <Select
          value=""
          placeholder="Update status"
          ariaLabel="Change order status"
          disabled={saving}
          className="min-w-40"
          options={options.map((step) => ({
            value: step.value,
            label: step.label,
            disabled: step.disabled,
          }))}
          onChange={(next) => {
            const step = options.find((s) => s.value === next);
            if (step && !step.disabled) handleStep(step);
          }}
        />
      ) : null}

      {isTerminal ? (
        <p className="text-[11px] text-neutral-muted">
          {value === "DELIVERED"
            ? "Order has been delivered. No further actions available."
            : "Order has been cancelled. No further actions available."}
        </p>
      ) : null}
    </div>
  );
}
