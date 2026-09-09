"use client";

import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

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
    <div className="w-full max-w-none sm:max-w-70 md:ml-auto">
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex justify-between gap-6">
          <dt className="text-neutral-muted">Sub Total</dt>
          <dd className="font-medium tabular-nums text-neutral-text">{formatCurrency(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-neutral-muted">Tax</dt>
          <dd className="font-medium tabular-nums text-neutral-text">{formatCurrency(tax)}</dd>
        </div>
        <div className="flex justify-between gap-6 pt-1">
          <dt className="font-semibold text-neutral-text">Total</dt>
          <dd className="font-semibold tabular-nums text-neutral-text">{formatCurrency(total)}</dd>
        </div>
      </dl>
      <Button
        type="button"
        className="mt-5 w-full"
        disabled={disabled}
        loading={loading}
        onClick={onPlaceOrder}
      >
        Proceed to Checkout
      </Button>
    </div>
  );
}
