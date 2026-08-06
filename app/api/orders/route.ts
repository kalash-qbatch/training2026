import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createOrder,
  findOrders,
  OrderError,
  type PlaceOrderItemInput,
} from "@/lib/services/orders";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 5);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const result = await findOrders(page, pageSize, userId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("orders GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { items?: PlaceOrderItemInput[] };
    if (!Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json(
        { success: false, error: "Cart is empty" },
        { status: 400 }
      );
    }

    const order = await createOrder(userId, body.items);
    return NextResponse.json({
      success: true,
      order,
      message: "Order placed successfully",
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("orders POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to place order" },
      { status: 500 }
    );
  }
}
