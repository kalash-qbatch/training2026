import {
  createOrder,
  findOrderById,
  findOrders,
  OrderError,
  type PlaceOrderItemInput,
} from "@/lib/services/orders";
import { requireUser } from "@/lib/controllers/http";

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

  const data = body as { items?: PlaceOrderItemInput[] };
  if (!Array.isArray(data.items) || !data.items.length) {
    return {
      status: 400,
      body: { success: false, error: "Cart is empty" },
    };
  }

  try {
    const order = await createOrder(userId, data.items);
    return {
      status: 200,
      body: {
        success: true,
        order,
        message: "Order placed successfully",
      },
    };
  } catch (err) {
    if (err instanceof OrderError) {
      return {
        status: err.status,
        body: { success: false, error: err.message },
      };
    }
    throw err;
  }
}

export async function getOrder(id: string) {
  const order = await findOrderById(id);
  if (!order) {
    return {
      status: 404,
      body: { success: false, error: "Order not found" },
    };
  }
  return { status: 200, body: { success: true, order } };
}
