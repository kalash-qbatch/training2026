import { NextResponse } from "next/server";
import { getOrder } from "@/lib/controllers/orders";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await getOrder(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("order detail GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load order" },
      { status: 500 }
    );
  }
}
