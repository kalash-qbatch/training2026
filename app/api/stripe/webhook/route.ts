import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { findOrderByPaymentIntentId, updateOrderPaymentStatus } from "@/lib/services/orders";
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
          await updateOrderPaymentStatus(order.id, "SUCCEEDED");
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const order = await findOrderByPaymentIntentId(paymentIntent.id);
        if (order) {
          await updateOrderPaymentStatus(order.id, "FAILED");
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

      default:
        // Ignore other event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
