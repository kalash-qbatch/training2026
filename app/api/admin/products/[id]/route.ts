import { NextResponse } from "next/server";

import { updateAdminProduct } from "@/lib/controllers/admin-products";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const result = await updateAdminProduct(id, request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("admin products PUT:", err);
    const message =
      err instanceof Error && err.message.includes("Unique constraint")
        ? "Update failed due to a SKU/color conflict. Try again."
        : err instanceof Error
          ? err.message
          : "Failed to update product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
