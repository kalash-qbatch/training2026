import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminUser } from "@/lib/controllers/http";
import {
  findAdminOrders,
  findOrderById,
  OrderError,
  updateOrderStatus,
} from "@/lib/services/orders";

const statusSchema = z.object({
  status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export async function listAdminOrders(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const result = await findAdminOrders({
    search: searchParams.get("search") ?? undefined,
    page: Number(searchParams.get("page") || 1),
    pageSize: Number(searchParams.get("pageSize") || 8),
  });
  return { status: 200, body: { success: true, ...result } };
}

export async function getAdminOrder(id: string) {
  const { error } = await requireAdminUser();
  if (error) return error;

  const order = await findOrderById(id);
  if (!order) {
    return {
      status: 404,
      body: { success: false, error: "Order not found" },
    };
  }
  return { status: 200, body: { success: true, order } };
}

export async function patchAdminOrderStatus(id: string, body: unknown) {
  const { error } = await requireAdminUser();
  if (error) return error;

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid status",
      },
    };
  }

  try {
    const order = await updateOrderStatus(
      id,
      parsed.data.status as OrderStatus
    );
    return {
      status: 200,
      body: {
        success: true,
        order,
        message: "Order status updated",
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
