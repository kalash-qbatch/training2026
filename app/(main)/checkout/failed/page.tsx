"use client";

import { Suspense } from "react";

import { CreditCard, RefreshCw, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function FailedContent() {
  const params = useSearchParams();
  const title = params.get("title") ?? "Payment Failed";
  const message = params.get("message") ?? "Your payment could not be processed at this time.";
  const suggestion =
    params.get("suggestion") ?? "Please try again or use a different payment method.";

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-neutral-border/60 bg-white shadow-[0_8px_30px_rgba(16,24,40,0.08)] sm:rounded-3xl">
          <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 py-8 text-center sm:px-8 sm:py-10">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <XCircle className="h-12 w-12 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-red-100">Your order was not completed</p>
          </div>

          {/* Details */}
          <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 space-y-1">
              <p className="text-sm font-semibold text-red-800">{message}</p>
              <p className="text-sm text-red-700">{suggestion}</p>
            </div>

            <p className="text-center text-sm font-semibold text-neutral-600">
              What would you like to do?
            </p>

            <div className="space-y-3">
              <Link
                href="/checkout"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again with a Different Card
              </Link>

              <Link
                href="/checkout"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
              >
                <Truck className="h-4 w-4" />
                Switch to Cash on Delivery
              </Link>

              <Link
                href="/payment-methods"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <CreditCard className="h-4 w-4" />
                Manage Payment Methods
              </Link>
            </div>

            <div className="border-t border-neutral-100 pt-4 text-center">
              <p className="text-xs text-neutral-400">
                If you believe this is an error, please{" "}
                <a href="mailto:support@bhaikastore.com" className="text-brand-600 hover:underline">
                  contact support
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense>
      <FailedContent />
    </Suspense>
  );
}
