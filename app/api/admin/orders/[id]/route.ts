import { NextResponse } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import {
  findOrderById,
  OrderError,
  updateOrderStatus,
} from "@/lib/services/orders";

type Ctx = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export async function GET(_request: Request, context: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await context.params;
    const order = await findOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("admin order GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load order" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid status",
        },
        { status: 400 }
      );
    }

    const order = await updateOrderStatus(
      id,
      parsed.data.status as OrderStatus
    );
    return NextResponse.json({
      success: true,
      order,
      message: "Order status updated",
    });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    console.error("admin order PATCH:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
