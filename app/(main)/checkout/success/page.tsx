"use client";

import { Suspense } from "react";

import { CheckCircle2, CreditCard, Package, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const method = params.get("method") as "CARD" | "COD" | null;

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-neutral-border/60 bg-white shadow-[0_8px_30px_rgba(16,24,40,0.08)] sm:rounded-3xl">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-8 text-center sm:px-8 sm:py-10">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-bold text-white">Order Placed!</h1>
            <p className="mt-1 text-green-100">Thank you for your purchase</p>
          </div>

          {/* Details */}
          <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
            {orderId && (
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
                <span className="text-sm text-neutral-500">Order ID</span>
                <span className="font-mono text-sm font-semibold text-neutral-800">
                  #{orderId.slice(0, 8).toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <span className="text-sm text-neutral-500">Payment Method</span>
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                {method === "COD" ? (
                  <>
                    <Truck className="h-4 w-4 text-amber-500" />
                    Cash on Delivery
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 text-indigo-500" />
                    Credit / Debit Card
                  </>
                )}
              </span>
            </div>

            {method === "COD" && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                💵 Please have the exact amount ready when the delivery arrives.
              </div>
            )}

            {method === "CARD" && (
              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
                ✅ Your payment has been confirmed and your order is being processed.
              </div>
            )}

            <div className="border-t border-neutral-100 pt-2 space-y-3">
              {orderId && (
                <Link
                  href={`/orders/${orderId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  <Package className="h-4 w-4" />
                  View Order Details
                </Link>
              )}
              <Link
                href="/orders"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Order History
              </Link>
              <Link
                href="/products"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <ShoppingBag className="h-4 w-4" />
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
