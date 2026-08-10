import { NextResponse } from "next/server";
import { listCategories } from "@/lib/services/categories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("categories GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 }
    );
  }
}
