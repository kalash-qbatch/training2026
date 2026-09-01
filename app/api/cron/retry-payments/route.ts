import { NextResponse } from "next/server";

import { findOrdersDueForPaymentRetry, handlePaymentFailure } from "@/lib/services/orders";
import {
  createPaymentIntentForOrder,
  listCustomerPaymentMethods,
  retryOffSessionPayment,
} from "@/lib/services/stripe";

/**
 * Processes automatic off-session payment retries for failed orders.
 * Call via cron (e.g. daily) with Authorization: Bearer CRON_SECRET.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueOrders = await findOrdersDueForPaymentRetry();
  const results: Array<{ orderId: string; status: string }> = [];

  for (const order of dueOrders) {
    try {
      const savedPMs = await listCustomerPaymentMethods(order.userId);
      const defaultPm = savedPMs.find((pm) => pm.isDefault) ?? savedPMs[0];

      if (!defaultPm) {
        await handlePaymentFailure(order.id, order.stripePaymentIntentId ?? undefined);
        results.push({ orderId: order.id, status: "no_payment_method" });
        continue;
      }

      const amountCents = Math.round(Number(order.total) * 100);
      const { paymentIntentId } = await createPaymentIntentForOrder(
        order.userId,
        order.id,
        amountCents,
        defaultPm.id
      );

      const { status } = await retryOffSessionPayment(paymentIntentId, defaultPm.id);

      if (status === "succeeded" || status === "processing") {
        results.push({ orderId: order.id, status });
      } else {
        await handlePaymentFailure(order.id, paymentIntentId);
        results.push({ orderId: order.id, status: "failed" });
      }
    } catch {
      await handlePaymentFailure(order.id, order.stripePaymentIntentId ?? undefined);
      results.push({ orderId: order.id, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
