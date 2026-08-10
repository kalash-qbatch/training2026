import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  createCategory,
  listCategories,
} from "@/lib/services/categories";
import { adminCategorySchema } from "@/lib/validations/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const categories = await listCategories();
    return NextResponse.json({ success: true, categories });
  } catch (err) {
    console.error("admin categories GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = adminCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid category",
        },
        { status: 400 }
      );
    }

    const category = await createCategory(parsed.data.name);
    return NextResponse.json({
      success: true,
      category,
      message: "Category saved",
    });
  } catch (err) {
    console.error("admin categories POST:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create category",
      },
      { status: 500 }
    );
  }
}
