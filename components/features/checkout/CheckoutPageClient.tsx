"use client";

import { useState } from "react";

import { Elements } from "@stripe/react-stripe-js";
import { Lock, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/store/useAuthStore";
import { useCartStore } from "@/lib/store/useCartStore";
import { getStripe } from "@/lib/stripe-client";
import type { CartItem, CheckoutStep, PaymentErrorInfo, SavedPM, UserInfo } from "@/types";

import { CheckoutForm } from "./CheckoutForm";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary";
import { PaymentErrorBanner } from "./PaymentErrorBanner";
import { StepIndicator } from "./StepIndicator";
import { UserInfoForm } from "./UserInfoForm";

export function CheckoutPageClient({
  selectedItems: propItems,
  savedPMs,
}: {
  selectedItems: CartItem[];
  savedPMs: SavedPM[];
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const storeItems = useCartStore((s) => s.items);

  const selectedItems = propItems.length > 0 ? propItems : storeItems;

  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Number((subtotal * 0.1).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const [step, setStep] = useState<CheckoutStep>(1);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    phone: user?.mobile ?? "",
    address: "",
    city: "",
    postalCode: "",
  });
  const [errorInfo, setErrorInfo] = useState<PaymentErrorInfo | null>(null);

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
      <PaymentErrorBanner
        open={Boolean(errorInfo)}
        errorInfo={errorInfo}
        onDismiss={() => setErrorInfo(null)}
        onTryAgain={() => setErrorInfo(null)}
      />

      {/* <div className="mb-5 flex flex-col gap-4 sm:mb-7 lg:flex-row lg:items-center lg:justify-between"> */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_23rem] mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-text sm:text-2xl">
            Checkout
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-muted">
            <Lock className="h-3.5 w-3.5" />
            Complete your order in a few steps
          </p>
        </div>
        <div className="flex w-full justify-center lg:w-auto lg:justify-end">
          <StepIndicator currentStep={step} />
        </div>
      </div>

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
              <Elements stripe={getStripe()}>
                <CheckoutForm
                  selectedItems={selectedItems}
                  subtotal={subtotal}
                  tax={tax}
                  total={total}
                  savedPMs={savedPMs}
                  userInfo={userInfo}
                  onSuccess={(orderId, method) => {
                    router.push(`/checkout/success?orderId=${orderId}&method=${method}`);
                  }}
                  onError={(info) => {
                    setErrorInfo(info);
                    if (!info.recoverable) {
                      router.push(
                        `/checkout/failed?title=${encodeURIComponent(info.title)}&message=${encodeURIComponent(info.message)}&suggestion=${encodeURIComponent(info.suggestion)}`
                      );
                    }
                  }}
                  onBack={() => setStep(1)}
                />
              </Elements>
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
