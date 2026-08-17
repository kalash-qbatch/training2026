import { NextResponse } from "next/server";
import { getCategories } from "@/lib/controllers/categories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getCategories();
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("categories GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 }
    );
  }
}
