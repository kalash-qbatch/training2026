"use client";

import { useState } from "react";

import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ArrowLeft, CreditCard, Lock, MapPin, Plus, Star, Truck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCartStore } from "@/lib/store/useCartStore";
import { formatCurrency, orderRouteId } from "@/lib/utils";
import type { CartItem, PaymentErrorInfo, SavedPM, UserInfo } from "@/types";

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: "15px",
      color: "#333333",
      fontFamily: "'Inter', system-ui, sans-serif",
      "::placeholder": { color: "#8a94a6" },
      iconColor: "#2979ff",
    },
    invalid: { color: "#ef4444", iconColor: "#ef4444" },
  },
};

function BrandMark({ brand }: { brand: string }) {
  const key = brand.toLowerCase();
  if (key === "visa") {
    return (
      <span className="flex h-8 w-12 items-center justify-center rounded-md bg-[#1A1F71] text-[10px] font-bold italic tracking-wide text-white">
        VISA
      </span>
    );
  }
  if (key === "mastercard") {
    return (
      <span className="relative flex h-8 w-12 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
        <span className="absolute left-2 h-4 w-4 rounded-full bg-[#EB001B]" />
        <span className="absolute right-2 h-4 w-4 rounded-full bg-[#F79E1B]" />
      </span>
    );
  }
  if (key === "amex") {
    return (
      <span className="flex h-8 w-12 items-center justify-center rounded-md bg-[#006FCF] text-[8px] font-bold text-white">
        AMEX
      </span>
    );
  }
  return (
    <span className="flex h-8 w-12 items-center justify-center rounded-md bg-neutral-100 text-neutral-muted">
      <CreditCard className="h-4 w-4" />
    </span>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? "border-brand-500" : "border-neutral-300"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-brand-500" : "bg-transparent"}`}
      />
    </span>
  );
}

