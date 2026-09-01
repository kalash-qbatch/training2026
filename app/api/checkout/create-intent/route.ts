import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  attachPaymentIntentToOrder,
  createOrder,
  findOrderById,
  OrderError,
  updateOrderStatus,
} from "@/lib/services/orders";
import { createPaymentIntentForCart, createPaymentIntentForOrder } from "@/lib/services/stripe";
import type { PlaceOrderItemInput, UserInfo } from "@/types";

function errorMessage(err: unknown): string {
  if (OrderError.is(err)) return err.message;
  if (err instanceof Error) return err.message;
  return "Failed to create payment intent";
}

export async function POST(request: Request) {
  let pendingOrderId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { items, paymentMethodId, savePaymentMethod, orderId, shipping } = body as {
      items?: PlaceOrderItemInput[];
      paymentMethodId?: string;
      savePaymentMethod?: boolean;
      orderId?: string;
      shipping?: UserInfo;
    };

    // --- Retry flow: create PI for an existing unpaid order ---
    if (orderId) {
      const existing = await findOrderById(orderId, userId);
      if (!existing) {
        return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
      }
      if (existing.status === "cancelled") {
        return NextResponse.json(
          { success: false, error: "This order has been cancelled." },
          { status: 400 }
        );
      }
      if (existing.paymentStatus === "SUCCEEDED" || existing.paymentStatus === "PAID") {
        return NextResponse.json(
          { success: false, error: "This order has already been paid." },
          { status: 400 }
        );
      }

      const amountCents = Math.round(existing.amount * 100);
      if (amountCents < 50) {
        return NextResponse.json(
          { success: false, error: "Order total is below the minimum payment amount." },
          { status: 400 }
        );
      }

      const { clientSecret, paymentIntentId } = await createPaymentIntentForOrder(
        userId,
        orderId,
        amountCents,
        paymentMethodId,
        savePaymentMethod
      );

      await attachPaymentIntentToOrder(orderId, userId, paymentIntentId, clientSecret);

      return NextResponse.json({
        success: true,
        clientSecret,
        paymentIntentId,
        orderId,
        amount: existing.amount,
        retry: true,
      });
    }

    // --- New order flow: create order first, then PI ---
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }

    const order = await createOrder(userId, items, {
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      shipping,
    });
    pendingOrderId = order.id;

    const amountCents = Math.round(order.amount * 100);
    if (amountCents < 50) {
      throw new OrderError("Order total is below the minimum payment amount.");
    }

    const { clientSecret, paymentIntentId } = await createPaymentIntentForCart(
      userId,
      amountCents,
      paymentMethodId,
      savePaymentMethod,
      order.id
    );

    await attachPaymentIntentToOrder(order.id, userId, paymentIntentId, clientSecret);

    return NextResponse.json({
      success: true,
      clientSecret,
      paymentIntentId,
      orderId: order.id,
      amount: order.amount,
    });
  } catch (err) {
    if (pendingOrderId) {
      try {
        await updateOrderStatus(pendingOrderId, "CANCELLED");
      } catch (rollbackErr) {
        console.error("create-intent rollback error:", rollbackErr);
      }
    }

    console.error("create-intent error:", err);

    if (OrderError.is(err)) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }

    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
