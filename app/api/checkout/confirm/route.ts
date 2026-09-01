import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  confirmExistingOrderPayment,
  createOrder,
  handlePaymentFailure,
  OrderError,
  switchOrderToCod,
} from "@/lib/services/orders";
import { mapStripeError } from "@/lib/services/payment-errors";
import { getStripe } from "@/lib/stripe";
import type { PlaceOrderItemInput, UserInfo } from "@/types";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { paymentIntentId, paymentMethod, items, orderId, shipping } = body as {
      paymentIntentId?: string;
      paymentMethod: "CARD" | "COD";
      items?: PlaceOrderItemInput[];
      orderId?: string;
      shipping?: UserInfo;
    };

    // --- Retry: switch existing order to COD ---
    if (orderId && paymentMethod === "COD") {
      const order = await switchOrderToCod(orderId, userId);
      return NextResponse.json({ success: true, order });
    }

    // --- New COD order ---
    if (paymentMethod === "COD") {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
      }
      const order = await createOrder(userId, items, {
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        shipping,
      });
      return NextResponse.json({ success: true, order });
    }

    // --- CARD: verify PaymentIntent and update existing order ---
    if (!paymentIntentId) {
      return NextResponse.json(
        { success: false, error: "Payment intent ID is required for card payments" },
        { status: 400 }
      );
    }

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required for card payments" },
        { status: 400 }
      );
    }

    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);

    if (intent.metadata.userId && intent.metadata.userId !== userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    if (intent.status === "succeeded") {
      const order = await confirmExistingOrderPayment(
        orderId,
        userId,
        "SUCCEEDED",
        intent.id,
        intent.client_secret ?? undefined
      );
      return NextResponse.json({ success: true, order });
    }

    if (intent.status === "processing") {
      const order = await confirmExistingOrderPayment(
        orderId,
        userId,
        "PROCESSING",
        intent.id,
        intent.client_secret ?? undefined
      );
      return NextResponse.json({ success: true, order, processing: true });
    }

    // Payment failed or requires action — order already exists with stock deducted.
    // Call handlePaymentFailure to record attempt, calculate next retry (2 or 3 days), or cancel + restock after max attempts.
    await handlePaymentFailure(orderId, paymentIntentId);
    const errorInfo = mapStripeError({
      type: "StripeCardError",
      decline_code: intent.last_payment_error?.decline_code,
      code: intent.last_payment_error?.code,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorInfo.message,
        errorInfo: { ...errorInfo, orderId },
        orderId,
      },
      { status: 402 }
    );
  } catch (err) {
    if (OrderError.is(err)) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("checkout confirm error:", err);
    return NextResponse.json({ success: false, error: "Failed to confirm order" }, { status: 500 });
  }
}
