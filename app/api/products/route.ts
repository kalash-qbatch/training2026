import { NextResponse } from "next/server";
import { listProducts } from "@/lib/controllers/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await listProducts(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("products GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}
