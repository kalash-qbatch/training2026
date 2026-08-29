import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createOrder } from "@/lib/services/orders";
import { OrderError } from "@/lib/services/orders";
import { mapStripeError } from "@/lib/services/payment-errors";
import { stripe } from "@/lib/stripe";
import type { PlaceOrderItemInput } from "@/types";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { paymentIntentId, paymentMethod, items } = body as {
      paymentIntentId?: string;
      paymentMethod: "CARD" | "COD";
      items: PlaceOrderItemInput[];
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }

    // --- COD: place order directly, no Stripe ---
    if (paymentMethod === "COD") {
      const order = await createOrder(userId, items, {
        paymentMethod: "COD",
        paymentStatus: "PENDING",
      });
      return NextResponse.json({ success: true, order });
    }

    // --- CARD: verify PaymentIntent with Stripe ---
    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: "Payment intent ID is required for card payments" },
        { status: 400 }
      );
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status === "succeeded") {
      const order = await createOrder(userId, items, {
        paymentMethod: "CARD",
        paymentStatus: "SUCCEEDED",
        stripePaymentIntentId: intent.id,
        stripeClientSecret: intent.client_secret ?? undefined,
      });
      return NextResponse.json({ success: true, order });
    }

    if (intent.status === "processing") {
      const order = await createOrder(userId, items, {
        paymentMethod: "CARD",
        paymentStatus: "PROCESSING",
        stripePaymentIntentId: intent.id,
        stripeClientSecret: intent.client_secret ?? undefined,
      });
      return NextResponse.json({ success: true, order, processing: true });
    }

    // Payment failed or requires action
    const errorInfo = mapStripeError({
      type: "StripeCardError",
      decline_code: intent.last_payment_error?.decline_code,
      code: intent.last_payment_error?.code,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorInfo.message,
        errorInfo,
      },
      { status: 402 }
    );
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("checkout confirm error:", err);
    return NextResponse.json({ success: false, error: "Failed to confirm order" }, { status: 500 });
  }
}
