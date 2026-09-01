"use client";

import { useState } from "react";

import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getStripe } from "@/lib/stripe-client";

type SavedPM = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

function AddCardForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (pm: SavedPM) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!stripe || !elements) return;
    setSaving(true);
    try {
      const siRes = await fetch("/api/payment-methods/setup-intent", { method: "POST" });
      const siData = await siRes.json();
      if (!siData.success) throw new Error(siData.error || "Failed to initialize");

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { setupIntent, error } = await stripe.confirmCardSetup(siData.clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) throw new Error(error.message ?? "Card setup failed");

      const pmId = setupIntent.payment_method as string;

      const attachRes = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });
      const attachData = await attachRes.json();
      if (!attachData.success) throw new Error(attachData.error || "Failed to save card");

      toast.success("Card saved successfully!");
      onSuccess({
        id: pmId,
        brand: "unknown",
        last4: "****",
        expMonth: 0,
        expYear: 0,
        isDefault: false,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add card");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "15px",
                color: "#1a1a2e",
                fontFamily: "'Inter', system-ui, sans-serif",
                "::placeholder": { color: "#9ca3af" },
              },
              invalid: { color: "#ef4444" },
            },
          }}
        />
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          loading={saving}
          disabled={saving}
          onClick={handleAdd}
          className="flex-1"
        >
          Save Card
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AddCardSection({
  onSuccess,
  onCancel,
}: {
  onSuccess: (pm: SavedPM) => void;
  onCancel: () => void;
}) {
  return (
    <Elements stripe={getStripe()}>
      <AddCardForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