function brandLabel(brand: string) {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

type Props = {
  selectedItems: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  savedPMs: SavedPM[];
  userInfo: UserInfo;
  retryOrderId?: string;
  onSuccess: (orderId: string, method: "CARD" | "COD") => void;
  onError: (info: PaymentErrorInfo) => void;
  onBack: () => void;
};

export function CheckoutForm({
  selectedItems,
  subtotal,
  tax,
  total,
  savedPMs,
  userInfo,
  retryOrderId,
  onSuccess,
  onError,
  onBack,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const fetchCart = useCartStore((s) => s.fetchCart);

  const [paymentOption, setPaymentOption] = useState<"COD" | "CARD">("COD");
  const [selectedPmId, setSelectedPmId] = useState<string>(
    savedPMs.find((p) => p.isDefault)?.id ?? savedPMs[0]?.id ?? "new"
  );
  const [saveCard, setSaveCard] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | undefined>(retryOrderId);

  const itemPayload = selectedItems.map((i) => ({
    productId: i.productId,
    specificationId: i.specificationId,
    quantity: i.qty,
  }));

  async function handleCOD() {
    setPlacing(true);
    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "COD",
          items: retryOrderId ? undefined : itemPayload,
          orderId: retryOrderId,
          shipping: retryOrderId ? undefined : userInfo,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Order failed");

      if (!retryOrderId) {
        await fetchCart();
      }
      onSuccess(orderRouteId(data.order), "COD");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  async function handleCard() {
    if (!stripe || !elements) return;
    setPlacing(true);

    const activeOrderId = pendingOrderId ?? retryOrderId;

    try {
      const useExistingPm = selectedPmId !== "new" && selectedPmId !== "";

      const intentRes = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: activeOrderId ? undefined : itemPayload,
          orderId: activeOrderId,
          shipping: activeOrderId ? undefined : userInfo,
          paymentMethodId: useExistingPm ? selectedPmId : undefined,
          savePaymentMethod: saveCard,
        }),
      });
      const intentData = await intentRes.json();
      if (!intentData.success) throw new Error(intentData.error || "Could not initiate payment");

      const { clientSecret, paymentIntentId, orderId } = intentData;
      setPendingOrderId(orderId);

      let confirmResult;
      if (useExistingPm) {
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: selectedPmId,
        });
      } else {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error("Card element not found");
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement },
        });
      }

      if (confirmResult.error) {
        await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethod: "CARD",
            paymentIntentId,
            orderId,
          }),
        });

        if (!retryOrderId) {
          await fetchCart();
        }

        onError({
          title: "Payment Failed",
          message: confirmResult.error.message || "Your payment could not be processed.",
          suggestion: "Please check your card details or try a different payment method.",
          recoverable: true,
          orderId,
        });
        return;
      }

      const confirmRes = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "CARD",
          paymentIntentId,
          orderId,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        if (!retryOrderId) {
          await fetchCart();
        }
        onError(
          confirmData.errorInfo
            ? { ...confirmData.errorInfo, orderId }
            : {
                title: "Payment Failed",
                message: confirmData.error || "Failed to confirm payment",
                suggestion: "Please try again or use a different payment method.",
                recoverable: true,
                orderId,
              }
        );
        return;
      }

      if (!retryOrderId) {
        await fetchCart();
      }
      onSuccess(orderRouteId(confirmData.order), "CARD");
    } catch (err) {
      const orderId = pendingOrderId ?? retryOrderId;
      if (orderId) {
        if (!retryOrderId) {
          await fetchCart();
        }
        onError({
          title: "Payment Error",
          message: err instanceof Error ? err.message : "An unexpected error occurred.",
          suggestion: "Please try again or use a different payment method.",
          recoverable: true,
          orderId,
        });
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to process payment");
      }
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-text">Payment details</h2>
        <p className="mt-0.5 text-sm text-neutral-muted">Choose how you&apos;d like to pay</p>
      </div>

      <div className="rounded-xl border border-neutral-100 bg-neutral-bg/70 p-3.5 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-black/5">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-muted">
                  Deliver to
                </p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-text">
                  {userInfo.fullName}
                </p>
              </div>
              {!retryOrderId ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-white"
                >
                  Edit
                </button>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-neutral-muted">{userInfo.phone}</p>
            <p className="mt-0.5 wrap-break-word text-xs text-neutral-muted">
              {userInfo.address}, {userInfo.city} — {userInfo.postalCode}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-muted">
          Payment method
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer flex-col rounded-xl border-2 p-3.5 transition-all ${
              paymentOption === "COD"
                ? "border-brand-500 bg-brand-50 shadow-[0_0_0_1px_rgba(41,121,255,0.12)]"
                : "border-neutral-border hover:border-neutral-300"
            }`}
          >
            <input
              type="radio"
              name="payment-option"
              value="COD"
              checked={paymentOption === "COD"}
              onChange={() => setPaymentOption("COD")}
              className="sr-only"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Truck className="h-4 w-4" />
              </div>
              <RadioDot selected={paymentOption === "COD"} />
            </div>
            <p className="mt-3 text-sm font-semibold text-neutral-text">Cash on Delivery</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-muted">
              Pay with cash when your order arrives.
            </p>
            <span className="mt-2.5 w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              No card needed
            </span>
          </label>

          <label
            className={`flex cursor-pointer flex-col rounded-xl border-2 p-3.5 transition-all ${
              paymentOption === "CARD"
                ? "border-brand-500 bg-brand-50 shadow-[0_0_0_1px_rgba(41,121,255,0.12)]"
                : "border-neutral-border hover:border-neutral-300"
            }`}
          >
            <input
              type="radio"
              name="payment-option"
              value="CARD"
              checked={paymentOption === "CARD"}
              onChange={() => setPaymentOption("CARD")}
              className="sr-only"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <CreditCard className="h-4 w-4" />
              </div>
              <RadioDot selected={paymentOption === "CARD"} />
            </div>
            <p className="mt-3 text-sm font-semibold text-neutral-text">Credit / Debit Card</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-muted">
              Pay securely with Visa, Mastercard, and more.
            </p>
            <span className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              <Lock className="h-3 w-3" /> SSL encrypted
            </span>
          </label>
        </div>
      </div>

      {paymentOption === "CARD" ? (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-muted">
            Select card
          </h3>

          {savedPMs.length > 0 ? (
            <div className="space-y-2">
              {savedPMs.map((pm) => (
                <label
                  key={pm.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-3 transition-all sm:px-4 ${
                    selectedPmId === pm.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-neutral-border hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="saved-pm"
                    value={pm.id}
                    checked={selectedPmId === pm.id}
                    onChange={() => setSelectedPmId(pm.id)}
                    className="sr-only"
                  />
                  <RadioDot selected={selectedPmId === pm.id} />
                  <BrandMark brand={pm.brand} />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-neutral-text">
                      {brandLabel(pm.brand)} •••• {pm.last4}
                    </span>
                    <span className="ml-2 text-xs text-neutral-muted">
                      {pm.expMonth.toString().padStart(2, "0")}/{pm.expYear}
                    </span>
                  </div>
                  {pm.isDefault ? (
                    <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          ) : null}

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3 transition-all sm:px-4 ${
              selectedPmId === "new"
                ? "border-brand-500 bg-brand-50"
                : "border-neutral-border hover:border-neutral-300"
            }`}
          >
            <input
              type="radio"
              name="saved-pm"
              value="new"
              checked={selectedPmId === "new"}
              onChange={() => setSelectedPmId("new")}
              className="sr-only"
            />
            <RadioDot selected={selectedPmId === "new"} />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Plus className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-neutral-text">Add new card</span>
          </label>

          {selectedPmId === "new" ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-neutral-border bg-neutral-bg px-3 py-3.5 sm:px-4">
                <CardElement options={CARD_ELEMENT_OPTIONS} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-muted">
                <input
                  type="checkbox"
                  checked={saveCard}
                  onChange={(e) => setSaveCard(e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                Save card for future purchases
              </label>
            </div>
          ) : null}

          <div className="flex items-center gap-1.5 text-[11px] text-neutral-muted">
            <Lock className="h-3 w-3 shrink-0" />
            Secured by Stripe. We never store your full card number.
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5 rounded-xl bg-neutral-bg px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-muted">Subtotal</span>
          <span className="tabular-nums text-neutral-text">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-muted">Tax</span>
          <span className="tabular-nums text-neutral-text">{formatCurrency(tax)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 pt-1.5">
          <span className="text-sm font-medium text-neutral-text">Amount due</span>
          <span className="text-base font-bold tabular-nums text-brand-600">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          className="h-12 w-full rounded-lg text-[15px] font-semibold"
          loading={placing}
          disabled={placing}
          onClick={paymentOption === "COD" ? handleCOD : handleCard}
        >
          {paymentOption === "COD" ? (
            <span className="flex items-center justify-center gap-2">
              <Truck className="h-4 w-4" />
              {retryOrderId ? "Switch to Cash on Delivery" : "Place Order (Cash on Delivery)"}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Lock className="h-4 w-4" />
              Pay {formatCurrency(total)} Securely
            </span>
          )}
        </Button>

        {!retryOrderId ? (
          <button
            type="button"
            onClick={onBack}
            className="flex w-full items-center justify-center gap-1.5 text-sm text-neutral-muted transition-colors hover:text-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Delivery Info
          </button>
        ) : null}
      </div>
    </div>
  );
}
