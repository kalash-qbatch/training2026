"use client";

import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function CartSummary({
  subtotal,
  tax,
  total,
  disabled,
  loading,
  onPlaceOrder,
}: {
  subtotal: number;
  tax: number;
  total: number;
  disabled?: boolean;
  loading?: boolean;
  onPlaceOrder: () => void;
}) {
  return (
    <div className="md:ml-auto w-full max-w-70">
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex justify-between gap-6">
          <dt className="text-neutral-muted">Sub Total</dt>
          <dd className="font-medium tabular-nums text-neutral-text">
            {formatCurrency(subtotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-neutral-muted">Tax</dt>
          <dd className="font-medium tabular-nums text-neutral-text">
            {formatCurrency(tax)}
          </dd>
        </div>
        <div className="flex justify-between gap-6 pt-1">
          <dt className="font-semibold text-neutral-text">Total</dt>
          <dd className="font-semibold tabular-nums text-neutral-text">
            {formatCurrency(total)}
          </dd>
        </div>
      </dl>
      <Button
        type="button"
        className="mt-5"
        disabled={disabled}
        loading={loading}
        onClick={onPlaceOrder}
      >
        Place Order
      </Button>
    </div>
  );
}
