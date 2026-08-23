"use client";

import { useState } from "react";

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
  /** Visual style variant */
  variant: "approve" | "deliver" | "cancel";
};

const STEPS: Step[] = [
  {
    value: "SHIPPED",
    label: "Approve",
    enabledFrom: ["PROCESSING"],
    variant: "approve",
  },
  {
    value: "DELIVERED",
    label: "Deliver",
    enabledFrom: ["SHIPPED"],
    variant: "deliver",
  },
  {
    value: "CANCELLED",
    label: "Cancel",
    enabledFrom: ["PROCESSING", "SHIPPED"],
    variant: "cancel",
  },
];

const STATUS_LABEL: Record<AdminOrderStatusUpdate, string> = {
  PROCESSING: "In Progress",
  SHIPPED: "Approved",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE: Record<AdminOrderStatusUpdate, string> = {
  PROCESSING:
    "bg-amber-50 text-amber-700 border-amber-200",
  SHIPPED:
    "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED:
    "bg-green-50 text-green-700 border-green-200",
  CANCELLED:
    "bg-red-50 text-red-700 border-red-200",
};

const VARIANT_BASE: Record<Step["variant"], string> = {
  approve:
    "border-blue-300 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 focus-visible:ring-blue-400",
  deliver:
    "border-green-300 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-600 focus-visible:ring-green-400",
  cancel:
    "border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 focus-visible:ring-red-400",
};

const VARIANT_ACTIVE: Record<Step["variant"], string> = {
  approve: "bg-blue-600 border-blue-600 text-white",
  deliver: "bg-green-600 border-green-600 text-white",
  cancel: "bg-red-600 border-red-600 text-white",
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

  async function handleStep(step: Step) {
    if (saving) return;
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
      {/* Current status badge */}
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

      {/* Action buttons */}
      {!isTerminal && (
        <div className="flex flex-wrap gap-2">
          {STEPS.map((step) => {
            const isEnabled = step.enabledFrom.includes(value) && !saving;
            const isActive = value === step.value;

            return (
              <button
                key={step.value}
                type="button"
                disabled={!isEnabled}
                onClick={() => handleStep(step)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                  isActive
                    ? VARIANT_ACTIVE[step.variant]
                    : VARIANT_BASE[step.variant],
                  !isEnabled &&
                    "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300 hover:bg-neutral-50 hover:text-neutral-300 hover:border-neutral-200"
                )}
              >
                {step.label}
              </button>
            );
          })}
        </div>
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
