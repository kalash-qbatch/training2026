import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  deleteProduct,
  updateProduct,
} from "@/lib/services/products";
import { getProductError, productErrorStatus } from "@/lib/errors/products";
import { adminProductSchema } from "@/lib/validations/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = adminProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid product",
        },
        { status: 400 }
      );
    }

    const product = await updateProduct(id, {
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      stock: parsed.data.stock,
      image: parsed.data.image,
      color: parsed.data.color,
      size: parsed.data.size,
      variants: parsed.data.variants,
    });

    return NextResponse.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (err) {
    const productErr = getProductError(err);
    if (productErr) {
      return NextResponse.json(
        { success: false, error: productErr.message },
        { status: productErrorStatus(productErr.code) }
      );
    }
    console.error("admin products PUT:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await context.params;
    await deleteProduct(id);
    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    const productErr = getProductError(err);
    if (productErr) {
      return NextResponse.json(
        { success: false, error: productErr.message },
        { status: productErrorStatus(productErr.code) }
      );
    }
    console.error("admin products DELETE:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
