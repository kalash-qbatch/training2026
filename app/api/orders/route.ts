import { NextResponse } from "next/server";

import { listOrders, placeOrder } from "@/lib/controllers/orders";

export async function GET(request: Request) {
  try {
    const result = await listOrders(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("orders GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to load orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await placeOrder(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("orders POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to place order";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
