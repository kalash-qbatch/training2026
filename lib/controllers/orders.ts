import { auth } from "@/auth";
import { requireUser } from "@/lib/controllers/http";
import {
  createOrder,
  findOrderById,
  findOrders,
  OrderError,
  reorderCancelledOrder,
} from "@/lib/services/orders";
import type { PlaceOrderItemInput } from "@/types";

export async function listOrders(request: Request) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Number(searchParams.get("pageSize") || 5);
  const result = await findOrders(page, pageSize, userId);
  return { status: 200, body: { success: true, ...result } };
}

export async function placeOrder(body: unknown) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const data = body as {
    items?: PlaceOrderItemInput[];
    paymentMethod?: "CARD" | "COD";
    paymentStatus?:
      "UNPAID" | "PENDING" | "PROCESSING" | "PAID" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  };
  if (!Array.isArray(data.items) || !data.items.length) {
    return {
      status: 400,
      body: { success: false, error: "Cart is empty" },
    };
  }

  try {
    const order = await createOrder(userId, data.items, {
      paymentMethod: data.paymentMethod ?? "CARD",
      paymentStatus: data.paymentStatus ?? "PENDING",
    });
    return {
      status: 200,
      body: {
        success: true,
        order,
        message: "Order placed successfully",
      },
    };
  } catch (err) {
    if (OrderError.is(err)) {
      return {
        status: err.status,
        body: { success: false, error: err.message },
      };
    }
    throw err;
  }
}

export async function getOrder(id: string) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const order = await findOrderById(id, isAdmin ? undefined : userId);
  if (!order) {
    return {
      status: 404,
      body: { success: false, error: "Order not found" },
    };
  }
  return { status: 200, body: { success: true, order } };
}

export async function reorderCancelled(id: string) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  try {
    const result = await reorderCancelledOrder(id, userId);
    return {
      status: 200,
      body: { success: true, items: result.cart },
    };
  } catch (err) {
    if (OrderError.is(err)) {
      return {
        status: err.status,
        body: { success: false, error: err.message },
      };
    }
    throw err;
  }
}

export async function retryOrderForCheckout(id: string) {
  const { userId, error } = await requireUser();
  if (error || !userId) return error!;

  const order = await findOrderById(id, userId);
  if (!order) {
    return {
      status: 404,
      body: { success: false, error: "Order not found" },
    };
  }
  if (order.status === "cancelled") {
    return {
      status: 400,
      body: { success: false, error: "This order has been cancelled." },
    };
  }
  if (order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "PAID") {
    return {
      status: 400,
      body: { success: false, error: "This order has already been paid." },
    };
  }
  if (order.paymentMethod !== "CARD") {
    return {
      status: 400,
      body: { success: false, error: "This order does not require card payment retry." },
    };
  }
  if (order.paymentStatus === "PROCESSING") {
    return {
      status: 400,
      body: { success: false, error: "Payment is still processing." },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      orderId: order.id,
      checkoutUrl: `/checkout?orderId=${order.id}`,
    },
  };
}
