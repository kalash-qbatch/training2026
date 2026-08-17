import { NextResponse } from "next/server";
import {
  getAdminOrder,
  patchAdminOrderStatus,
} from "@/lib/controllers/admin-orders";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const result = await getAdminOrder(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin order GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load order" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const result = await patchAdminOrderStatus(id, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin order PATCH:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
