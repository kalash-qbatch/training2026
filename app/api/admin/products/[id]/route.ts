import { NextResponse } from "next/server";
import {
  deleteAdminProduct,
  updateAdminProduct,
} from "@/lib/controllers/admin-products";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const result = await updateAdminProduct(id, request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin products PUT:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const result = await deleteAdminProduct(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin products DELETE:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
