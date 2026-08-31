"use client";

import { useState } from "react";

import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { type AdminOrderStatusUpdate, updateAdminOrderStatus } from "@/lib/api/admin";
import { toAdminOrderStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

type Props = {
  order: Order;
  onUpdated?: (order: Order) => void;
  className?: string;
};

/**
 * Status step workflow (admin-only):
 *
 *  PROCESSING ──Approve──▶ SHIPPED ──Deliver──▶ DELIVERED  (terminal)
 *       │                     │
 *       └──Cancel──▶ CANCELLED (terminal)
 *
 * Rules:
 *  - PROCESSING : Approve + Cancel enabled
 *  - SHIPPED    : Deliver + Cancel enabled; Approve disabled
 *  - DELIVERED  : all actions disabled
 *  - CANCELLED  : all actions disabled
 */

type Step = {
  /** The Prisma status this step transitions TO */
  value: AdminOrderStatusUpdate;
  label: string;
  /** Which current statuses allow clicking this action */
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

  const isTerminal = value === "DELIVERED" || value === "CANCELLED";
  const isCardPayment = order.paymentMethod === "CARD";
  const isPaymentSuccessful = order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "PAID";
  const isCardPaymentLocked = isCardPayment && !isPaymentSuccessful;

  async function handleStep(step: Step) {
    if (saving || isCardPaymentLocked) return;
    const isEnabled = step.enabledFrom.includes(value);
    if (!isEnabled || isTerminal) return;

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
          STATUS_BADGE[value]
        )}
      >
        {STATUS_LABEL[value]}
        {saving && (
          <span className="ml-1.5 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
        )}
      </span>

      {isCardPaymentLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          ⚠️ Card payment is <span className="font-semibold">{order.paymentStatus}</span>. Order
          status change is locked until payment succeeds.
        </div>
      )}

      {!isTerminal && !isCardPaymentLocked && (
        <Select
          value=""
          placeholder="Update status"
          ariaLabel="Change order status"
          disabled={saving}
          className="min-w-40"
          options={STEPS.map((step) => ({
            value: step.value,
            label: step.label,
            disabled: !step.enabledFrom.includes(value) || saving,
          }))}
          onChange={(next) => {
            const step = STEPS.find((s) => s.value === next);
            if (step) handleStep(step);
          }}
        />
      )}

      {isTerminal && (
        <p className="text-[11px] text-neutral-muted">
          {value === "DELIVERED"
            ? "Order has been delivered. No further actions available."
            : "Order has been cancelled. No further actions available."}
        </p>
      )}
    </div>
  );
}
