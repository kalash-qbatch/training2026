import { NextResponse } from "next/server";
import { listAdminOrders } from "@/lib/controllers/admin-orders";

export async function GET(request: Request) {
  try {
    const result = await listAdminOrders(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin orders GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
