import { NextResponse } from "next/server";
import { getProduct } from "@/lib/controllers/products";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await getProduct(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("product detail GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load product" },
      { status: 500 }
    );
  }
}
