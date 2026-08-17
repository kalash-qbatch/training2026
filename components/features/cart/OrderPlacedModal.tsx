"use client";

import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function OrderPlacedModal({
  open,
  onDetails,
  onHome,
}: {
  open: boolean;
  onDetails: () => void;
  onHome: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onHome}
      title="Order Placed!"
      hideHeader
      className="max-w-85 rounded-2xl px-6 py-8"
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-success-bg">
          <Check className="h-7 w-7 text-[#16a34a]" strokeWidth={2.75} />
        </div>
        <h2 className="text-[18px] font-bold text-neutral-900">Order Placed!</h2>
        <p className="mt-1 text-[13px] text-neutral-muted">
          Your order has been successfully placed.
        </p>
        <button
          type="button"
          onClick={onDetails}
          className="mt-6 h-10 w-full rounded-md bg-brand-500 text-[13px] font-semibold text-white hover:bg-brand-600"
        >
          Check Order Details
        </button>
        <button
          type="button"
          onClick={onHome}
          className="mt-2.5 h-10 w-full rounded-md border border-neutral-border bg-white text-[13px] font-medium text-neutral-900 hover:bg-neutral-bg"
        >
          Return to Home
        </button>
      </div>
    </Modal>
  );
}
