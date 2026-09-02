import { NextResponse } from "next/server";

import { retryOrderForCheckout } from "@/lib/controllers/orders";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await retryOrderForCheckout(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("order retry POST error:", error);
    return NextResponse.json({ success: false, error: "Failed to prepare retry" }, { status: 500 });
  }
}
