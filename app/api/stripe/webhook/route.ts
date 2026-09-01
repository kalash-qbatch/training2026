import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  confirmExistingOrderPayment,
  findOrderByPaymentIntentId,
  handlePaymentFailure,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from "@/lib/services/orders";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook signature missing" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const order = await findOrderByPaymentIntentId(paymentIntent.id);

        if (order) {
          await confirmExistingOrderPayment(
            order.id,
            order.userId,
            "SUCCEEDED",
            paymentIntent.id,
            paymentIntent.client_secret ?? undefined
          );
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const order = await findOrderByPaymentIntentId(paymentIntent.id);

        if (order) {
          await handlePaymentFailure(order.id, paymentIntent.id);
        }
        break;
      }

      case "payment_intent.processing": {
        const paymentIntent = event.data.object;
        const order = await findOrderByPaymentIntentId(paymentIntent.id);
        if (order) {
          await updateOrderPaymentStatus(order.id, "PROCESSING");
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object;
        const order = await findOrderByPaymentIntentId(paymentIntent.id);
        if (order && order.status !== "CANCELLED") {
          await updateOrderStatus(order.id, "CANCELLED");
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
