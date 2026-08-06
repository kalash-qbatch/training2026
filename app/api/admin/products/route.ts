import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  createProduct,
  findAdminProducts,
  type StockFilter,
} from "@/lib/services/products";
import { getProductError, productErrorStatus } from "@/lib/errors/products";
import { adminProductSchema } from "@/lib/validations/admin";

function parsePriceParam(raw: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const result = await findAdminProducts({
      search: searchParams.get("search") ?? undefined,
      stock: (searchParams.get("stock") as StockFilter | null) ?? "all",
      minPrice: parsePriceParam(searchParams.get("minPrice")),
      maxPrice: parsePriceParam(searchParams.get("maxPrice")),
      page: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 8),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("admin products GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
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

    const product = await createProduct({
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
      message: "Product created successfully",
    });
  } catch (err) {
    const productErr = getProductError(err);
    if (productErr) {
      return NextResponse.json(
        { success: false, error: productErr.message },
        { status: productErrorStatus(productErr.code) }
      );
    }
    console.error("admin products POST:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create product" },
      { status: 500 }
    );
  }
}
