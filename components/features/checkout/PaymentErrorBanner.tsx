"use client";

import { AlertCircle } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import type { PaymentErrorInfo } from "@/types";

type Props = {
  open: boolean;
  errorInfo: PaymentErrorInfo | null;
  onDismiss: () => void;
  onTryAgain: () => void;
};

export function PaymentErrorBanner({ open, errorInfo, onDismiss, onTryAgain }: Props) {
  return (
    <Modal
      open={open && Boolean(errorInfo)}
      onClose={onDismiss}
      title={errorInfo?.title ?? "Payment Failed"}
      hideHeader
      className="max-w-md overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-0 shadow-xl"
    >
      {errorInfo ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-red-800">{errorInfo.title}</h3>
              <p className="mt-1.5 text-sm text-red-700">{errorInfo.message}</p>
              <p className="mt-1 text-sm font-medium text-red-600">{errorInfo.suggestion}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {errorInfo.recoverable ? (
                  <button
                    type="button"
                    onClick={onTryAgain}
                    className="rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Try Again
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-md border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
