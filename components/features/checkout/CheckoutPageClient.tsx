"use client";

import { useState } from "react";

import { AlertCircle, Lock, ShoppingBag } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckoutFormSkeleton } from "@/components/ui/skeletons/CheckoutFormSkeleton";
import { TAX_RATE } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import type { CartItem, CheckoutStep, Order, SavedPM, UserInfo } from "@/types";

import { CheckoutOrderSummary } from "./CheckoutOrderSummary";
import { StepIndicator } from "./StepIndicator";
import { UserInfoForm } from "./UserInfoForm";

const CheckoutPaymentStep = dynamic(
  () => import("./CheckoutPaymentStep").then((m) => ({ default: m.CheckoutPaymentStep })),
  { ssr: false, loading: () => <CheckoutFormSkeleton /> }
);

function orderItemsToCartItems(order: Order): CartItem[] {
  return order.items.map((item) => ({
    productId: item.productId,
    specificationId: item.specificationId,
    name: item.title,
    price: item.price,
    qty: item.qty,
    imageUrl: item.imageUrl,
    color: item.color,
    size: item.size,
  }));
}

export function CheckoutPageClient({
  selectedItems: propItems,
  savedPMs,
  retryOrder,
}: {
  selectedItems: CartItem[];
  savedPMs: SavedPM[];
  retryOrder?: Order | null;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const storeItems = useCartStore((s) => s.items);

  const isRetry = Boolean(retryOrder);
  const retryItems = retryOrder ? orderItemsToCartItems(retryOrder) : [];
  const selectedItems = isRetry ? retryItems : propItems.length > 0 ? propItems : storeItems;

  const subtotal = isRetry
    ? retryOrder!.subTotal
    : selectedItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = isRetry ? retryOrder!.tax : Number((subtotal * TAX_RATE).toFixed(2));
  const total = isRetry ? retryOrder!.amount : Number((subtotal + tax).toFixed(2));

  const [step, setStep] = useState<CheckoutStep>(isRetry ? 2 : 1);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    fullName: retryOrder?.shipping?.fullName ?? user?.fullName ?? "",
    email: retryOrder?.shipping?.email ?? user?.email ?? "",
    phone: retryOrder?.shipping?.phone ?? user?.mobile ?? "",
    address: retryOrder?.shipping?.address ?? "",
    city: retryOrder?.shipping?.city ?? "",
    postalCode: retryOrder?.shipping?.postalCode ?? "",
  });

  if (!user) {
    router.push("/login?next=/checkout");
    return null;
  }

  if (selectedItems.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center sm:py-24">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-bg text-neutral-muted">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-neutral-text sm:text-base">Your cart is empty</p>
        <p className="mt-1 text-sm text-neutral-muted">
          Add items to your bag before checking out.
        </p>
        <Link
          href="/products"
          className="mt-5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem] mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-text sm:text-2xl">
            {isRetry ? "Retry Payment" : "Checkout"}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-muted">
            <Lock className="h-3.5 w-3.5" />
            {isRetry
              ? "Complete payment for your existing order"
              : "Complete your order in a few steps"}
          </p>
        </div>
        {!isRetry ? (
          <div className="flex w-full justify-center lg:w-auto lg:justify-end">
            <StepIndicator currentStep={step} />
          </div>
        ) : null}
      </div>

      {isRetry ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">
              Payment required for order #{retryOrder!.id.slice(0, 8)}
            </p>
            <p className="mt-0.5">
              Your order is placed and items are reserved. Choose a payment method below to complete
              your purchase.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          <div
            key={step}
            className="animate-[fade-in-up_0.25s_cubic-bezier(0.16,1,0.3,1)] rounded-xl border border-neutral-border/80 bg-white p-4 shadow-[0_4px_16px_rgba(16,24,40,0.06)] sm:p-6 lg:p-7"
          >
            {step === 1 ? (
              <UserInfoForm
                initial={userInfo}
                onContinue={(info) => {
                  setUserInfo(info);
                  setStep(2);
                }}
              />
            ) : (
              <CheckoutPaymentStep
                selectedItems={selectedItems}
                subtotal={subtotal}
                tax={tax}
                total={total}
                savedPMs={savedPMs}
                userInfo={userInfo}
                retryOrderId={retryOrder?.id}
                onSuccess={(orderId, method) => {
                  router.push(`/checkout/success?orderId=${orderId}&method=${method}`);
                }}
                onError={(info) => {
                  const params = new URLSearchParams({
                    title: info.title || "Payment Failed",
                    message: info.message || "Your payment could not be processed.",
                    suggestion:
                      info.suggestion || "Please try again or use a different payment method.",
                  });
                  if (info.orderId) params.set("orderId", info.orderId);
                  router.push(`/checkout/failed?${params.toString()}`);
                }}
                onBack={() => setStep(1)}
              />
            )}
          </div>
        </div>

        <aside className="order-first lg:sticky lg:top-20 lg:order-0">
          <CheckoutOrderSummary items={selectedItems} subtotal={subtotal} tax={tax} total={total} />
        </aside>
      </div>
    </div>
  );
}
