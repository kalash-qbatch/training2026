import { NextResponse } from "next/server";
import {
  createAdminProduct,
  listAdminProducts,
} from "@/lib/controllers/admin-products";

export async function GET(request: Request) {
  try {
    const result = await listAdminProducts(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin products GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const result = await createAdminProduct(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin products POST:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create product" },
      { status: 500 }
    );
  }
}
