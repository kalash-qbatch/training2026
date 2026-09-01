"use client";

import { Elements } from "@stripe/react-stripe-js";

import { getStripe } from "@/lib/stripe-client";
import type { CartItem, PaymentErrorInfo, SavedPM, UserInfo } from "@/types";

import { CheckoutForm } from "./CheckoutForm";

type CheckoutPaymentStepProps = {
  selectedItems: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  savedPMs: SavedPM[];
  userInfo: UserInfo;
  retryOrderId?: string;
  onSuccess: (orderId: string, method: string) => void;
  onError: (info: PaymentErrorInfo) => void;
  onBack: () => void;
};

export function CheckoutPaymentStep(props: CheckoutPaymentStepProps) {
  return (
    <Elements stripe={getStripe()}>
      <CheckoutForm {...props} />
    </Elements>
  );
}
